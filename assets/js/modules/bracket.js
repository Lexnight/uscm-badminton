import { uid, nextPowerOfTwo, roundLabel } from './utils.js';
import { getMatchOutcome, getQualifiedPlayers } from './calculations.js';

function generateSeedOrder(size) {
  if (size === 1) return [1];
  const previous = generateSeedOrder(size / 2);
  const order = [];
  for (const seed of previous) {
    order.push(seed);
    order.push(size + 1 - seed);
  }
  return order;
}

function createEmptySets() {
  return [{ a: '', b: '' }, { a: '', b: '' }, { a: '', b: '' }];
}

function clearMatchResult(match) {
  return {
    ...match,
    winnerId: null,
    finished: false,
    autoAdvanced: false,
    sets: createEmptySets()
  };
}

export function generateBracket(state, mode = state.settings.qualifierMode) {
  const qualified = getQualifiedPlayers(state, mode);
  const slotCount = nextPowerOfTwo(Math.max(2, qualified.length || 2));
  const seedOrder = generateSeedOrder(slotCount);
  const seededEntrants = Array.from({ length: slotCount }, (_, index) => {
    const targetSeed = index + 1;
    const entrant = qualified[targetSeed - 1] || null;
    return entrant;
  });

  const orderedSlots = seedOrder.map((seed) => seededEntrants[seed - 1] || null);
  const totalRounds = Math.log2(slotCount);
  const rounds = [];

  const firstRoundMatches = [];
  for (let index = 0; index < orderedSlots.length; index += 2) {
    const player1 = orderedSlots[index];
    const player2 = orderedSlots[index + 1];
    firstRoundMatches.push({
      id: uid('bmatch'),
      label: `M${index / 2 + 1}`,
      player1Id: player1?.playerId || null,
      player2Id: player2?.playerId || null,
      source1: null,
      source2: null,
      sets: createEmptySets(),
      winnerId: null,
      finished: false,
      autoAdvanced: false
    });
  }

  rounds.push({
    id: uid('round'),
    name: roundLabel(0, totalRounds),
    matches: firstRoundMatches
  });

  for (let roundIndex = 1; roundIndex < totalRounds; roundIndex += 1) {
    const previous = rounds[roundIndex - 1];
    const matches = [];
    for (let index = 0; index < previous.matches.length; index += 2) {
      matches.push({
        id: uid('bmatch'),
        label: `R${roundIndex + 1}-${index / 2 + 1}`,
        player1Id: null,
        player2Id: null,
        source1: previous.matches[index].id,
        source2: previous.matches[index + 1].id,
        sets: createEmptySets(),
        winnerId: null,
        finished: false,
        autoAdvanced: false
      });
    }
    rounds.push({
      id: uid('round'),
      name: roundLabel(roundIndex, totalRounds),
      matches
    });
  }

  return recalculateBracket({
    qualifierMode: mode,
    rounds,
    generatedAt: new Date().toISOString(),
    stale: false
  });
}

export function recalculateBracket(bracket) {
  if (!bracket?.rounds?.length) return bracket;

  const rounds = bracket.rounds.map((round) => ({
    ...round,
    matches: round.matches.map((match) => ({ ...match }))
  }));

  const findMatchById = (id) => {
    for (const round of rounds) {
      const found = round.matches.find((match) => match.id === id);
      if (found) return found;
    }
    return null;
  };

  const resolveWinner = (match) => {
    const outcome = getMatchOutcome(match);
    match.autoAdvanced = false;

    if (match.player1Id && !match.player2Id) {
      match.winnerId = match.player1Id;
      match.finished = true;
      match.autoAdvanced = true;
      match.sets = createEmptySets();
      return match;
    }

    if (!match.player1Id && match.player2Id) {
      match.winnerId = match.player2Id;
      match.finished = true;
      match.autoAdvanced = true;
      match.sets = createEmptySets();
      return match;
    }

    if (!match.player1Id || !match.player2Id) {
      match.winnerId = null;
      match.finished = false;
      match.autoAdvanced = false;
      return match;
    }

    if (outcome.finished) {
      match.finished = true;
      match.winnerId = outcome.winnerSlot === 'a' ? match.player1Id : match.player2Id;
      return match;
    }

    match.finished = false;
    match.winnerId = null;
    return match;
  };

  rounds[0].matches.forEach(resolveWinner);

  for (let roundIndex = 1; roundIndex < rounds.length; roundIndex += 1) {
    for (const match of rounds[roundIndex].matches) {
      const source1 = findMatchById(match.source1);
      const source2 = findMatchById(match.source2);
      const nextPlayer1Id = source1?.winnerId || null;
      const nextPlayer2Id = source2?.winnerId || null;
      const playersChanged = match.player1Id !== nextPlayer1Id || match.player2Id !== nextPlayer2Id;

      match.player1Id = nextPlayer1Id;
      match.player2Id = nextPlayer2Id;

      if (playersChanged && !match.autoAdvanced) {
        Object.assign(match, clearMatchResult(match));
      }

      resolveWinner(match);
    }
  }

  return {
    ...bracket,
    rounds
  };
}

export function updateBracketMatchScore(state, roundId, matchId, sets) {
  const bracket = {
    ...(state.bracket || { rounds: [] }),
    rounds: (state.bracket?.rounds || []).map((round) => ({
      ...round,
      matches: round.matches.map((match) => (
        round.id === roundId && match.id === matchId
          ? { ...match, sets, autoAdvanced: false }
          : { ...match }
      ))
    }))
  };

  return {
    ...state,
    bracket: recalculateBracket(bracket)
  };
}

export function getBracketCompletion(bracket) {
  const allMatches = bracket?.rounds?.flatMap((round) => round.matches) || [];
  const playable = allMatches.filter((match) => match.player1Id && match.player2Id);
  const completed = playable.filter((match) => match.finished);
  return {
    playable: playable.length,
    completed: completed.length,
    progress: playable.length ? Math.round((completed.length / playable.length) * 100) : 0
  };
}
