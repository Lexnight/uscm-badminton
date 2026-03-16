import { loadState, saveState, resetState as clearStorage } from './storage.js';

let state = loadState();
const listeners = new Set();

export function getState() {
  return state;
}

export function setState(nextState) {
  state = saveState(nextState);
  listeners.forEach((listener) => listener(state));
  return state;
}

export function updateState(updater) {
  const nextState = updater(structuredClone(state));
  return setState(nextState);
}

export function subscribe(listener) {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

export function resetAppState() {
  state = clearStorage();
  listeners.forEach((listener) => listener(state));
  return state;
}

window.addEventListener('storage', (event) => {
  if (event.key) {
    state = loadState();
    listeners.forEach((listener) => listener(state));
  }
});
