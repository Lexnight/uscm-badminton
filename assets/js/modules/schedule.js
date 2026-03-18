
import { getMatchOutcome, calculateGeneralStats } from './calculations.js';
import { byId } from './utils.js';

function readableMatchLabel(state, match) {
  const a = byId(state.players || [], match.player1Id)?.name || 'À définir';
  const b = byId(state.players || [], match.player2Id)?.name || 'À définir';
  return `${a} vs ${b}`;
}

function getMatchPlayerIds(match) {
  return [match?.player1Id, match?.player2Id].filter(Boolean);
}

function hasPlayerConflict(matchA, matchB) {
  const idsA = new Set(getMatchPlayerIds(matchA));
  return getMatchPlayerIds(matchB).some((id) => idsA.has(id));
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

function buildFairCourtAssignments(pendingPlayable, courtCount) {
  const remaining = [...pendingPlayable];
  const current = [];
  const next = [];
  let recentMatches = [];

  const pickForSlot = () => {
    if (!remaining.length) return null;

    // 1) Best case: no conflict with any match already selected in the current wave
    let index = remaining.findIndex((entry) =>
      recentMatches.every((recent) => !hasPlayerConflict(recent.match, entry.match))
    );

    // 2) Fallback: avoid conflict with the most recently assigned match if possible
    if (index === -1 && recentMatches.length) {
      const lastRecent = recentMatches[recentMatches.length - 1];
      index = remaining.findIndex((entry) => !hasPlayerConflict(lastRecent.match, entry.match));
    }

    // 3) Last resort: keep original order
    if (index === -1) index = 0;

    const [picked] = remaining.splice(index, 1);
    recentMatches.push(picked);
    if (recentMatches.length > courtCount) {
      recentMatches = recentMatches.slice(-courtCount);
    }
    return picked;
  };

  for (let slot = 0; slot < courtCount; slot += 1) {
    const picked = pickForSlot();
    if (!picked) break;
    current.push({
      ...picked,
      assignedCourt: slot + 1
    });
  }

  for (let slot = 0; slot < 4; slot += 1) {
    const picked = pickForSlot();
    if (!picked) break;
    next.push({
      ...picked,
      assignedCourt: (slot % courtCount) + 1
    });
  }

  return { current, next };
}

export function getLiveOrderState(state) {
  const order = getFullMatchOrder(state);
  const pendingPlayable = order.filter((entry) => entry.playable && !entry.finished);
  const courtCount = Math.max(1, Number(state.settings?.courtCount || 1));
  const { current, next } = buildFairCourtAssignments(pendingPlayable, courtCount);

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
    ranking: calculateGeneralStats(state)
  };
}
