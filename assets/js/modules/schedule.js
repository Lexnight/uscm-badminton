
import { getMatchOutcome, calculateGeneralStats } from './calculations.js';
import { byId } from './utils.js';

function readableMatchLabel(state, match) {
  const a = byId(state.players || [], match.player1Id)?.name || 'À définir';
  const b = byId(state.players || [], match.player2Id)?.name || 'À définir';
  return `${a} vs ${b}`;
}

export function getOrderedGroupMatches(state) {
  const groups = state.groups || [];
  const buckets = groups.map((group) =>
    (group.matches || []).map((match, index) => ({
      type: 'group',
      phaseLabel: group.name,
      groupId: group.id,
      groupName: group.name,
      orderInGroup: index,
      matchId: match.id,
      match,
      label: readableMatchLabel(state, match)
    }))
  );

  const maxLength = Math.max(0, ...buckets.map((bucket) => bucket.length));
  const ordered = [];
  for (let row = 0; row < maxLength; row += 1) {
    for (let groupIndex = 0; groupIndex < buckets.length; groupIndex += 1) {
      const entry = buckets[groupIndex][row];
      if (entry) ordered.push(entry);
    }
  }
  return ordered;
}

export function getOrderedBracketMatches(state) {
  const rounds = state.bracket?.rounds || [];
  return rounds.flatMap((round) =>
    (round.matches || []).map((match, index) => ({
      type: 'bracket',
      phaseLabel: round.name,
      roundId: round.id,
      roundName: round.name,
      orderInRound: index,
      matchId: match.id,
      match,
      label: readableMatchLabel(state, match)
    }))
  );
}

export function getFullMatchOrder(state) {
  const groupMatches = getOrderedGroupMatches(state);
  const bracketMatches = getOrderedBracketMatches(state);
  return [...groupMatches, ...bracketMatches].map((entry, index) => ({
    ...entry,
    absoluteIndex: index + 1,
    finished: getMatchOutcome(entry.match).finished,
    playable: entry.type === 'group' || Boolean(entry.match?.player1Id && entry.match?.player2Id)
  }));
}

export function getLiveOrderState(state) {
  const order = getFullMatchOrder(state);
  const pendingPlayable = order.filter((entry) => entry.playable && !entry.finished);
  const courtCount = Math.max(1, Number(state.settings?.courtCount || 1));

  const current = pendingPlayable.slice(0, courtCount).map((entry, index) => ({
    ...entry,
    assignedCourt: index + 1
  }));

  const next = pendingPlayable.slice(courtCount, courtCount + 4).map((entry, index) => ({
    ...entry,
    assignedCourt: (index % courtCount) + 1
  }));

  const finishedCount = order.filter((entry) => entry.finished).length;
  const progress = order.length ? Math.round((finishedCount / order.length) * 100) : 0;

  return {
    order,
    current,
    next,
    finishedCount,
    totalCount: order.length,
    progress,
    courtCount,
    ranking: calculateGeneralStats(state).slice(0, 8)
  };
}
