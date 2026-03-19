
import { subscribe } from './modules/app.js';
import { mountShell, escapeHtml, renderPlayerBadge } from './modules/ui.js';
import { bindSidebarPersistence } from './modules/save-controls.js';
import { bindCustomSelects } from './modules/custom-selects.js';
import { calculateGeneralStats, getTournamentTimingState, getChampion, calculateAllGroupStandings, getMatchOutcome } from './modules/calculations.js';
import { sortNames } from './modules/utils.js';

const content = mountShell({
  activePage: 'statistiques',
  title: 'Classement général et statistiques',
  subtitle: 'Vision consolidée de tout le tournoi : poules, tableau et timing.'
});

let activeFilter = 'all';
let activeSort = 'default';

function getGroupByPlayerId(state) {
  const map = new Map();
  for (const group of state.groups || []) {
    for (const playerId of group.playerIds || []) {
      map.set(playerId, group.name);
    }
  }
  return map;
}

function getFilterOptions(state) {
  const groups = (state.groups || []).map((group) => ({
    value: `group:${group.id}`,
    label: group.name
  }));
  return [
    { value: 'all', label: 'Tous' },
    { value: 'bracket', label: 'Tableau' },
    { value: 'pools', label: 'Poules uniquement' },
    ...groups
  ];
}

function applyRankingFilter(rows, state) {
  if (activeFilter === 'all') return rows;

  if (activeFilter === 'bracket') {
    return rows.filter((row) => row.bracketPlacementLabel && row.bracketPlacementLabel !== 'Poules');
  }

  if (activeFilter === 'pools') {
    return rows.filter((row) => !row.bracketPlacementLabel || row.bracketPlacementLabel === 'Poules');
  }

  if (activeFilter.startsWith('group:')) {
    const groupId = activeFilter.split(':')[1];
    const group = (state.groups || []).find((entry) => entry.id === groupId);
    const ids = new Set(group?.playerIds || []);
    return rows.filter((row) => ids.has(row.playerId));
  }

  return rows;
}

function applyRankingSort(rows) {
  const sorted = [...rows];

  if (activeSort === 'default') return sorted;

  sorted.sort((left, right) => {
    if (activeSort === 'rankingPoints') {
      if (right.rankingPoints !== left.rankingPoints) return right.rankingPoints - left.rankingPoints;
      if (right.pointsWon !== left.pointsWon) return right.pointsWon - left.pointsWon;
      return sortNames(left.name, right.name);
    }
    if (activeSort === 'pointsWon') {
      if (right.pointsWon !== left.pointsWon) return right.pointsWon - left.pointsWon;
      if (right.rankingPoints !== left.rankingPoints) return right.rankingPoints - left.rankingPoints;
      return sortNames(left.name, right.name);
    }
    if (activeSort === 'wins') {
      if (right.wins !== left.wins) return right.wins - left.wins;
      if (right.rankingPoints !== left.rankingPoints) return right.rankingPoints - left.rankingPoints;
      return sortNames(left.name, right.name);
    }
    if (activeSort === 'setDiff') {
      if (right.setDiff !== left.setDiff) return right.setDiff - left.setDiff;
      if (right.rankingPoints !== left.rankingPoints) return right.rankingPoints - left.rankingPoints;
      return sortNames(left.name, right.name);
    }
    return 0;
  });

  return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}

