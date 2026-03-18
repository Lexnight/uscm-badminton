import { getState, setState, subscribe, resetAppState } from './modules/app.js';
import { addMinutesToTime, pairKey } from './modules/utils.js';
import { mountShell, escapeHtml, playerName, playerColor } from './modules/ui.js';
import { bindSidebarPersistence } from './modules/save-controls.js';
import { buildGroups, rebalanceExistingGroups, updateGroupMatchScore, getGroupImbalance, syncDerivedGroupCount } from './modules/groups.js';
import { calculateGroupStandings, getTournamentDurationSummary, getQualifiedPlayers, getMatchOutcome, shouldDisableThirdSet, validateBadmintonSet } from './modules/calculations.js';

const content = mountShell({
  activePage: 'poules',
  title: 'Gestion des poules',
  subtitle: 'Consultez une poule à la fois, puis saisissez les scores directement dans la matrice.'
});

let activeGroupId = null;

function markBracketStale(bracket = {}) {
  return { ...bracket, stale: true };
}

function ensureGroups(state) {
  const participantCount = Math.max(state.players?.length || 0, Number(state.settings?.participantCount || 0));
  const synced = syncDerivedGroupCount(state);
  const groupCount = synced.settings.groupCount;
  const assignedCount = (state.groups || []).reduce((sum, group) => sum + (group.playerIds?.length || 0), 0);

  const settingsNeedSync =
    participantCount !== Number(state.settings?.participantCount || 0)
    || groupCount !== Number(state.settings?.groupCount || 0);

  const needsGroups =
    (state.players || []).length > 0
    && (
      !(state.groups || []).length
      || (state.groups || []).length !== groupCount
      || assignedCount !== (state.players || []).length
    );

  if (!settingsNeedSync && !needsGroups) return state;

  const nextState = {
    ...state,
    settings: {
      ...state.settings,
      participantCount,
      groupCount
    }
  };

  if (!needsGroups) return nextState;

  return {
    ...nextState,
    groups: buildGroups(nextState.players || [], nextState.settings.groupCount, nextState.groups || [])
  };
}

function ensureActiveGroup(groups = []) {
  if (!groups.length) {
    activeGroupId = null;
    return null;
  }
  const exists = groups.some((group) => group.id === activeGroupId);
  if (!activeGroupId || !exists) {
    activeGroupId = groups[0].id;
  }
  return activeGroupId;
}

function getMatchMap(group) {
  const map = new Map();
  for (const match of group.matches || []) {
    map.set(pairKey(match.player1Id, match.player2Id), match);
  }
  return map;
}

function renderIdentity(state, playerId, compact = false) {
  const name = playerName(state.players, playerId);
  const color = playerColor(state.players, playerId);
  return `
    <div class="team-chip ${compact ? 'compact' : ''} static-team-chip">
      <span class="player-dot" style="--player-color:${color};"></span>
      <span class="team-chip-name">${escapeHtml(name)}</span>
    </div>
  `;
}

function getValidationClass(validation) {
  if (validation?.status === 'error') return 'has-error';
  if (validation?.status === 'caution') return 'has-caution';
  return '';
}

function renderScoreInput(match, state, setIndex, side, validation, locked = false) {
  const playerId = side === 'a' ? match.player1Id : match.player2Id;
  const color = playerColor(state.players, playerId);
  const value = match.sets?.[setIndex]?.[side] ?? '';

  return `
    <label class="score-input-wrap ${locked ? 'is-locked' : ''} ${getValidationClass(validation)}">
      <span class="player-dot tiny input-dot" style="--player-color:${color};"></span>
      <input
        type="text"
        inputmode="numeric"
        pattern="[0-9]*"
        value="${value}"
        data-set-index="${setIndex}"
        data-side="${side}"
        aria-label="Score ${side === 'a' ? 'joueur 1' : 'joueur 2'}"
        ${locked ? 'disabled' : ''}
      >
    </label>
  `;
}

