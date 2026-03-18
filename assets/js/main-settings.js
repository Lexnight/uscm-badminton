import { getState, setState, subscribe, resetAppState } from './modules/app.js';
import { addMinutesToTime, debounce } from './modules/utils.js';
import { mountShell, escapeHtml, defaultPlayerColor, playerColor } from './modules/ui.js';
import { bindSidebarPersistence } from './modules/save-controls.js';
import { buildGroups, suggestGroupCount, movePlayerBetweenGroups } from './modules/groups.js';
import { getTournamentDurationSummary, getQualifiedPlayers, getMatchOutcome } from './modules/calculations.js';

const content = mountShell({
  activePage: 'parametres',
  title: 'Paramètres du tournoi',
  subtitle: 'Configurez le tournoi, renommez les équipes, choisissez leurs couleurs et ajustez la composition des poules avant la saisie des matchs.'
});

let draggedPlayerId = null;
let openColorPopoverFor = null;
let flashMessage = '';
let flashType = 'success';

function markBracketStale(bracket = {}) {
  return { ...bracket, stale: true };
}

function setFlash(message, type = 'success') {
  flashMessage = message;
  flashType = type;
  render(getState());
  window.clearTimeout(setFlash._timer);
  setFlash._timer = window.setTimeout(() => {
    flashMessage = '';
    render(getState());
  }, 2600);
}

