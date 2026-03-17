const STORAGE_KEY = 'badmintonTournamentManager.v1';

const defaultState = {
  version: 1,
  updatedAt: new Date().toISOString(),
  settings: {
    tournamentName: 'Tournoi de badminton',
    setPoints: 21,
    bestOf: 3,
    matchDuration: 20,
    startTime: '09:00',
    courtCount: 1,
    groupCount: 4,
    participantCount: 0,
    qualifierMode: 'top2'
  },
  players: [],
  groups: [],
  bracket: {
    qualifierMode: 'top2',
    rounds: [],
    generatedAt: null,
    stale: false
  }
};

export function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function getDefaultState() {
  return deepClone(defaultState);
}

export function normalizeState(parsed) {
  return {
    ...getDefaultState(),
    ...(parsed || {}),
    settings: {
      ...getDefaultState().settings,
      ...((parsed && parsed.settings) || {})
    },
    bracket: {
      ...getDefaultState().bracket,
      ...((parsed && parsed.bracket) || {})
    },
    players: Array.isArray(parsed?.players) ? parsed.players : [],
    groups: Array.isArray(parsed?.groups) ? parsed.groups : []
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return getDefaultState();
    }
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch (error) {
    console.error('Erreur de chargement localStorage:', error);
    return getDefaultState();
  }
}

export function saveState(state) {
  const payload = {
    ...state,
    updatedAt: new Date().toISOString()
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  return payload;
}

export function resetState() {
  localStorage.removeItem(STORAGE_KEY);
  return getDefaultState();
}
