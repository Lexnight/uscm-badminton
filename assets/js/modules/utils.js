export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function uniqueNamesFromText(input) {
  return [...new Set(
    input
      .split(/[\n,;]+/)
      .map((name) => name.trim())
      .filter(Boolean)
  )];
}

export function byId(collection, id) {
  return collection.find((item) => item.id === id) || null;
}

export function nextPowerOfTwo(value) {
  let power = 1;
  while (power < value) power *= 2;
  return power;
}

export function formatClock(totalMinutes) {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export function addMinutesToTime(time, minutesToAdd) {
  const [hours = 0, minutes = 0] = String(time || '09:00').split(':').map(Number);
  const total = (hours * 60) + minutes + Math.round(Number(minutesToAdd || 0));
  return formatClock(total);
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function compareNumbersDesc(a, b) {
  return Number(b || 0) - Number(a || 0);
}

export function sortNames(a, b) {
  return String(a || '').localeCompare(String(b || ''), 'fr', { sensitivity: 'base' });
}

export function chunk(array, size) {
  const result = [];
  for (let index = 0; index < array.length; index += size) {
    result.push(array.slice(index, index + size));
  }
  return result;
}

export function groupBy(items, getKey) {
  const map = new Map();
  for (const item of items) {
    const key = getKey(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

export function debounce(callback, delay = 200) {
  let timeoutId;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => callback(...args), delay);
  };
}

export function pairKey(a, b) {
  return [a, b].sort().join('::');
}

export function roundLabel(roundIndex, totalRounds) {
  const remaining = totalRounds - roundIndex;
  if (remaining === 1) return 'Finale';
  if (remaining === 2) return 'Demi-finales';
  if (remaining === 3) return 'Quarts de finale';
  if (remaining === 4) return 'Huitièmes';
  return `Tour ${roundIndex + 1}`;
}
