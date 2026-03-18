
import { subscribe } from './modules/app.js';
import { renderRegieDashboard } from './modules/display-regie.js';

const app = document.getElementById('app');

function render(state) {
  app.innerHTML = renderRegieDashboard(state, { standalone: true });
}

subscribe(render);