function render(state) {
  const rows = calculateGeneralStats(state);
  const duration = getTournamentTimingState(state);
  const champion = getChampion(state);
  const groupStandings = calculateAllGroupStandings(state);
  const completedGroups = (state.groups || []).reduce(
    (total, group) => total + (group.matches || []).filter((match) => getMatchOutcome(match).finished).length,
    0
  );

  const mostVictories = [...rows].sort((a, b) => b.wins - a.wins || sortNames(a.name, b.name))[0];
  const bestDifference = [...rows].sort((a, b) => b.pointDiff - a.pointDiff || sortNames(a.name, b.name))[0];
  const bracketCompleted = (state.bracket?.rounds || []).reduce((total, round) => total + (round.matches || []).filter((match) => match?.winnerId).length, 0);
  const overallCompleted = completedGroups + bracketCompleted;
  const overallProgress = duration.totalMatches ? Math.round((overallCompleted / duration.totalMatches) * 100) : 0;

  const playerCell = (playerId) => renderPlayerBadge(state.players, playerId, { compact: true, fallback: 'À définir' });
  const filterOptions = getFilterOptions(state);
  const filteredRows = applyRankingSort(applyRankingFilter(rows, state));

  content.innerHTML = `
    <section class="grid-3">
      <article class="card">
        <h2>Résumé tournoi</h2>
        <div class="kpis">
          <div class="kpi">
            <div class="label">Matchs planifiés</div>
            <div class="value">${duration.totalMatches}</div>
          </div>
          <div class="kpi">
            <div class="label">Temps restant estimé</div>
            <div class="value">${Math.round(duration.remainingMinutes / 60)} h</div>
          </div>
          <div class="kpi">
            <div class="label">Heure de fin estimée</div>
            <div class="value">${duration.projectedEndTime}</div>
          </div>
        </div>
      </article>

      <article class="card">
        <h2>Leaders</h2>
        <div class="kpis">
          <div class="kpi">
            <div class="label">Champion</div>
            <div class="value" style="font-size:1.15rem;">${champion ? renderPlayerBadge(state.players, champion.id, { compact: true }) : 'À venir'}</div>
          </div>
          <div class="kpi">
            <div class="label">Plus de victoires</div>
            <div class="value" style="font-size:1.15rem;">${mostVictories ? renderPlayerBadge(state.players, mostVictories.playerId, { compact: true }) : '—'}</div>
          </div>
          <div class="kpi">
            <div class="label">Meilleure différence</div>
            <div class="value" style="font-size:1.15rem;">${bestDifference ? renderPlayerBadge(state.players, bestDifference.playerId, { compact: true }) : '—'}</div>
          </div>
        </div>
      </article>

      <article class="card">
        <h2>Progression</h2>
        <div class="kpis">
          <div class="kpi">
            <div class="label">Matchs de poules saisis</div>
            <div class="value">${completedGroups}</div>
          </div>
          <div class="kpi">
            <div class="label">Poules actives</div>
            <div class="value">${state.groups.length}</div>
          </div>
          <div class="kpi">
            <div class="label">Participants</div>
            <div class="value">${state.players.length}</div>
          </div>
        </div>
        <div class="progress-card tight">
          <div class="progress-head">
            <strong>Progression globale du tournoi</strong>
            <span>${overallProgress}%</span>
          </div>
          <div class="progress-meter"><div class="progress-fill" style="width:${overallProgress}%;"></div></div>
          <div class="progress-meta">
            <span>${overallCompleted} match(s) terminés</span>
            <span>${Math.max(0, duration.totalMatches - overallCompleted)} restant(s)</span>
          </div>
        </div>
      </article>
    </section>

    <section class="card" style="margin-top:18px;">
      <div class="section-title">
        <div>
          <h2>Classement général</h2>
          <p>Filtre et tri du classement consolidé.</p>
        </div>
      </div>

      <div class="ranking-filter-bar">
        <div class="field">
          <label for="rankingFilter">Filtre</label>
          <select id="rankingFilter">
            ${filterOptions.map((option) => `<option value="${escapeHtml(option.value)}" ${activeFilter === option.value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label for="rankingSort">Tri</label>
          <select id="rankingSort">
            <option value="default" ${activeSort === 'default' ? 'selected' : ''}>Classement par défaut</option>
            <option value="rankingPoints" ${activeSort === 'rankingPoints' ? 'selected' : ''}>Points de classement</option>
            <option value="pointsWon" ${activeSort === 'pointsWon' ? 'selected' : ''}>Points marqués</option>
            <option value="wins" ${activeSort === 'wins' ? 'selected' : ''}>Victoires</option>
            <option value="setDiff" ${activeSort === 'setDiff' ? 'selected' : ''}>Différence de sets</option>
          </select>
        </div>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Joueur</th>
              <th>Poule</th>
              <th>Place finale</th>
              <th>Pts classement</th>
              <th>Pts / match</th>
              <th>Matchs</th>
              <th>V</th>
              <th>D</th>
              <th>Sets G/P</th>
              <th>Points marqués</th>
              <th>Points encaissés</th>
              <th>Diff.</th>
            </tr>
          </thead>
          <tbody>
            ${filteredRows.length ? filteredRows.map((row) => `
              <tr>
                <td><span class="rank-chip">${row.rank}</span></td>
                <td>${playerCell(row.playerId)}</td>
                <td>${escapeHtml((state.groups || []).find((group) => (group.playerIds || []).includes(row.playerId))?.name || '—')}</td>
                <td>${row.bracketPlacementLabel || 'Poules'}</td>
                <td><strong>${row.rankingPoints}</strong></td>
                <td>${row.avgPointsPerMatch.toFixed(2)}</td>
                <td>${row.played}</td>
                <td>${row.wins}</td>
                <td>${row.losses}</td>
                <td>${row.setsWon}/${row.setsLost}</td>
                <td>${row.pointsWon}</td>
                <td>${row.pointsLost}</td>
                <td>${row.pointDiff > 0 ? '+' : ''}${row.pointDiff}</td>
              </tr>
            `).join('') : '<tr><td colspan="13" class="muted">Aucune donnée disponible.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>

    <section class="grid-2" style="margin-top:18px;">
      <article class="card">
        <div class="section-title">
          <div>
            <h2>Détail par joueur</h2>
            <p>Pour vérifier rapidement chaque bilan individuel.</p>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Joueur</th>
                <th>Place finale</th>
                <th>Pts classement</th>
                <th>Pts / match</th>
                <th>V / D</th>
                <th>Sets</th>
                <th>Diff. sets</th>
                <th>Diff. points</th>
              </tr>
            </thead>
            <tbody>
              ${filteredRows.length ? filteredRows.map((row) => `
                <tr>
                  <td>${playerCell(row.playerId)}</td>
                  <td>${row.bracketPlacementLabel || 'Poules'}</td>
                  <td><strong>${row.rankingPoints}</strong></td>
                  <td>${row.avgPointsPerMatch.toFixed(2)}</td>
                  <td>${row.wins} / ${row.losses}</td>
                  <td>${row.setsWon}-${row.setsLost}</td>
                  <td>${row.setDiff > 0 ? '+' : ''}${row.setDiff}</td>
                  <td>${row.pointDiff > 0 ? '+' : ''}${row.pointDiff}</td>
                </tr>
              `).join('') : '<tr><td colspan="8" class="muted">Aucun joueur.</td></tr>'}
            </tbody>
          </table>
        </div>
      </article>

      <article class="card">
        <div class="section-title">
          <div>
            <h2>Podiums par poule</h2>
            <p>Extrait des classements internes de chaque poule.</p>
          </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:12px;">
          ${groupStandings.length ? groupStandings.map((group) => `
            <div class="match-card">
              <div class="row-between">
                <strong>${escapeHtml(group.groupName)}</strong>
              </div>
              <ol>
                ${group.standings.slice(0, 3).map((row) => `<li>${escapeHtml(row.name)} · ${row.rankingPoints} pts classement · ${row.avgPointsPerMatch.toFixed(2)} pts/match</li>`).join('') || '<li class="muted">Pas encore de classement.</li>'}
              </ol>
            </div>
          `).join('') : ''}
        </div>
      </article>
    </section>
  `;

  document.getElementById('rankingFilter')?.addEventListener('change', (event) => {
    activeFilter = event.currentTarget.value;
    render(state);
  });

  document.getElementById('rankingSort')?.addEventListener('change', (event) => {
    activeSort = event.currentTarget.value;
    render(state);
  });

  bindCustomSelects();
  bindSidebarPersistence();
}

subscribe(render);
