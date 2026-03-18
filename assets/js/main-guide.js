
import { subscribe } from './modules/app.js';
import { mountShell } from './modules/ui.js';
import { bindSidebarPersistence } from './modules/save-controls.js';

const content = mountShell({
  activePage: 'guide',
  title: 'Guide & astuces',
  subtitle: "Centre d’aide du projet : fonctionnalités, bonnes pratiques, workflow et rappels utiles."
});



const GUIDE_SECTIONS = [
  {
    category: 'overview',
    icon: 'fa-solid fa-layer-group',
    title: 'Vue d’ensemble',
    text: 'Le projet gère les paramètres du tournoi, les poules, le tableau final, les statistiques, l’ordre de jeu, l’affichage public et la régie.',
    badge: 'Produit'
  },
  {
    category: 'overview',
    icon: 'fa-solid fa-gear',
    title: 'Paramètres',
    text: 'Configure le nom du tournoi, le nombre d’équipes, les points par set, le nombre de terrains et les horaires.',
    badge: 'Configuration'
  },
  {
    category: 'workflow',
    icon: 'fa-solid fa-people-group',
    title: 'Composer les poules',
    text: 'Renomme les équipes, choisis les couleurs, ajuste les poules en drag & drop puis vérifie la projection automatique.',
    badge: 'Workflow'
  },
  {
    category: 'workflow',
    icon: 'fa-solid fa-table-cells-large',
    title: 'Saisir les résultats',
    text: 'Entre directement les scores dans la matrice des poules. Le classement se recalcule automatiquement.',
    badge: 'Workflow'
  },
  {
    category: 'workflow',
    icon: 'fa-solid fa-trophy',
    title: 'Générer le tableau',
    text: 'Quand les poules sont terminées, génère le tableau final puis saisis les scores des phases éliminatoires.',
    badge: 'Workflow'
  },
  {
    category: 'tips',
    icon: 'fa-solid fa-floppy-disk',
    title: 'Enregistrer souvent',
    text: 'Utilise la disquette de la sidebar pour figer l’état du tournoi avant chaque étape importante.',
    badge: 'Astuce'
  },
  {
    category: 'tips',
    icon: 'fa-solid fa-file-arrow-down',
    title: 'Exporter JSON',
    text: 'Chaque export crée un nouveau fichier au format NomDuTournoi_YYYY-MM-DD_HH-MM.json.',
    badge: 'Sauvegarde'
  },
  {
    category: 'tips',
    icon: 'fa-solid fa-file-arrow-up',
    title: 'Importer ailleurs',
    text: 'Tu peux reprendre un tournoi sur un autre poste en important un fichier JSON précédemment exporté.',
    badge: 'Sauvegarde'
  },
  {
    category: 'rules',
    icon: 'fa-solid fa-medal',
    title: 'Règle simple de score',
    text: 'Jusqu’à 21 points, ou jusqu’à 15 si ce format est choisi, aucun marquage spécial. Au-delà de la valeur cible, un score valide devient orange et un score incohérent devient rouge.',
    badge: 'Règle'
  },
  {
    category: 'rules',
    icon: 'fa-solid fa-check',
    title: 'Exemple valide : 21 / 18',
    text: '21/18 est valide. Tant que le score gagnant ne dépasse pas 21, il n’y a pas de mise en rouge.',
    badge: 'Score'
  },
  {
    category: 'rules',
    icon: 'fa-solid fa-check',
    title: 'Exemple valide : 21 / 10',
    text: '21/10 est valide. Tant que le score gagnant ne dépasse pas 21, il n’y a pas de contrôle visuel rouge.',
    badge: 'Score'
  },
  {
    category: 'rules',
    icon: 'fa-solid fa-check',
    title: 'Exemple valide : 23 / 21',
    text: '23/21 est valide : le score dépasse 21 et il y a exactement 2 points d’écart. Il doit apparaître en orange.',
    badge: 'Score'
  },
  {
    category: 'rules',
    icon: 'fa-solid fa-ban',
    title: 'Exemple invalide : 23 / 20',
    text: '23/20 est invalide : au-delà de 21 points, il faut exactement 2 points d’écart. Il doit apparaître en rouge.',
    badge: 'Score'
  },
  {
    category: 'rules',
    icon: 'fa-solid fa-ban',
    title: 'Exemple invalide : 25 / 22',
    text: '25/22 est invalide : au-delà de 21 points, il faut exactement 2 points d’écart. Il doit apparaître en rouge.',
    badge: 'Score'
  },
  {
    category: 'rules',
    icon: 'fa-solid fa-flag-checkered',
    title: 'Cas du format 15 points',
    text: 'Le même principe s’applique avec 15 comme valeur cible : jusqu’à 15, pas de marquage spécial ; au-delà de 15, orange si valide, rouge si incohérent.',
    badge: 'Format'
  },
  {
    category: 'display',
    icon: 'fa-solid fa-tv',
    title: 'Affichage public',
    text: 'Ouvre affichage.html sur un second écran pour informer les compétiteurs en temps réel.',
    badge: 'Écran'
  },
  {
    category: 'display',
    icon: 'fa-solid fa-tower-broadcast',
    title: 'Régie',
    text: 'La régie existe toujours comme outil opérationnel séparé, mais elle n’est plus affichée dans le menu principal.',
    badge: 'Écran'
  }
];



