
import { subscribe } from './modules/app.js';
import { mountShell } from './modules/ui.js';
import { bindSidebarPersistence } from './modules/save-controls.js';
import { renderOrderDashboard } from './modules/display-order.js';

const content = mountShell({
  activePage: 'ordre',
  title: 'Ordre de jeu',
  subtitle: "Pilotage en direct : terrains, prochains matchs, liste complète et top 8."
});

function render(state) {
  content.innerHTML = renderOrderDashboard(state, { publicView: false });
  bindSidebarPersistence();
}

subscribe(render);