function renderUpperEditor(match, state) {
  const thirdLocked = shouldDisableThirdSet(match.sets || []);
  const target = Number(state.settings.setPoints || 21);
  const rows = [
    { index: 0, locked: false },
    { index: 1, locked: false },
    { index: 2, locked: thirdLocked }
  ];

  return `
    <div class="cell-editor" data-match-id="${match.id}">
      ${rows.map((row) => {
        const validation = validateBadmintonSet(match.sets?.[row.index], target);
        const rowClass = getValidationClass(validation);
        const title = validation?.message ? `title="${escapeHtml(validation.message)}"` : '';
        return `
          <div class="mini-set-row ${row.locked ? 'is-locked' : ''} ${rowClass}" data-row-index="${row.index}" ${title}>
            ${renderScoreInput(match, state, row.index, 'a', validation, row.locked)}
            <span class="score-separator-inline">–</span>
            ${renderScoreInput(match, state, row.index, 'b', validation, row.locked)}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderLowerMirror(match, rowPlayerId) {
  const outcome = getMatchOutcome(match);
  if (!outcome.finished) {
    return '<div class="cell-mirror pending">En attente</div>';
  }
  const isPlayer1 = match.player1Id === rowPlayerId;
  const wins = isPlayer1 ? outcome.winsA : outcome.winsB;
  const losses = isPlayer1 ? outcome.winsB : outcome.winsA;
  const pointFor = isPlayer1 ? outcome.pointsA : outcome.pointsB;
  const pointAgainst = isPlayer1 ? outcome.pointsB : outcome.pointsA;
  const cellClass = wins > losses ? 'win' : 'loss';
  return `<div class="cell-mirror ${cellClass}"><strong>${wins}-${losses}</strong><small>${pointFor}/${pointAgainst}</small></div>`;
}

function renderGroupTabs(groups, currentGroupId) {
  return `
    <div class="group-tabs" role="tablist" aria-label="Choix de la poule">
      ${groups.map((group) => `
        <button
          type="button"
          class="group-tab ${group.id === currentGroupId ? 'active' : ''}"
          role="tab"
          aria-selected="${group.id === currentGroupId}"
          aria-controls="panel-${group.id}"
          id="tab-${group.id}"
          tabindex="${group.id === currentGroupId ? '0' : '-1'}"
          data-group-tab="${group.id}"
        >
          <span>${escapeHtml(group.name)}</span>
          <small>${group.playerIds.length} équipe(s)</small>
        </button>
      `).join('')}
    </div>
  `;
}

function renderGroupMatrix(group, state) {
  const standings = calculateGroupStandings(group, state.players);
  const standingMap = new Map(standings.map((row) => [row.playerId, row]));
  const matchMap = getMatchMap(group);
  const ids = group.playerIds || [];

  return `
    <div class="pool-sheet-wrapper">
      <table class="pool-sheet-table">
        <thead>
          <tr>
            <th class="sticky-col">${escapeHtml(group.name)}</th>
            ${ids.map((playerId) => `
              <th class="pool-player-head">${renderIdentity(state, playerId, true)}</th>
            `).join('')}
            <th class="pool-stat-head">Total</th>
            <th class="pool-stat-head">Clt</th>
          </tr>
        </thead>
        <tbody>
          ${ids.map((playerId, rowIndex) => {
            const row = standingMap.get(playerId);
            return `
              <tr>
                <th class="pool-row-name sticky-col">${renderIdentity(state, playerId)}</th>
                ${ids.map((opponentId, colIndex) => {
                  if (playerId === opponentId) {
                    return '<td class="diag-cell"></td>';
                  }
                  const match = matchMap.get(pairKey(playerId, opponentId));
                  if (!match) return '<td class="matrix-cell pending"></td>';
                  if (colIndex > rowIndex) {
                    return `<td class="matrix-cell editor-cell" data-group-id="${group.id}" data-match-id="${match.id}">${renderUpperEditor(match, state)}</td>`;
                  }
                  return `<td class="matrix-cell mirror-cell ${getMatchOutcome(match).finished ? '' : 'pending'}">${renderLowerMirror(match, playerId)}</td>`;
                }).join('')}
                <td class="pool-total-cell">${row?.rankingPoints ?? 0}</td>
                <td class="pool-rank-cell">${row?.rank ?? '-'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function render(state) {
  const normalizedState = ensureGroups(state);
  if (normalizedState !== state) {
    setState(normalizedState);
    return;
  }

  const activeState = normalizedState;
  const groups = activeState.groups || [];
  const currentGroupId = ensureActiveGroup(groups);
  const activeGroup = groups.find((group) => group.id === currentGroupId) || null;
  const imbalance = getGroupImbalance(groups);
  const duration = getTournamentDurationSummary(activeState);
  const qualified = getQualifiedPlayers(activeState, activeState.settings.qualifierMode);
  const completedGroupMatches = (groups || []).reduce((total, group) => total + (group.matches || []).filter((match) => getMatchOutcome(match).finished).length, 0);
  const groupProgress = duration.groupMatches ? Math.round((completedGroupMatches / duration.groupMatches) * 100) : 0;

  content.innerHTML = `
    <section class="hero-grid">
      <article class="card">
        <div class="section-title">
          <div>
            <h2>Feuilles de poules</h2>
            <p>Affichage par onglets : une seule poule visible à la fois, pour une lecture plus confortable et une saisie plus rapide.</p>
          </div>
          
        </div>
        <div class="kpis">
          <div class="kpi">
            <div class="label">Participants</div>
            <div class="value">${activeState.players.length}</div>
          </div>
          <div class="kpi">
            <div class="label">Poules</div>
            <div class="value">${groups.length}</div>
          </div>
          <div class="kpi">
            <div class="label">Matchs de poules</div>
            <div class="value">${duration.groupMatches}</div>
          </div>
          <div class="kpi">
            <div class="label">Fin estimée</div>
            <div class="value">${(activeState.settings.startTime || '09:00').slice(0, 5)} → ${addMinutesToTime(activeState.settings.startTime, duration.totalMinutes)}</div>
          </div>
        </div>
        
        <div class="progress-card tight">
          <div class="progress-head">
            <strong>Avancement des poules</strong>
            <span>${groupProgress}%</span>
          </div>
          <div class="progress-meter"><div class="progress-fill" style="width:${groupProgress}%;"></div></div>
          <div class="progress-meta">
            <span>${completedGroupMatches} match(s) saisi(s)</span>
            <span>${Math.max(0, duration.groupMatches - completedGroupMatches)} restant(s)</span>
          </div>
        </div>
      </article>

      <article class="card">
        <div class="section-title">
          <div>
            <h2>Équilibrage</h2>
            <p>La composition des poules se règle maintenant sur la page Paramètres. Ici, vous pouvez vérifier l'équilibre global et saisir les scores.</p>
          </div>
        </div>
        ${imbalance.isImbalanced ? `
          <div class="alert alert-danger">
            <strong>Attention :</strong>
            <span>les poules sont déséquilibrées (écart de ${imbalance.delta} participant(s)).</span>
          </div>
        ` : `
          <div class="alert">
            <strong>OK :</strong>
            <span>répartition équilibrée, écart maximal de 1 participant.</span>
          </div>
        `}
        <div class="actions">
          <button id="optimize-groups" class="btn btn-primary">Optimiser automatiquement</button>
        </div>
        <div class="footer-note score-legend-note"><strong>Contrôle saisie :</strong> rouge = score invalide · orange = score prolongé à vérifier.</div>
      </article>
    </section>

    ${groups.length ? `
      <section class="card pools-tabs-section" style="margin-top:18px;">
        <div class="section-title">
          <div>
            <h2>Navigation par poules</h2>
            <p>Choisissez un onglet pour travailler une seule poule à la fois.</p>
          </div>
        </div>
        ${renderGroupTabs(groups, currentGroupId)}
        ${activeGroup ? `
          <article class="card slim active-group-panel" id="panel-${activeGroup.id}" role="tabpanel" aria-labelledby="tab-${activeGroup.id}">
            <div class="section-title">
              <div>
                <h3>${escapeHtml(activeGroup.name)}</h3>
                
              </div>
              
            </div>
            ${renderGroupMatrix(activeGroup, activeState)}
          </article>
        ` : '<div class="empty-state">Aucune poule disponible.</div>'}
      </section>
    ` : ''}
  `;

  bindEvents();
}

function readEditorSets(wrapper) {
  const inputs = [...wrapper.querySelectorAll('input[data-set-index]')];
  const sanitize = (value) => String(value ?? '').replace(/[^0-9]/g, '').slice(0, 2);

  return [0, 1, 2].map((setIndex) => {
    const inputA = inputs.find((input) => Number(input.dataset.setIndex) === setIndex && input.dataset.side === 'a');
    const inputB = inputs.find((input) => Number(input.dataset.setIndex) === setIndex && input.dataset.side === 'b');
    if (inputA) inputA.value = sanitize(inputA.value);
    if (inputB) inputB.value = sanitize(inputB.value);
    return { a: sanitize(inputA?.value ?? ''), b: sanitize(inputB?.value ?? '') };
  });
}

function applyValidationState(wrapper, pointTarget) {
  [0, 1, 2].forEach((setIndex) => {
    const row = wrapper.querySelector(`[data-row-index="${setIndex}"]`);
    if (!row) return;
    const validation = validateBadmintonSet({
      a: wrapper.querySelector(`input[data-set-index="${setIndex}"][data-side="a"]`)?.value ?? '',
      b: wrapper.querySelector(`input[data-set-index="${setIndex}"][data-side="b"]`)?.value ?? ''
    }, pointTarget);
    row.classList.remove('has-error', 'has-caution');
    if (validation.status === 'error') row.classList.add('has-error');
    if (validation.status === 'caution') row.classList.add('has-caution');
    row.title = validation.message || '';

    row.querySelectorAll('.score-input-wrap').forEach((wrap) => {
      wrap.classList.remove('has-error', 'has-caution');
      if (validation.status === 'error') wrap.classList.add('has-error');
      if (validation.status === 'caution') wrap.classList.add('has-caution');
    });
  });
}

function applyThirdSetLock(wrapper) {
  const sets = readEditorSets(wrapper);
  const lockThird = shouldDisableThirdSet(sets);
  const thirdRow = wrapper.querySelector('[data-row-index="2"]');
  const inputA3 = wrapper.querySelector('input[data-set-index="2"][data-side="a"]');
  const inputB3 = wrapper.querySelector('input[data-set-index="2"][data-side="b"]');

  if (!thirdRow || !inputA3 || !inputB3) return sets;

  thirdRow.classList.toggle('is-locked', lockThird);
  inputA3.disabled = lockThird;
  inputB3.disabled = lockThird;
  inputA3.closest('.score-input-wrap')?.classList.toggle('is-locked', lockThird);
  inputB3.closest('.score-input-wrap')?.classList.toggle('is-locked', lockThird);

  if (lockThird) {
    inputA3.value = '';
    inputB3.value = '';
    sets[2] = { a: '', b: '' };
  }

  return sets;
}

function persistScore(groupId, matchId, wrapper) {
  const sets = applyThirdSetLock(wrapper);
  applyValidationState(wrapper, Number(getState().settings.setPoints || 21));
  const currentState = getState();
  setState({
    ...updateGroupMatchScore(currentState, groupId, matchId, sets),
    bracket: markBracketStale(currentState.bracket)
  });
}

function bindEvents() {
  document.getElementById('optimize-groups')?.addEventListener('click', () => {
    const currentState = getState();
    const nextState = {
      ...rebalanceExistingGroups(syncDerivedGroupCount(currentState)),
      bracket: markBracketStale(currentState.bracket)
    };
    ensureActiveGroup(nextState.groups || []);
    setState(nextState);
  });

  document.querySelectorAll('[data-group-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      activeGroupId = button.dataset.groupTab;
      render(getState());
    });
  });

  document.querySelectorAll('.editor-cell .cell-editor').forEach((editor) => {
    const groupId = editor.closest('.editor-cell')?.dataset.groupId;
    const matchId = editor.closest('.editor-cell')?.dataset.matchId;
    const pointTarget = Number(getState().settings.setPoints || 21);
    let isCommitting = false;
    applyValidationState(editor, pointTarget);

    editor.querySelectorAll('input[data-set-index]').forEach((input) => {
      input.addEventListener('input', () => {
        input.value = String(input.value ?? '').replace(/[^0-9]/g, '').slice(0, 2);
        applyThirdSetLock(editor);
        applyValidationState(editor, pointTarget);
      });

      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          isCommitting = true;
          persistScore(groupId, matchId, editor);
        }
      });
    });

    editor.addEventListener('focusout', (event) => {
      if (editor.contains(event.relatedTarget)) return;
      if (isCommitting) {
        isCommitting = false;
        return;
      }
      persistScore(groupId, matchId, editor);
    });
  });

  document.getElementById('reset-app')?.addEventListener('click', () => {
    if (!window.confirm('Réinitialiser tout le tournoi ?')) return;
    activeGroupId = null;
    resetAppState();
  });
  bindSidebarPersistence();
}

subscribe(render);
