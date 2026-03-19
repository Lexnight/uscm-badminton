import { getState, setState, subscribe } from './modules/app.js';
import { debounce, addMinutesToTime } from './modules/utils.js';
import { mountShell, escapeHtml, playerColor, playerName, renderPlayerBadge } from './modules/ui.js';
import { bindSidebarPersistence } from './modules/save-controls.js';
import { bindCustomSelects } from './modules/custom-selects.js';
import { generateBracket, updateBracketMatchScore, getBracketCompletion } from './modules/bracket.js';
import { getQualifiedPlayers, getTournamentDurationSummary, getChampion, shouldDisableThirdSet, validateBadmintonSet } from './modules/calculations.js';

const content = mountShell({
  activePage: 'tableau',
  title: 'Tableau à élimination directe',
  subtitle: 'Générez le bracket dynamique à partir des résultats des poules.'
});

let activeRoundId = null;

function ensureActiveRound(rounds = []) {
  if (!rounds.length) {
    activeRoundId = null;
    return null;
  }
  const exists = rounds.some((round) => round.id === activeRoundId);
  if (!activeRoundId || !exists) activeRoundId = rounds[0].id;
  return activeRoundId;
}

function renderRoundTabs(rounds, currentRoundId) {
  return `
    <div class="group-tabs" role="tablist" aria-label="Tours du tableau">
      ${rounds.map((round) => `
        <button
          type="button"
          class="group-tab ${round.id === currentRoundId ? 'active' : ''}"
          role="tab"
          aria-selected="${round.id === currentRoundId}"
          data-round-tab="${round.id}"
        >
          <span>${escapeHtml(round.name)}</span>
          <small>${round.matches.length} match(s)</small>
        </button>
      `).join('')}
    </div>
  `;
}

function getValidationClass(validation) {
  if (validation?.status === 'error') return 'has-error';
  if (validation?.status === 'caution') return 'has-caution';
  return '';
}

function renderSetRow(match, setIndex, state, locked = false) {
  const label = `Set.${setIndex + 1}`;
  const validation = validateBadmintonSet(match.sets?.[setIndex], Number(state.settings.setPoints || 21));
  const title = validation?.message ? `title="${escapeHtml(validation.message)}"` : '';
  const validationClass = getValidationClass(validation);
  return `
    <div class="bracket-score-row ${locked ? 'is-locked' : ''} ${validationClass}" data-row-index="${setIndex}" ${title}>
      <span class="bracket-score-label">${label}</span>
      <span class="player-dot tiny" style="--player-color:${playerColor(state.players, match.player1Id, 0)};"></span>
      <input class="${validationClass}" type="text" inputmode="numeric" pattern="[0-9]*" value="${match.sets?.[setIndex]?.a ?? ''}" data-set-index="${setIndex}" data-side="a" ${locked ? 'disabled' : ''}>
      <span class="score-separator">–</span>
      <input class="${validationClass}" type="text" inputmode="numeric" pattern="[0-9]*" value="${match.sets?.[setIndex]?.b ?? ''}" data-set-index="${setIndex}" data-side="b" ${locked ? 'disabled' : ''}>
      <span class="player-dot tiny" style="--player-color:${playerColor(state.players, match.player2Id, 1)};"></span>
    </div>
  `;
}

function getBracketLegendEntries(state, rounds = []) {
  const ids = [];
  const seen = new Set();
  for (const round of rounds) {
    for (const match of round.matches || []) {
      for (const playerId of [match.player1Id, match.player2Id]) {
        if (playerId && !seen.has(playerId)) {
          seen.add(playerId);
          ids.push(playerId);
        }
      }
    }
  }
  if (!ids.length) {
    for (const entry of getQualifiedPlayers(state, state.settings.qualifierMode)) {
      if (entry.playerId && !seen.has(entry.playerId)) {
        seen.add(entry.playerId);
        ids.push(entry.playerId);
      }
    }
  }
  return ids.map((playerId) => ({
    playerId,
    name: playerName(state.players, playerId, 'À définir'),
    color: playerColor(state.players, playerId)
  }));
}

function renderBracketLegend(entries = []) {
  if (!entries.length) {
    return '<p class="muted" style="margin-top:10px;">Les repères couleur apparaîtront ici dès que le tableau contiendra des joueurs.</p>';
  }
  return `
    <div class="bracket-legend" aria-label="Repères visuels des équipes qualifiées">
      ${entries.map((entry) => `
        <span class="legend-chip">
          <span class="player-dot tiny" style="--player-color:${entry.color};"></span>
          <span>${escapeHtml(entry.name)}</span>
        </span>
      `).join('')}
    </div>
  `;
}

