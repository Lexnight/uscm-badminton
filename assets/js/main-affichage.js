
import { subscribe } from './modules/app.js';
import { renderOrderDashboard } from './modules/display-order.js';

const app = document.getElementById('app');

function render(state) {
  app.innerHTML = `
    <div class="public-screen-shell fade-in">
      <header class="public-screen-header">
        <div>
          <h1>Ordre de jeu · Affichage public</h1>
          <p>Écran compétition synchronisé automatiquement</p>
        </div>
      </header>
      <main class="public-screen-main">
        ${renderOrderDashboard(state, { publicView: true })}
      </main>
    </div>
  `;
}

subscribe(render);
