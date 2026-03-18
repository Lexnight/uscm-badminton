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
    { href: 'index.html', label: 'Paramètres', icon: 'fa-solid fa-sliders', key: 'parametres' },
    { href: 'poules.html', label: 'Poules', icon: 'fa-solid fa-table-cells-large', key: 'poules' },
    { href: 'tableau.html', label: 'Tableau', icon: 'fa-solid fa-trophy', key: 'tableau' },
    { href: 'ordre-de-jeu.html', label: 'Ordre de jeu', icon: 'fa-solid fa-list-check', key: 'ordre' },
    { href: 'guide.html', label: 'Guide', icon: 'fa-solid fa-circle-info', key: 'guide' },
    { href: 'statistiques.html', label: 'Statistiques', icon: 'fa-solid fa-chart-simple', key: 'statistiques' }
  ];

  return `
    <nav class="sidebar-nav">
      <div class="nav-inner vertical">
        ${links.map((link) => `
          <a class="nav-link nav-link-icon ${activePage === link.key ? 'active' : ''}" href="${link.href}" title="${link.label}" aria-label="${link.label}">
            <i class="${link.icon}" aria-hidden="true"></i>
          </a>
        `).join('')}
      </div>

      <div class="sidebar-tools" aria-label="Sauvegarde">
        <button type="button" class="sidebar-action-btn sidebar-action-save" id="sidebar-save" title="Enregistrer" aria-label="Enregistrer">
          <i class="fa-solid fa-floppy-disk" aria-hidden="true"></i>
        </button>
        <button type="button" class="sidebar-action-btn" id="sidebar-export" title="Exporter JSON" aria-label="Exporter JSON">
          <i class="fa-solid fa-file-arrow-down" aria-hidden="true"></i>
        </button>
        <button type="button" class="sidebar-action-btn" id="sidebar-import" title="Importer JSON" aria-label="Importer JSON">
          <i class="fa-solid fa-file-arrow-up" aria-hidden="true"></i>
        </button>
        <input id="sidebar-import-input" type="file" accept="application/json,.json" hidden>
        <div id="sidebar-save-status" class="sidebar-save-status" aria-live="polite"></div>
      </div>
    </nav>
  `;
}

export function mountShell({ activePage, title, subtitle }) {
  const shell = document.getElementById('app');
  shell.innerHTML = `
    <div class="app-shell app-shell-sidebar fade-in">
      <aside class="sidebar">
        <div class="sidebar-top">
          <div class="brand brand-vertical">
            <img class="brand-logo" src="assets/img/logo-uscm.png" alt="Logo USCM Montereau">
          </div>
          ${renderNav(activePage)}
        </div>
      </aside>
      <div class="main-layout">
        <header class="topbar topbar-page">
          <div class="page-heading-panel">
            <div>
              <div class="page-kicker">USCM · Tournament UI</div>
              <h1 class="page-title">${escapeHtml(title)}</h1>
              <p class="page-subtitle">${escapeHtml(subtitle)}</p>
            </div>
          </div>
        </header>
        <main id="page-content"></main>
      </div>
    </div>
  `;
  return document.getElementById('page-content');
}