function renderMatchCard(match, round, state) {
  const thirdLocked = shouldDisableThirdSet(match.sets || []);
  return `
    <div class="match-card match-card-enhanced" data-round-id="${round.id}" data-match-id="${match.id}">
      <div class="match-topline">
        
        <span class="match-status ${match.finished ? '' : 'pending'}">${match.autoAdvanced ? 'Bye' : match.finished ? 'Terminé' : 'En attente'}</span>
      </div>

      <div class="match-player ${match.winnerId === match.player1Id && match.finished ? 'winner' : ''}">
        ${renderPlayerBadge(state.players, match.player1Id, { fallback: 'À définir' })}
        <strong>${match.finished && match.winnerId === match.player1Id ? '✓' : ''}</strong>
      </div>
      <div class="match-player ${match.winnerId === match.player2Id && match.finished ? 'winner' : ''}" style="margin-top:8px;">
        ${renderPlayerBadge(state.players, match.player2Id, { fallback: 'À définir' })}
        <strong>${match.finished && match.winnerId === match.player2Id ? '✓' : ''}</strong>
      </div>

      ${match.player1Id && match.player2Id ? `
        <div class="bracket-score-box" style="margin-top:12px;">
          ${renderSetRow(match, 0, state)}
          ${renderSetRow(match, 1, state)}
          ${renderSetRow(match, 2, state, thirdLocked)}
        </div>
      ` : '<p class="muted" style="margin:12px 0 0;">En attente des vainqueurs précédents.</p>'}
    </div>
  `;
}

function render(state) {
  const qualified = getQualifiedPlayers(state, state.settings.qualifierMode);
  const bracketSummary = getBracketCompletion(state.bracket);
  const champion = getChampion(state);
  const duration = getTournamentDurationSummary(state);
  const rounds = state.bracket?.rounds || [];
  const currentRoundId = ensureActiveRound(rounds);
  const activeRound = rounds.find((round) => round.id === currentRoundId) || null;
  const bracketLegendEntries = getBracketLegendEntries(state, rounds);

  content.innerHTML = `
    <section class="hero-grid">
      <article class="card">
        <div class="section-title">
          <div>
            <h2>Configuration du tableau</h2>
            <p>Le tableau se base sur le classement actuel de chaque poule.</p>
          </div>
          
        </div>
        <div class="form-grid">
          <div class="field">
            <label for="tableQualifierMode">Mode de qualification</label>
            <select id="tableQualifierMode">
              <option value="top1" ${state.settings.qualifierMode === 'top1' ? 'selected' : ''}>Premiers uniquement</option>
              <option value="top2" ${state.settings.qualifierMode === 'top2' ? 'selected' : ''}>Premiers + Seconds</option>
              <option value="top3" ${state.settings.qualifierMode === 'top3' ? 'selected' : ''}>Premiers + Seconds + Troisièmes</option>
            </select>
          </div>
          <div class="field">
            <label>Durée moyenne d'un match</label>
            <div class="input">${Number(state.settings.matchDuration || 20)} minutes</div>
          </div>
          <div class="field">
            <label>Fin estimée du tournoi</label>
            <div class="input">${addMinutesToTime(state.settings.startTime, duration.totalMinutes)}</div>
          </div>
        </div>
        <div class="actions">
          <button id="generate-bracket" class="btn btn-primary">Générer / régénérer le tableau</button>
        </div>
        ${state.bracket?.stale ? `
          <div class="alert alert-danger" style="margin-top:14px;">
            <strong>Tableau à mettre à jour :</strong>
            <span>les poules ont changé depuis la dernière génération.</span>
          </div>
        ` : ''}
      </article>

      <article class="card">
        <div class="section-title">
          <div>
            <h2>Suivi du bracket</h2>
            <p>Les vainqueurs montent automatiquement au tour suivant.</p>
          </div>
        </div>
        <div class="kpis">
          <div class="kpi">
            <div class="label">Matchs jouables</div>
            <div class="value">${bracketSummary.playable}</div>
          </div>
          <div class="kpi">
            <div class="label">Matchs terminés</div>
            <div class="value">${bracketSummary.completed}</div>
          </div>
          <div class="kpi">
            <div class="label">Progression</div>
            <div class="value">${bracketSummary.progress}%</div>
          </div>
          <div class="kpi">
            <div class="label">Champion actuel</div>
            <div class="value" style="font-size:1.2rem;">${champion ? escapeHtml(champion.name) : '—'}</div>
          </div>
        </div>
        <div class="progress-card tight">
          <div class="progress-head">
            <strong>Avancement du tableau</strong>
            <span>${bracketSummary.progress}%</span>
          </div>
          <div class="progress-meter"><div class="progress-fill" style="width:${bracketSummary.progress}%;"></div></div>
          <div class="progress-meta">
            <span>${bracketSummary.completed} match(s) terminé(s)</span>
            <span>${Math.max(0, bracketSummary.total - bracketSummary.completed)} restant(s)</span>
          </div>
        </div>
      </article>
    </section>

    <section class="card" style="margin-top:18px;">
      <div class="section-title">
        <div>
          <h2>Qualifiés</h2>
          <p>Ordre utilisé pour le seeding initial du tableau.</p>
        </div>
      </div>
      <div class="pill-row">
        ${qualified.length ? qualified.map((entry) => `
          <span class="badge badge-player"><span class="player-dot tiny" style="--player-color:${playerColor(state.players, entry.playerId)};"></span>${escapeHtml(entry.playerName)} · ${escapeHtml(entry.groupName)} · ${entry.rank}${entry.rank === 1 ? 'er' : 'e'}</span>
        `).join('') : ''}
      </div>
    </section>

    <section class="card" style="margin-top:18px;">
      <div class="section-title">
        <div>
          <h2>Tableau par onglets</h2>
          <p>Chaque tour du tableau s'affiche dans son propre onglet pour une lecture plus claire.</p>
        </div>
        ${activeRound ? `` : ''}
      </div>
      ${rounds.length ? `
        ${renderRoundTabs(rounds, currentRoundId)}
        <div class="round-tab-panel" style="margin-top:16px;">
          ${activeRound ? `
            <div class="round-column round-column-active">
              <h3>${escapeHtml(activeRound.name)}</h3>
              ${activeRound.matches.map((match) => renderMatchCard(match, activeRound, state)).join('')}
            </div>
          ` : ''}
        </div>
      ` : ''}
    </section>
  `;

  bindEvents();
}