function cardMarkup(item) {
  return `
    <article class="guide-doc-card" data-guide-category="${item.category}">
      <div class="guide-doc-card-top">
        <span class="guide-doc-icon"><i class="${item.icon}" aria-hidden="true"></i></span>
        <span class="guide-doc-badge">${item.badge}</span>
      </div>
      <h3>${item.title}</h3>
      <p>${item.text}</p>
    </article>
  `;
}

function render(state) {
  content.innerHTML = `
    <section class="guide-doc-layout">
      <aside class="card guide-doc-sidebar">
        <div class="section-title">
          <div>
            <h2>Centre d’aide</h2>
            <p>Navigue par thème pour retrouver rapidement les informations utiles.</p>
          </div>
        </div>

        <div class="guide-doc-menu" role="tablist" aria-label="Catégories du guide">
          <button class="guide-filter-btn active" data-guide-filter="all">
            <i class="fa-solid fa-border-all" aria-hidden="true"></i>
            <span>Tout</span>
          </button>
          <button class="guide-filter-btn" data-guide-filter="overview">
            <i class="fa-solid fa-layer-group" aria-hidden="true"></i>
            <span>Vue d’ensemble</span>
          </button>
          <button class="guide-filter-btn" data-guide-filter="workflow">
            <i class="fa-solid fa-diagram-project" aria-hidden="true"></i>
            <span>Workflow</span>
          </button>
          <button class="guide-filter-btn" data-guide-filter="tips">
            <i class="fa-solid fa-lightbulb" aria-hidden="true"></i>
            <span>Astuces</span>
          </button>
          <button class="guide-filter-btn" data-guide-filter="rules">
            <i class="fa-solid fa-scale-balanced" aria-hidden="true"></i>
            <span>Règles</span>
          </button>
          <button class="guide-filter-btn" data-guide-filter="display">
            <i class="fa-solid fa-display" aria-hidden="true"></i>
            <span>Écrans</span>
          </button>
        </div>

        <div class="guide-doc-meta">
          <div class="summary-item"><span>Points par set</span><strong>${Number(state.settings.setPoints || 21)}</strong></div>
          <div class="summary-item"><span>Terrains</span><strong>${Number(state.settings.courtCount || 1)}</strong></div>
          <div class="summary-item"><span>Participants</span><strong>${state.players.length}</strong></div>
          <div class="summary-item"><span>Poules</span><strong>${state.groups.length}</strong></div>
        </div>
      </aside>

      <section class="guide-doc-content">
        <article class="card guide-doc-hero">
          <div class="section-title">
            <div>
              <h2>Documentation produit</h2>
              <p>Une vue synthétique et exploitable du fonctionnement global du projet pendant la préparation et le déroulement du tournoi.</p>
            </div>
            
          </div>

          <div class="guide-doc-highlights">
            <div class="summary-item"><span>Projet</span><strong>Gestion tournoi badminton</strong></div>
            <div class="summary-item"><span>Sauvegarde</span><strong>Local + JSON</strong></div>
            <div class="summary-item"><span>Navigation</span><strong>Sidebar persistante</strong></div>
            <div class="summary-item"><span>Usage</span><strong>PC + écran public</strong></div>
          </div>
        </article>

        <section class="guide-doc-cards-grid" id="guide-doc-cards">
          ${GUIDE_SECTIONS.map(cardMarkup).join('')}
        </section>
      </section>
    </section>
  `;

  document.querySelectorAll('.guide-filter-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const filter = button.dataset.guideFilter || 'all';
      document.querySelectorAll('.guide-filter-btn').forEach((entry) => entry.classList.toggle('active', entry === button));
      document.querySelectorAll('.guide-doc-card').forEach((card) => {
        const match = filter === 'all' || card.dataset.guideCategory === filter;
        card.classList.toggle('is-hidden', !match);
      });
    });
  });

  bindSidebarPersistence();
}

subscribe(render);
