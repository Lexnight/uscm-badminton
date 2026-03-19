
import { escapeHtml, renderPlayerBadge, playerColor } from './ui.js';
import { addMinutesToTime } from './utils.js';
import { getTournamentTimingState } from './calculations.js';
import { getLiveOrderState } from './schedule.js';

function renderCourtCard(state, entry, index) {
  if (!entry) {
    return `
      <article class="card regie-court-card waiting">
        <div class="regie-court-head">
          <span class="regie-court-label">Terrain ${index + 1}</span>
          <span class="regie-status-pill muted">En attente</span>
        </div>
        <div class="regie-court-empty">
          <i class="fa-regular fa-circle-pause"></i>
          <strong>Aucun match à lancer</strong>
          <p>La régie prendra automatiquement le prochain match disponible.</p>
        </div>
      </article>
    `;
  }

  const playerA = renderPlayerBadge(state.players, entry.match.player1Id, { compact: true, fallback: 'À définir' });
  const playerB = renderPlayerBadge(state.players, entry.match.player2Id, { compact: true, fallback: 'À définir' });

  return `
    <article class="card regie-court-card live">
      <div class="regie-court-head">
        <span class="regie-court-label">Terrain ${index + 1}</span>
        <span class="regie-status-pill live">En cours</span>
      </div>
      <h3>${escapeHtml(entry.phaseLabel)}</h3>
      <div class="regie-match-body">
        <div class="regie-match-player">${playerA}</div>
        <div class="regie-versus">VS</div>
        <div class="regie-match-player">${playerB}</div>
      </div>
      <div class="regie-meta-row">
        <span><i class="fa-regular fa-flag"></i> Match #${entry.absoluteIndex}</span>
        <span><i class="fa-regular fa-clock"></i> Assigné automatiquement</span>
      </div>
    </article>
  `;
}

function renderUpcomingCard(state, entry, idx) {
  const playerAName = state.players.find((p) => p.id === entry.match.player1Id)?.name || 'À définir';
  const playerBName = state.players.find((p) => p.id === entry.match.player2Id)?.name || 'À définir';
  return `
    <article class="card regie-upcoming-card">
      <div class="regie-upcoming-top">
        <span class="regie-status-pill next">À suivre</span>
        <span class="regie-order-chip">#${entry.absoluteIndex}</span>
      </div>
      <strong>${escapeHtml(entry.phaseLabel)}</strong>
      <div class="regie-upcoming-line">
        <span class="player-dot tiny" style="--player-color:${playerColor(state.players, entry.match.player1Id, 0)};"></span>
        <span>${escapeHtml(playerAName)}</span>
      </div>
      <div class="regie-upcoming-line">
        <span class="player-dot tiny" style="--player-color:${playerColor(state.players, entry.match.player2Id, 1)};"></span>
        <span>${escapeHtml(playerBName)}</span>
      </div>
      <div class="footer-note">Proposé pour terrain ${(idx % Math.max(1, Number(state.settings?.courtCount || 1))) + 1}</div>
    </article>
  `;
}

export function renderRegieDashboard(state, options = {}) {
  const { standalone = false } = options;
  const live = getLiveOrderState(state);
  const duration = getTournamentTimingState(state);
  const endTime = duration.projectedEndTime;

  const body = `
    <section class="regie-grid regie-grid-priority">
      <aside class="regie-side regie-side-priority">
        <article class="card regie-ranking-card">
          <div class="section-title">
            <div>
              <h2>Classement général complet</h2>
            </div>
          </div>
          <div class="ranking-stack regie-ranking-scroll">
            ${live.ranking.length ? live.ranking.map((row) => `
              <div class="ranking-row">
                <div class="ranking-rank">${row.rank}</div>
                <div class="ranking-name">${renderPlayerBadge(state.players, row.playerId, { compact: true })}</div>
                <div class="ranking-points"><strong>${row.rankingPoints}</strong><small>pts</small></div>
              </div>
            `).join('') : '<div class="empty-state small">Le classement complet apparaîtra ici.</div>'}
          </div>
        </article>
      </aside>

      <section class="regie-main regie-main-priority">
        <article class="card regie-hero-card regie-hero-compact">
          <div class="regie-hero-top">
            <div>
              <div class="page-kicker">Contrôle tournoi en direct</div>
              <h2>Régie terrain</h2>
            </div>
            <div class="regie-hero-badges">
              <span class="badge"><i class="fa-solid fa-table-cells-large"></i> ${live.courtCount} terrain(x)</span>
              <span class="badge"><i class="fa-solid fa-list-check"></i> ${live.totalCount} match(s)</span>
              <span class="badge"><i class="fa-regular fa-clock"></i> ${escapeHtml((state.settings.startTime || '09:00').slice(0,5))} → ${escapeHtml(endTime)}</span>
            </div>
          </div>

          <div class="regie-kpis">
            <div class="kpi"><div class="label">Avancement global</div><div class="value">${live.progress}%</div></div>
            <div class="kpi"><div class="label">Terminés</div><div class="value">${live.finishedCount} / ${live.totalCount}</div></div>
            <div class="kpi"><div class="label">Terrains</div><div class="value">${live.courtCount}</div></div>
            <div class="kpi"><div class="label">Matchs restants</div><div class="value">${Math.max(0, live.totalCount - live.finishedCount)}</div></div>
          </div>

          <div class="progress-card tight regie-progress-inline">
            <div class="progress-meter"><div class="progress-fill" style="width:${live.progress}%;"></div></div>
          </div>
        </article>

        <section class="regie-courts-grid regie-courts-priority">
          ${Array.from({ length: live.courtCount }, (_, index) => renderCourtCard(state, live.current[index], index)).join('')}
        </section>

        <article class="card">
          <div class="section-title">
            <div>
              <h2>4 prochains matchs</h2>
            </div>
          </div>
          <div class="regie-upcoming-grid">
            ${live.next.length ? live.next.map((entry, idx) => renderUpcomingCard(state, entry, idx)).join('') : '<div class="empty-state small">Aucun prochain match disponible pour le moment.</div>'}
          </div>
        </article>

        <article class="card">
          <div class="section-title">
            <div>
              <h2>Ordre complet</h2>
            </div>
          </div>
          <div class="table-wrap regie-table-wrap">
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
                    <td>${escapeHtml(entry.label)}</td>
                    <td><span class="status-pill ${entry.finished ? 'done' : 'todo'}">${entry.finished ? 'Terminé' : (entry.playable ? 'À jouer' : 'En attente')}</span></td>
                  </tr>
                `).join('') : '<tr><td colspan="4">Aucun match planifié.</td></tr>'}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </section>
  `;

  if (standalone) {
    return `
      <div class="regie-standalone-shell fade-in">
        ${body}
      </div>
    `;
  }

  return body;
}
