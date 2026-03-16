import { subscribe } from './modules/app.js';
import { mountShell, escapeHtml, renderPlayerBadge } from './modules/ui.js';
import { calculateGeneralStats, getTournamentDurationSummary, getChampion, calculateAllGroupStandings } from './modules/calculations.js';
import { addMinutesToTime, sortNames } from './modules/utils.js';

const content = mountShell({
  activePage: 'statistiques',
  title: 'Classement général et statistiques',
  subtitle: 'Vision consolidée de tout le tournoi : poules, tableau et timing.'
});

function render(state) {
  const rows = calculateGeneralStats(state);
  const duration = getTournamentDurationSummary(state);
  const champion = getChampion(state);
  const groupStandings = calculateAllGroupStandings(state);
  const completedGroups = (state.groups || []).reduce(
    (total, group) => total + group.matches.filter((match) => match.sets?.some((set) => set?.a !== '' && set?.b !== '')).length,
    0
  );

  const mostVictories = [...rows].sort((a, b) => b.wins - a.wins || sortNames(a.name, b.name))[0];
  const bestDifference = [...rows].sort((a, b) => b.pointDiff - a.pointDiff || sortNames(a.name, b.name))[0];
  const bracketCompleted = (state.bracket?.rounds || []).reduce((total, round) => total + (round.matches || []).filter((match) => match?.winnerId).length, 0);
  const overallCompleted = completedGroups + bracketCompleted;
  const overallProgress = duration.totalMatches ? Math.round((overallCompleted / duration.totalMatches) * 100) : 0;

  const playerCell = (playerId) => renderPlayerBadge(state.players, playerId, { compact: true, fallback: 'À définir' });

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
            <div class="label">Durée estimée</div>
            <div class="value">${Math.round(duration.totalMinutes / 60)} h</div>
          </div>
          <div class="kpi">
            <div class="label">Heure de fin</div>
            <div class="value">${addMinutesToTime(state.settings.startTime, duration.totalMinutes)}</div>
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
          <p>Le tri se fait d'abord sur les points de classement, puis sur la moyenne de points marqués par match.</p>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Joueur</th>
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
            ${rows.length ? rows.map((row) => `
              <tr>
                <td><span class="rank-chip">${row.rank}</span></td>
                <td>${playerCell(row.playerId)}</td>
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
            `).join('') : '<tr><td colspan="11" class="muted">Aucune donnée disponible.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>

    <section class="grid-2" style="margin-top:18px;">
      <article class="card">
        <div class="section-title">
          <div>
            <h2>Détail par joueur</h2>
            <p>Pour vérifier rapidement chaque bilan individuel, y compris les points de classement gagnés en poules.</p>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Joueur</th>
                <th>Pts classement</th>
                <th>Pts / match</th>
                <th>V / D</th>
                <th>Sets</th>
                <th>Diff. sets</th>
                <th>Diff. points</th>
              </tr>
            </thead>
            <tbody>
              ${rows.length ? rows.map((row) => `
                <tr>
                  <td>${playerCell(row.playerId)}</td>
                  <td><strong>${row.rankingPoints}</strong></td>
                  <td>${row.avgPointsPerMatch.toFixed(2)}</td>
                  <td>${row.wins} / ${row.losses}</td>
                  <td>${row.setsWon}-${row.setsLost}</td>
                  <td>${row.setDiff > 0 ? '+' : ''}${row.setDiff}</td>
                  <td>${row.pointDiff > 0 ? '+' : ''}${row.pointDiff}</td>
                </tr>
              `).join('') : '<tr><td colspan="7" class="muted">Aucun joueur.</td></tr>'}
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
                <span class="badge">Top 3</span>
              </div>
              <ol>
                ${group.standings.slice(0, 3).map((row) => `<li>${escapeHtml(row.name)} · ${row.rankingPoints} pts classement · ${row.avgPointsPerMatch.toFixed(2)} pts/match</li>`).join('') || '<li class="muted">Pas encore de classement.</li>'}
              </ol>
            </div>
          `).join('') : '<p class="muted">Aucune poule générée.</p>'}
        </div>
      </article>
    </section>
  `;
}

subscribe(render);
