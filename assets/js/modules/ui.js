import { byId } from './utils.js';

const PLAYER_COLOR_PALETTE = [
  '#ff7a00', '#2563eb', '#16a34a', '#dc2626', '#7c3aed', '#0891b2', '#e11d48', '#ca8a04', '#4f46e5', '#0f766e'
];

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function playerName(players, playerId, fallback = 'À définir') {
  return byId(players, playerId)?.name || fallback;
}

export function defaultPlayerColor(index = 0) {
  return PLAYER_COLOR_PALETTE[Math.abs(Number(index) || 0) % PLAYER_COLOR_PALETTE.length];
}

export function playerColor(players = [], playerId = '', fallbackIndex = 0) {
  const player = byId(players, playerId);
  return player?.color || colorForPlayerId(playerId, fallbackIndex);
}

export function colorForPlayerId(playerId = '', fallbackIndex = 0) {
  const source = String(playerId || '');
  if (!source) return defaultPlayerColor(fallbackIndex);
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) - hash) + source.charCodeAt(index);
    hash |= 0;
  }
  return PLAYER_COLOR_PALETTE[Math.abs(hash) % PLAYER_COLOR_PALETTE.length];
}

export function renderPlayerBadge(players, playerId, options = {}) {
  const { compact = false, fallback = 'À définir' } = options;
  const color = playerColor(players, playerId);
  const name = playerName(players, playerId, fallback);
  return `
    <span class="player-badge ${compact ? 'compact' : ''}">
      <span class="player-dot ${compact ? 'tiny' : ''}" style="--player-color:${color};"></span>
      <span>${escapeHtml(name)}</span>
    </span>
  `;
}

export function renderNav(activePage) {
  const links = [
    { href: 'index.html', label: 'Paramètres', short: '⚙️', key: 'parametres' },
    { href: 'poules.html', label: 'Poules', short: '🏸', key: 'poules' },
    { href: 'tableau.html', label: 'Tableau', short: '🏆', key: 'tableau' },
    { href: 'ordre-de-jeu.html', label: 'Ordre de jeu', short: '📋', key: 'ordre' },
    { href: 'statistiques.html', label: 'Statistiques', short: '📈', key: 'statistiques' }
  ];

  return `
    <nav class="sidebar-nav">
      <div class="nav-inner vertical">
        ${links.map((link) => `
          <a class="nav-link nav-link-icon ${activePage === link.key ? 'active' : ''}" href="${link.href}" title="${link.label}" aria-label="${link.label}">
            <span class="nav-link-icon-glyph" aria-hidden="true">${link.short}</span>
          </a>
        `).join('')}
      </div>
    </nav>
  `;
}

export function mountShell({ activePage, title, subtitle }) {
  const shell = document.getElementById('app');
  shell.innerHTML = `
    <div class="app-shell app-shell-sidebar fade-in">
      <aside class="sidebar">
        <div class="brand brand-vertical">
          <img class="brand-logo" src="assets/img/logo-uscm.png" alt="Logo USCM Montereau">
          <div class="brand-copy">
            <span class="brand-kicker">Tournoi de badminton</span>
            <strong>${escapeHtml(title)}</strong>
            <p>${escapeHtml(subtitle)}</p>
          </div>
        </div>
        ${renderNav(activePage)}
      </aside>
      <div class="main-layout">
        <header class="topbar topbar-page">
          <div>
            <h1 class="page-title">${escapeHtml(title)}</h1>
            <p class="page-subtitle">${escapeHtml(subtitle)}</p>
          </div>
        </header>
        <main id="page-content"></main>
      </div>
    </div>
  `;
  return document.getElementById('page-content');
}
