import { uid, pairKey } from './utils.js';

export function buildGroups(players, groupCount, existingGroups = []) {
  const safeCount = Math.max(1, Number(groupCount || 1));
  const shuffled = [...players].sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
  const groups = Array.from({ length: safeCount }, (_, index) => {
    const existing = existingGroups[index];
    return {
      id: existing?.id || uid('group'),
      name: `Poule ${String.fromCharCode(65 + index)}`,
      playerIds: [],
      matches: []
    };
  });

  shuffled.forEach((player, index) => {
    const row = Math.floor(index / safeCount);
    const column = index % safeCount;
    const targetIndex = row % 2 === 0 ? column : (safeCount - 1 - column);
    groups[targetIndex].playerIds.push(player.id);
  });

  return groups.map((group, index) => regenerateGroupMatches(group, existingGroups[index]?.matches || []));
}

export function regenerateGroupMatches(group, previousMatches = []) {
  const previousMap = new Map(
    (previousMatches || []).map((match) => [pairKey(match.player1Id, match.player2Id), match])
  );

  const matches = [];
  const ids = group.playerIds || [];
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const player1Id = ids[i];
      const player2Id = ids[j];
      const key = pairKey(player1Id, player2Id);
      const previous = previousMap.get(key);
      matches.push({
        id: previous?.id || uid('gmatch'),
        player1Id,
        player2Id,
        sets: previous?.sets || [{ a: '', b: '' }, { a: '', b: '' }, { a: '', b: '' }]
      });
    }
  }

  return {
    ...group,
    matches
  };
}

export function rebalanceExistingGroups(state) {
  const groups = buildGroups(state.players || [], state.settings.groupCount, state.groups || []);
  return {
    ...state,
    groups
  };
}

export function movePlayerBetweenGroups(state, playerId, targetGroupId) {
  const currentGroups = (state.groups || []).map((group) => ({
    ...group,
    playerIds: [...group.playerIds],
    matches: [...(group.matches || [])]
  }));

  let sourceIndex = -1;
  let targetIndex = -1;

  currentGroups.forEach((group, index) => {
    if (group.playerIds.includes(playerId)) sourceIndex = index;
    if (group.id === targetGroupId) targetIndex = index;
  });

  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return state;

  currentGroups[sourceIndex].playerIds = currentGroups[sourceIndex].playerIds.filter((id) => id !== playerId);
  currentGroups[targetIndex].playerIds.push(playerId);

  const groups = currentGroups.map((group, index) => regenerateGroupMatches(group, state.groups[index]?.matches || []));
  return { ...state, groups };
}

export function getGroupImbalance(groups = []) {
  const sizes = groups.map((group) => group.playerIds.length);
  if (!sizes.length) return { isImbalanced: false, min: 0, max: 0, delta: 0 };
  const min = Math.min(...sizes);
  const max = Math.max(...sizes);
  return {
    isImbalanced: max - min > 1,
    min,
    max,
    delta: max - min
  };
}

export function updateGroupMatchScore(state, groupId, matchId, sets) {
  const groups = (state.groups || []).map((group) => {
    if (group.id !== groupId) return group;
    return {
      ...group,
      matches: (group.matches || []).map((match) => (
        match.id === matchId
          ? { ...match, sets }
          : match
      ))
    };
  });

  return {
    ...state,
    groups
  };
}

export function suggestGroupCount(participantCount) {
  const total = Math.max(0, Number(participantCount || 0));
  if (total <= 0) return 1;
  if (total <= 6) return 1;

  let best = { count: 1, score: Number.POSITIVE_INFINITY };

  for (let count = 1; count <= total; count += 1) {
    const baseSize = Math.floor(total / count);
    const remainder = total % count;
    const maxSize = baseSize + (remainder > 0 ? 1 : 0);
    const minSize = baseSize;
    const averageSize = total / count;

    const hardPenalty =
      (minSize < 3 ? (3 - minSize) * 10000 : 0) +
      (maxSize > 6 ? (maxSize - 6) * 10000 : 0);

    const softPenalty =
      Math.abs(5 - averageSize) * 120 +
      Math.abs(maxSize - minSize) * 250 +
      Math.abs(5.5 - maxSize) * 18 +
      count * 0.01;

    const score = hardPenalty + softPenalty;
    if (score < best.score) best = { count, score };
  }

  return best.count;
}

export function syncDerivedGroupCount(state) {
  const participantCount = Math.max(state.players?.length || 0, Number(state.settings?.participantCount || 0));
  const groupCount = suggestGroupCount(participantCount);
  return {
    ...state,
    settings: {
      ...state.settings,
      participantCount,
      groupCount
    }
  };
}