function applyBracketValidation(matchCard, pointTarget) {
  [0, 1, 2].forEach((setIndex) => {
    const row = matchCard.querySelector(`[data-row-index="${setIndex}"]`);
    const inputA = matchCard.querySelector(`[data-set-index="${setIndex}"][data-side="a"]`);
    const inputB = matchCard.querySelector(`[data-set-index="${setIndex}"][data-side="b"]`);
    if (!row || !inputA || !inputB) return;

    const validation = validateBadmintonSet({ a: inputA.value, b: inputB.value }, pointTarget);
    row.classList.remove('has-error', 'has-caution');
    inputA.classList.remove('has-error', 'has-caution');
    inputB.classList.remove('has-error', 'has-caution');

    if (validation.status === 'error') {
      row.classList.add('has-error');
      inputA.classList.add('has-error');
      inputB.classList.add('has-error');
    }
    if (validation.status === 'caution') {
      row.classList.add('has-caution');
      inputA.classList.add('has-caution');
      inputB.classList.add('has-caution');
    }
    row.title = validation.message || '';
  });
}

function bindEvents() {
  document.getElementById('generate-bracket')?.addEventListener('click', () => {
    const currentState = getState();
    const qualifierMode = document.getElementById('tableQualifierMode')?.value || currentState.settings.qualifierMode;
    const nextState = {
      ...currentState,
      settings: {
        ...currentState.settings,
        qualifierMode
      },
      bracket: generateBracket({
        ...currentState,
        settings: {
          ...currentState.settings,
          qualifierMode
        }
      }, qualifierMode)
    };
    activeRoundId = nextState.bracket?.rounds?.[0]?.id || null;
    setState(nextState);
  });

  document.querySelectorAll('[data-round-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      activeRoundId = button.dataset.roundTab;
      render(getState());
    });
  });

  const pointTarget = Number(getState().settings.setPoints || 21);

  const persistScore = (matchCard) => {
    const roundId = matchCard.dataset.roundId;
    const matchId = matchCard.dataset.matchId;
    const inputs = [...matchCard.querySelectorAll('input[data-set-index]')];
    const sanitize = (value) => String(value ?? '').replace(/[^0-9]/g, '').slice(0, 2);

    let sets = [0, 1, 2].map((index) => {
      const inputA = matchCard.querySelector(`[data-set-index="${index}"][data-side="a"]`);
      const inputB = matchCard.querySelector(`[data-set-index="${index}"][data-side="b"]`);
      if (inputA) inputA.value = sanitize(inputA.value);
      if (inputB) inputB.value = sanitize(inputB.value);
      return {
        a: sanitize(inputA?.value ?? ''),
        b: sanitize(inputB?.value ?? '')
      };
    });

    if (shouldDisableThirdSet(sets)) {
      sets[2] = { a: '', b: '' };
      const thirdA = inputs.find((input) => Number(input.dataset.setIndex) === 2 && input.dataset.side === 'a');
      const thirdB = inputs.find((input) => Number(input.dataset.setIndex) === 2 && input.dataset.side === 'b');
      if (thirdA) thirdA.value = '';
      if (thirdB) thirdB.value = '';
    }

    applyBracketValidation(matchCard, pointTarget);
    const currentState = getState();
    setState(updateBracketMatchScore({
      ...currentState,
      bracket: {
        ...currentState.bracket,
        stale: false
      }
    }, roundId, matchId, sets));
  };

  const debouncedUpdate = debounce((matchCard) => persistScore(matchCard), 250);

  document.querySelectorAll('.match-card[data-round-id]').forEach((matchCard) => {
    applyBracketValidation(matchCard, pointTarget);
    matchCard.querySelectorAll('input[data-set-index]').forEach((input) => {
      input.addEventListener('input', () => {
        input.value = String(input.value ?? '').replace(/[^0-9]/g, '').slice(0, 2);
        applyBracketValidation(matchCard, pointTarget);
        debouncedUpdate(matchCard);
      });
      input.addEventListener('blur', () => persistScore(matchCard));
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          persistScore(matchCard);
          input.blur();
        }
      });
    });
  });
  bindCustomSelects();
  bindSidebarPersistence();
}

subscribe(render);