function sanitizeFileName(value) {
  return String(value || 'Tournoi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'Tournoi';
}

function formatSaveStamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}_${hours}-${minutes}`;
}

function exportTournamentState(stateToExport) {
  const snapshot = {
    ...stateToExport,
    updatedAt: new Date().toISOString(),
    meta: {
      source: 'Badminton Tournoi Pro',
      exportedAt: new Date().toISOString()
    }
  };
  const fileName = `${sanitizeFileName(snapshot.settings?.tournamentName || 'Tournoi')}_${formatSaveStamp(new Date())}.json`;
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return fileName;
}

function createPlaceholderName(index) {
  return `Équipe ${index + 1}`;
}

function syncPlayersToCount(existingPlayers = [], participantCount = 0) {
  const total = Math.max(0, Number(participantCount || 0));
  const players = [];

  for (let index = 0; index < total; index += 1) {
    const existing = existingPlayers[index];
    players.push({
      id: existing?.id || `player_${index + 1}`,
      name: existing?.name || createPlaceholderName(index),
      color: existing?.color || defaultPlayerColor(index)
    });
  }

  return players;
}

function getEffectiveGroups(state) {
  const participantCount = Math.max(state.players.length, Number(state.settings.participantCount || 0));
  const suggestedGroups = suggestGroupCount(participantCount);
  const previewGroups = participantCount ? buildGroups(
    state.players.length ? state.players : syncPlayersToCount([], participantCount),
    suggestedGroups,
    state.groups || []
  ) : [];

  return {
    participantCount,
    suggestedGroups,
    effectiveGroups: state.groups.length ? state.groups : previewGroups
  };
}

function renderGroupsOverview(groups, players) {
  if (!groups.length) {
    return '<div class="empty-state small">Les poules apparaîtront ici dès que le nombre de participants sera défini.</div>';
  }

  return `
    <div class="groups-overview-grid editable-groups-grid">
      ${groups.map((group) => `
        <article class="group-overview-card settings-group-dropzone" data-group-id="${group.id}">
          <div class="group-overview-head">
            <strong>${escapeHtml(group.name)}</strong>
            <span>${group.playerIds.length} équipe(s)</span>
          </div>
          <div class="group-overview-list interactive-group-list">
            ${group.playerIds.length ? group.playerIds.map((playerId, playerIndex) => {
              const player = players.find((entry) => entry.id === playerId);
              const chipColor = playerColor(players, playerId, playerIndex);
              const isOpen = openColorPopoverFor === playerId;
              return `
                <div class="team-chip team-chip-editable team-card" draggable="true" data-player-id="${playerId}">
                  <span class="drag-handle" aria-hidden="true">⋮⋮</span>
                  <span class="player-dot" style="--player-color:${chipColor};"></span>
                  <input
                    class="team-chip-input"
                    type="text"
                    value="${escapeHtml(player?.name || 'Équipe')}"
                    data-player-name="${playerId}"
                    aria-label="Nom de l'équipe"
                  >
                  <button
                    type="button"
                    class="team-color-trigger"
                    data-color-trigger="${playerId}"
                    aria-label="Choisir la couleur"
                    title="Choisir la couleur"
                  >
                    <span class="player-dot" style="--player-color:${chipColor};"></span>
                  </button>
                  <div class="team-color-popover ${isOpen ? 'open' : ''}" data-color-popover="${playerId}" ${isOpen ? '' : 'hidden'}>
                    <div class="team-color-popover-head">Couleur de la puce</div>
                    <input
                      class="team-color-picker"
                      type="color"
                      value="${escapeHtml(chipColor)}"
                      data-player-color-picker="${playerId}"
                      aria-label="Couleur de l'équipe"
                    >
                    <div class="team-color-popover-actions">
                      <button type="button" class="btn btn-ghost btn-sm" data-color-cancel="${playerId}">Annuler</button>
                      <button type="button" class="btn btn-primary btn-sm" data-color-apply="${playerId}">Valider</button>
                    </div>
                  </div>
                </div>
              `;
            }).join('') : '<span class="muted">Aucune équipe</span>'}
          </div>
        </article>
      `).join('')}
    </div>
  `;
}

function buildStateFromForm() {
  const form = document.getElementById('settings-form');
  const data = new FormData(form);
  const currentState = getState();
  const participantCount = Math.max(0, Number(data.get('participantCount') || 0));
  const players = syncPlayersToCount(currentState.players || [], participantCount);
  const groupCount = suggestGroupCount(players.length);

  return {
    ...currentState,
    players,
    settings: {
      ...currentState.settings,
      tournamentName: String(data.get('tournamentName') || 'Tournoi de badminton'),
      participantCount: players.length,
      groupCount,
      setPoints: Number(data.get('setPoints') || 21),
      qualifierMode: String(data.get('qualifierMode') || 'top2'),
      matchDuration: Math.max(1, Number(data.get('matchDuration') || 20)),
      startTime: String(data.get('startTime') || '09:00'),
      courtCount: Math.max(1, Number(data.get('courtCount') || currentState.settings.courtCount || 1))
    },
    groups: buildGroups(players, groupCount, currentState.groups || []),
    bracket: markBracketStale(currentState.bracket)
  };
}

function render(state) {
  const normalizedPlayers = syncPlayersToCount(state.players || [], state.settings.participantCount || state.players.length || 0);
  if (normalizedPlayers.length !== state.players.length || normalizedPlayers.some((player, index) => player.color !== state.players[index]?.color)) {
    setState({ ...state, players: normalizedPlayers });
    return;
  }

  const { participantCount, suggestedGroups, effectiveGroups } = getEffectiveGroups(state);
  const duration = getTournamentDurationSummary({ ...state, groups: effectiveGroups });
  const qualified = getQualifiedPlayers({ ...state, groups: effectiveGroups }, state.settings.qualifierMode);
  const completedGroupMatches = (effectiveGroups || []).reduce((total, group) => total + (group.matches || []).filter((match) => getMatchOutcome(match).finished).length, 0);
  const completedBracketMatches = (state.bracket?.rounds || []).reduce((total, round) => total + (round.matches || []).filter((match) => getMatchOutcome(match).finished).length, 0);
  const completedMatches = completedGroupMatches + completedBracketMatches;
  const remainingMatches = Math.max(0, (duration.groupMatches + duration.bracketMatches) - completedMatches);
  const progressPercent = (duration.groupMatches + duration.bracketMatches) ? Math.round((completedMatches / (duration.groupMatches + duration.bracketMatches)) * 100) : 0;
  const projectedEndTime = participantCount
    ? (completedMatches > 0
      ? addMinutesToTime(new Date().toTimeString().slice(0, 5), Math.ceil(remainingMatches / Math.max(1, Number(state.settings.courtCount || 1))) * Number(state.settings.matchDuration || 20))
      : addMinutesToTime(state.settings.startTime, duration.totalMinutes))
    : '—';

  content.innerHTML = `
    <section class="hero-grid settings-layout">
      <article class="card settings-main-card">
        <div class="section-title">
          <div>
            <h2>Paramètres du tournoi</h2>
            <p>Indiquez le nombre de participants / équipes, puis appliquez les paramètres. Les équipes provisoires sont créées automatiquement.</p>
          </div>
          
        </div>

        <form id="settings-form" class="form-grid">
          <div class="field">
            <label for="tournamentName">Nom du tournoi</label>
            <input id="tournamentName" name="tournamentName" type="text" value="${escapeHtml(state.settings.tournamentName)}">
          </div>
          <div class="field">
            <label for="participantCount">Nombre de participants / équipes</label>
            <input id="participantCount" name="participantCount" type="number" min="0" value="${participantCount}">
          </div>
          <div class="field">
            <label for="setPoints">Points par set</label>
            <select id="setPoints" name="setPoints">
              <option value="15" ${Number(state.settings.setPoints) === 15 ? 'selected' : ''}>15</option>
              <option value="21" ${Number(state.settings.setPoints) === 21 ? 'selected' : ''}>21</option>
            </select>
          </div>
          <div class="field">
            <label for="qualifierMode">Qualifiés pour le tableau</label>
            <select id="qualifierMode" name="qualifierMode">
              <option value="top1" ${state.settings.qualifierMode === 'top1' ? 'selected' : ''}>Premiers uniquement</option>
              <option value="top2" ${state.settings.qualifierMode === 'top2' ? 'selected' : ''}>Premiers + Seconds</option>
              <option value="top3" ${state.settings.qualifierMode === 'top3' ? 'selected' : ''}>Premiers + Seconds + Troisièmes</option>
            </select>
          </div>
          <div class="field">
            <label for="matchDuration">Durée moyenne d'un match (min)</label>
            <input id="matchDuration" name="matchDuration" type="number" min="1" value="${Number(state.settings.matchDuration || 20)}">
          </div>
          <div class="field">
            <label for="startTime">Heure de début</label>
            <input id="startTime" name="startTime" type="time" value="${escapeHtml(state.settings.startTime || '09:00')}">
          </div>
          <div class="field">
            <label for="courtCount">Nombre de terrains</label>
            <input id="courtCount" name="courtCount" type="number" min="1" value="${Number(state.settings.courtCount || 1)}">
          </div>
        </form>

        <div class="actions">
          <button id="apply-settings" class="btn btn-primary">Appliquer les paramètres</button>
          <button id="reset-app" class="btn btn-danger">Réinitialiser le tournoi</button>
        </div>
        ${flashMessage ? `<div class="save-feedback ${flashType}">${escapeHtml(flashMessage)}</div>` : ''}

        <div class="projection-panel">
          <div class="section-title projection-title">
            <div>
              <h3>Projection automatique</h3>
              <p>L'heure de fin s'ajuste selon l'avancement : avant le début elle est calculée depuis l'heure de départ, puis dès qu'un match est validé elle se recalcule à partir des matchs restants.</p>
            </div>
          </div>
          <div class="kpis compact-kpis">
            <div class="kpi">
              <div class="label">Participants</div>
              <div class="value">${participantCount}</div>
            </div>
            <div class="kpi">
              <div class="label">Poules conseillées</div>
              <div class="value">${suggestedGroups}</div>
            </div>
            <div class="kpi">
              <div class="label">Matchs prévus</div>
              <div class="value">${duration.groupMatches + duration.bracketMatches}</div>
            </div>
            <div class="kpi">
              <div class="label">Progression</div>
              <div class="value">${completedMatches} / ${duration.groupMatches + duration.bracketMatches}</div>
            </div>
            <div class="kpi">
              <div class="label">Matchs restants</div>
              <div class="value">${remainingMatches}</div>
            </div>
            <div class="kpi">
              <div class="label">Fin estimée</div>
              <div class="value">${completedMatches > 0 ? 'Maintenant' : (state.settings.startTime || '09:00').slice(0, 5)} → ${projectedEndTime}</div>
            </div>
            <div class="kpi">
              <div class="label">Terrains pris en compte</div>
              <div class="value">${Math.max(1, Number(state.settings.courtCount || 1))}</div>
            </div>
          </div>
          <div class="summary-list compact-summary">
            <div class="summary-item"><span>Poules générées</span><strong>${effectiveGroups.length || suggestedGroups}</strong></div>
            <div class="summary-item"><span>Matchs de poules</span><strong>${duration.groupMatches}</strong></div>
            <div class="summary-item"><span>Matchs de tableau</span><strong>${duration.bracketMatches}</strong></div>
            <div class="summary-item"><span>Qualifiés projetés</span><strong>${qualified.length}</strong></div>
          </div>
          <div class="progress-card">
            <div class="progress-head">
              <strong>Progression du tournoi</strong>
              <span>${progressPercent}%</span>
            </div>
            <div class="progress-meter"><div class="progress-fill" style="width:${progressPercent}%;"></div></div>
            <div class="progress-meta">
              <span>${completedMatches} match(s) validé(s)</span>
              <span>${remainingMatches} restant(s)</span>
            </div>
          </div>
        </div>
      </article>

      <article class="card">
        <div class="section-title">
          <div>
            <h2>Composition des poules</h2>
            <p>Renommez les équipes, ouvrez le sélecteur de couleur puis validez, et déplacez les cartes entre les poules pour réajuster la composition avant de passer à la page Poules.</p>
          </div>

        </div>
        ${renderGroupsOverview(effectiveGroups, state.players)}
        
      </article>
    </section>
    `;

  bindEvents();
  bindSidebarPersistence();
}

function bindEvents() {
  document.getElementById('apply-settings')?.addEventListener('click', () => {
    setState(buildStateFromForm());
    setFlash('Paramètres appliqués et sauvegardés en local.');
  });

  document.getElementById('reset-app')?.addEventListener('click', () => {
    if (!window.confirm('Réinitialiser tout le tournoi ?')) return;
    resetAppState();
  });

  const queueNameUpdate = debounce((playerId, value) => {
    const currentState = getState();
    setState({
      ...currentState,
      players: currentState.players.map((player) => (
        player.id === playerId ? { ...player, name: value.trim() || player.name } : player
      )),
      bracket: markBracketStale(currentState.bracket)
    });
  }, 220);

  document.querySelectorAll('[data-player-name]').forEach((input) => {
    input.addEventListener('input', () => queueNameUpdate(input.dataset.playerName, input.value));
    input.addEventListener('blur', () => {
      const currentState = getState();
      setState({
        ...currentState,
        players: currentState.players.map((player) => (
          player.id === input.dataset.playerName ? { ...player, name: input.value.trim() || player.name } : player
        )),
        bracket: markBracketStale(currentState.bracket)
      });
    });
  });

  document.querySelectorAll('[data-color-trigger]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      openColorPopoverFor = openColorPopoverFor === button.dataset.colorTrigger ? null : button.dataset.colorTrigger;
      render(getState());
    });
  });

  document.querySelectorAll('[data-color-cancel]').forEach((button) => {
    button.addEventListener('click', () => {
      openColorPopoverFor = null;
      render(getState());
    });
  });

  document.querySelectorAll('[data-color-apply]').forEach((button) => {
    button.addEventListener('click', () => {
      const playerId = button.dataset.colorApply;
      const picker = document.querySelector(`[data-player-color-picker="${playerId}"]`);
      if (!picker) return;
      const currentState = getState();
      openColorPopoverFor = null;
      setState({
        ...currentState,
        players: currentState.players.map((player) => (
          player.id === playerId ? { ...player, color: picker.value } : player
        )),
        bracket: markBracketStale(currentState.bracket)
      });
    });
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('.team-color-popover') || target.closest('[data-color-trigger]')) return;
    if (openColorPopoverFor) {
      openColorPopoverFor = null;
      render(getState());
    }
  }, { once: true });

  document.querySelectorAll('.team-card[draggable="true"]').forEach((card) => {
    card.addEventListener('dragstart', () => {
      draggedPlayerId = card.dataset.playerId;
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      draggedPlayerId = null;
    });
  });

  document.querySelectorAll('.settings-group-dropzone').forEach((zone) => {
    zone.addEventListener('dragover', (event) => {
      event.preventDefault();
      zone.classList.add('dragover');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (event) => {
      event.preventDefault();
      zone.classList.remove('dragover');
      if (!draggedPlayerId) return;
      const currentState = getState();
      const sourceGroup = currentState.groups.find((group) => group.playerIds.includes(draggedPlayerId));
      const targetGroup = zone.dataset.groupId;
      if (!sourceGroup || sourceGroup.id === targetGroup) return;
      setState({
        ...movePlayerBetweenGroups(currentState, draggedPlayerId, targetGroup),
        bracket: markBracketStale(currentState.bracket)
      });
    });
  });
}

subscribe(render);
