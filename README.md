# Tournoi de badminton — application web HTML/CSS/JS

Application front-end autonome, sans base de données, avec persistance locale via `localStorage`.

## Structure des fichiers

```text
badminton-tournament-manager/
├── index.html                  # redirection vers la page poules
├── poules.html                 # page 1 : joueurs, paramètres, poules, matchs
├── tableau.html                # page 2 : bracket à élimination directe
├── statistiques.html           # page 3 : classement général et statistiques
├── README.md
└── assets/
    ├── css/
    │   └── styles.css          # design responsive moderne blanc/noir/orange
    └── js/
        ├── main-poules.js      # logique UI de la page poules
        ├── main-tableau.js     # logique UI de la page tableau
        ├── main-statistiques.js# logique UI de la page statistiques
        └── modules/
            ├── app.js          # store applicatif simple + abonnement UI
            ├── storage.js      # localStorage, état par défaut
            ├── utils.js        # helpers communs
            ├── ui.js           # shell, navigation, helpers d'affichage
            ├── groups.js       # génération/équilibrage/drag&drop des poules
            ├── bracket.js      # génération et propagation du tableau
            └── calculations.js # classements, stats, durées, qualifiés
```

## Modèle de données

```js
{
  version: 1,
  settings: {
    tournamentName: "Tournoi de badminton",
    setPoints: 15 | 21,
    bestOf: 3,
    matchDuration: 20,
    startTime: "09:00",
    groupCount: 4,
    qualifierMode: "top1" | "top2" | "top3"
  },
  players: [
    { id, name }
  ],
  groups: [
    {
      id,
      name,
      playerIds: [playerId, ...],
      matches: [
        {
          id,
          player1Id,
          player2Id,
          sets: [{ a, b }, { a, b }, { a, b }]
        }
      ]
    }
  ],
  bracket: {
    qualifierMode,
    stale: false,
    generatedAt,
    rounds: [
      {
        id,
        name,
        matches: [
          {
            id,
            label,
            player1Id,
            player2Id,
            source1,
            source2,
            sets,
            winnerId,
            finished,
            autoAdvanced
          }
        ]
      }
    ]
  }
}
```

## Logique de calcul

### Poules
- Génération automatique round-robin : chaque paire de joueurs d'une poule produit un match.
- Classement automatique par :
  1. points de classement
  2. différence de sets
  3. confrontation directe (égalité à deux)
  4. différence de points puis points marqués (fallback)
- Barème :
  - victoire 2-0 = 3 points
  - victoire 2-1 = 2 points
  - défaite = 1 point

### Équilibrage
- Répartition initiale en serpentin pour des poules visuellement équilibrées.
- Drag & drop libre entre poules.
- Alerte non bloquante si écart de taille > 1.
- Bouton d'optimisation pour rééquilibrer automatiquement.

### Tableau
- Sélection automatique des qualifiés selon le mode choisi.
- Création d'un tableau sur la prochaine puissance de 2.
- Seeding standard pour éviter un tableau désordonné.
- Propagation automatique des vainqueurs.
- Gestion des `bye` automatique si le nombre de qualifiés n'est pas une puissance de 2.

### Statistiques
- Agrégation de toutes les rencontres (poules + tableau).
- Calcul de :
  - matchs joués
  - victoires / défaites
  - sets gagnés / perdus
  - points marqués / encaissés
  - différences
- Durée totale estimée = `nombre total de matchs * durée moyenne`.
- Heure de fin estimée = `heure de début + durée totale`.

## Modules JavaScript

- `app.js` : mini store central, notifications de re-render.
- `storage.js` : sérialisation locale, état par défaut.
- `groups.js` : répartition des joueurs, drag & drop, matchs de poules.
- `calculations.js` : moteur métier (classements, stats, qualifiés).
- `bracket.js` : génération du bracket et montée des vainqueurs.
- `ui.js` : shell commun, navigation, helpers d'affichage.
- `main-*.js` : orchestration page par page.

## Utilisation

1. Ouvrir `poules.html` (ou `index.html`).
2. Saisir les joueurs.
3. Définir les paramètres.
4. Générer / optimiser les poules.
5. Renseigner les scores.
6. Ouvrir `tableau.html` pour générer le bracket.
7. Ouvrir `statistiques.html` pour le classement global.

## Remarques d'évolution

Le projet est prêt à étendre avec :
- export/import JSON,
- impression PDF,
- gestion de plusieurs terrains,
- mode double,
- contrôles métier plus stricts sur les scores,
- PWA hors ligne.


## Mise à jour v2
- La page `index.html` est devenue la page **Paramètres du tournoi**.
- Le nombre de poules est désormais **déduit automatiquement** à partir du nombre de participants / équipes.
- La page **Poules** permet maintenant de **renommer les participants** directement via une étiquette avec un bouton stylo.


## Évolutions v10

- Choix de la couleur de puce depuis **Paramètres > Composition des poules**.
- Couleurs des puces propagées dans **Poules**, **Tableau** et **Statistiques**.
- Le **3e set** reste grisé tant que les deux joueurs n'ont pas chacun gagné un set sur les deux premiers.
- Le **Tableau** affiche les lignes **Set.1 / Set.2 / Set.3** avec les puces couleur associées.


## V5 design
- sidebar fixe à gauche avec logo USCM
- cartes plus compactes
- fond anthracite harmonisé
- feuille de poule plus proche d'un tableau officiel
- barres de progression du tournoi
- animations plus fluides


## V6
- Nouvelle page : `ordre-de-jeu.html`
- Idées de nom pour cette page : Ordre de jeu, Pilotage tournoi, Centre de match, Appel des terrains.
- Nom retenu dans le projet : **Ordre de jeu**.
- Ajout du nombre de terrains dans les paramètres.
- Affectation automatique des matchs aux terrains.
- Liste complète des matchs intercalée par poules : A puis B puis C puis reprise du cycle.


## V7
- Mise en page quasi pleine largeur écran
- Sidebar réduite aux icônes
- Nouvelle page `affichage.html` : clone public de l'ordre de jeu sans menu
- Synchronisation automatique de l'écran public via localStorage


## V10 sauvegarde
- bouton Enregistrer
- bouton Exporter JSON
- bouton Importer JSON
- nomenclature d'export : `Nomdutournoi_YYYY-MM-DD_HH-MM.json`
- l'export crée un nouveau fichier à chaque fois
