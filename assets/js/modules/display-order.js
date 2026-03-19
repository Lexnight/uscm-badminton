
import { escapeHtml, renderPlayerBadge, playerColor } from './ui.js';
import { addMinutesToTime } from './utils.js';
import { getTournamentTimingState } from './calculations.js';
import { getLiveOrderState } from './schedule.js';

function renderMatchCard(state, entry, courtLabel, compact = false) {
  if (!entry) {
    return `
      <article class="match-card-enhanced live-court-card ${compact ? 'compact' : ''}">
        <div class="court-chip">${escapeHtml(courtLabel)}</div>
        <h3>En attente</h3>
        
      </article>
    `;
  }
  const aName = renderPlayerBadge(state.players, entry.match.player1Id, { compact: true, fallback: 'À définir' });
  const bName = renderPlayerBadge(state.players, entry.match.player2Id, { compact: true, fallback: 'À définir' });
  return `
    <article class="match-card-enhanced live-court-card ${compact ? 'compact' : ''}">
      <div class="court-chip">${escapeHtml(courtLabel)}</div>
      <h3>${escapeHtml(entry.phaseLabel)}</h3>
      <div class="live-match-lines">
        <div>${aName}</div>
        <div class="versus">vs</div>
        <div>${bName}</div>
      </div>
      
    </article>
  `;
}

export function renderOrderDashboard(state, options = {}) {
  const { publicView = false } = options;
  const live = getLiveOrderState(state);
  const duration = getTournamentTimingState(state);
  const endTime = duration.projectedEndTime;

  return `
    <section class="hero-grid order-layout ${publicView ? 'public-order-layout' : ''}">
      <div class="order-main-stack">
        <article class="card public-priority-card">
          <div class="section-title">
            <div>
              <h2>${publicView ? 'Matchs en cours' : 'Pilotage des terrains'}</h2>
              <p>${publicView ? "Affichage en direct pour les compétiteurs." : "Les matchs en cours sont affectés automatiquement selon le nombre de terrains. Dès qu'un match est terminé, le suivant remonte tout seul, avec une logique qui évite autant que possible qu'une même équipe rejoue immédiatement."}</p>
            </div>
            
          </div>

          <div class="kpis compact-kpis">
            <div class="kpi">
              <div class="label">Progression globale</div>
              <div class="value">${live.progress}%</div>
            </div>
            <div class="kpi">
              <div class="label">Matchs terminés</div>
              <div class="value">${live.finishedCount} / ${live.totalCount}</div>
            </div>
            <div class="kpi">
              <div class="label">Début / fin estimée</div>
              <div class="value">${escapeHtml((state.settings.startTime || '09:00').slice(0,5))} → ${escapeHtml(endTime)}</div>
            </div>
            <div class="kpi">
              <div class="label">Tournoi</div>
              <div class="value">${escapeHtml(state.settings.tournamentName || 'Tournoi')}</div>
            </div>
          </div>

          <div class="progress-card tight">
            <div class="progress-head">
              <strong>Avancement du tournoi</strong>
              <span>${live.progress}%</span>
            </div>
            <div class="progress-meter"><div class="progress-fill" style="width:${live.progress}%;"></div></div>
            <div class="progress-meta">
              <span>${live.finishedCount} match(s) terminés</span>
              <span>${Math.max(0, live.totalCount - live.finishedCount)} restant(s)</span>
            </div>
          </div>

          <div class="live-courts-grid ${publicView ? 'public-live-courts-grid' : ''}">
            ${Array.from({ length: live.courtCount }, (_, index) => renderMatchCard(state, live.current[index], `Terrain ${index + 1}`)).join('')}
          </div>
        </article>

        <article class="card">
          <div class="section-title">
            <div>
              <h2>4 prochains matchs</h2>
              <p>${publicView ? 'Préparez-vous : voici les prochains appels.' : 'Pré-affectation automatique des prochains appels.'}</p>
            </div>
          </div>
          <div class="upcoming-grid">
            ${live.next.length ? live.next.map((entry) => renderMatchCard(state, entry, `Terrain ${entry.assignedCourt}`, true)).join('') : '<div class="empty-state small">Pas encore de prochains matchs disponibles.</div>'}
          </div>
        </article>

        ${publicView ? '' : `
        <article class="card">
          <div class="section-title">
            <div>
              <h2>Liste complète des matchs</h2>
              <p>Ordonnancement cyclique des poules : A puis B puis C, puis on recommence. Le tableau final s’ajoute ensuite.</p>
            </div>
          </div>
          <div class="table-wrap">
            <table class="ordered-matches-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Phase</th>
                  <th>Match</th>
                  <th>État</th>
                </tr>
              </thead>
              <tbody>
                ${live.order.length ? live.order.map((entry) => `
                  <tr class="${entry.finished ? 'is-finished' : ''}">
                    <td>${entry.absoluteIndex}</td>
                    <td>${escapeHtml(entry.phaseLabel)}</td>
                    <td>
                      <div class="badge-player-inline">
                        <span class="player-dot tiny" style="--player-color:${playerColor(state.players, entry.match.player1Id, 0)};"></span>
                        <span>${escapeHtml(entry.match.player1Id ? (state.players.find((p) => p.id === entry.match.player1Id)?.name || 'À définir') : 'À définir')}</span>
                        <span class="score-separator-inline">vs</span>
                        <span class="player-dot tiny" style="--player-color:${playerColor(state.players, entry.match.player2Id, 1)};"></span>
                        <span>${escapeHtml(entry.match.player2Id ? (state.players.find((p) => p.id === entry.match.player2Id)?.name || 'À définir') : 'À définir')}</span>
                      </div>
                    </td>
                    <td><span class="status-pill ${entry.finished ? 'done' : 'todo'}">${entry.finished ? 'Terminé' : (entry.playable ? 'À jouer' : 'En attente')}</span></td>
                  </tr>
                `).join('') : '<tr><td colspan="4">Aucun match planifié.</td></tr>'}
              </tbody>
            </table>
          </div>
        </article>`}
      </div>

      <aside class="card ${publicView ? 'public-ranking-card' : ''}">
        <div class="section-title">
          <div>
            <h2>Classement général</h2>
            <p>Top 8 mis à jour automatiquement.</p>
          </div>
          
        </div>
        <div class="ranking-stack">
          ${live.ranking.length ? live.ranking.map((row) => `
            <div class="ranking-row">
              <div class="ranking-rank">${row.rank}</div>
              <div class="ranking-name">${renderPlayerBadge(state.players, row.playerId, { compact: true })}</div>
              <div class="ranking-points">
                <strong>${row.rankingPoints}</strong>
                <small>pts</small>
              </div>
            </div>
          `).join('') : '<div class="empty-state small">Le classement apparaîtra ici.</div>'}
        </div>
      </aside>
    </section>
  `;
}
