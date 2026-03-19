import { byId, pairKey, sortNames, addMinutesToTime } from './utils.js';

function normalizeSetScore(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}




function getSetCap(pointTarget = 21) {
  return Number(pointTarget || 21);
}

export function validateBadmintonSet(rawSet = {}, pointTarget = 21) {
  const target = Math.max(1, Number(pointTarget || 21));
  const a = normalizeSetScore(rawSet?.a);
  const b = normalizeSetScore(rawSet?.b);

  if (a === null && b === null) {
    return { complete: false, valid: true, status: 'empty', message: '' };
  }

  if (a === null || b === null) {
    return { complete: false, valid: true, status: 'incomplete', message: '' };
  }

  if (a < 0 || b < 0) {
    return { complete: true, valid: false, status: 'error', message: 'Un score ne peut pas être négatif.' };
  }

  if (a === b) {
    return { complete: true, valid: false, status: 'error', message: 'Un set ne peut pas se terminer sur une égalité.' };
  }

  const higher = Math.max(a, b);
  const diff = Math.abs(a - b);

  if (higher <= target) {
    return { complete: true, valid: true, status: 'normal', message: '' };
  }

  if (diff === 2) {
    return {
      complete: true,
      valid: true,
      status: 'caution',
      message: `Score prolongé valide au-delà de ${target} : mise en évidence orange.`
    };
  }

  return {
    complete: true,
    valid: false,
    status: 'error',
    message: `Au-delà de ${target}, il faut exactement 2 points d'écart.`
  };
}


export function sanitizeSets(rawSets = []) {
  return (rawSets || [])
    .slice(0, 3)
    .map((set) => ({
      a: normalizeSetScore(set?.a),
      b: normalizeSetScore(set?.b)
    }))
    .filter((set) => set.a !== null && set.b !== null);
}

export function shouldDisableThirdSet(rawSets = []) {
  const firstTwo = (rawSets || []).slice(0, 2).map((set) => ({
    a: normalizeSetScore(set?.a),
    b: normalizeSetScore(set?.b)
  }));

  let winsA = 0;
  let winsB = 0;

  for (const set of firstTwo) {
    if (set.a === null || set.b === null || set.a === set.b) continue;
    if (set.a > set.b) winsA += 1;
    if (set.b > set.a) winsB += 1;
  }

  return !(winsA >= 1 && winsB >= 1);
}

export function getMatchOutcome(match) {
  const sets = sanitizeSets(match?.sets || []);
  let winsA = 0;
  let winsB = 0;
  let pointsA = 0;
  let pointsB = 0;

  for (const set of sets) {
    pointsA += set.a;
    pointsB += set.b;
    if (set.a === set.b) continue;
    if (set.a > set.b) winsA += 1;
    if (set.b > set.a) winsB += 1;
  }

  const finished = winsA === 2 || winsB === 2;
  const winnerSlot = winsA > winsB ? 'a' : winsB > winsA ? 'b' : null;

  return {
    finished,
    winnerSlot,
    winsA,
    winsB,
    pointsA,
    pointsB,
    sets,
    valid: finished
  };
}

function getMatchPointAward(outcome, playerSlot) {
  if (!outcome.finished) return 0;
  const didWin = outcome.winnerSlot === playerSlot;
  if (didWin) {
    const opponentWins = playerSlot === 'a' ? outcome.winsB : outcome.winsA;
    return opponentWins === 0 ? 3 : 2;
  }
  return 1;
}

function createRankingRow(player) {
  return {
    playerId: player.id,
    name: player.name,
    played: 0,
    wins: 0,
    losses: 0,
    rankingPoints: 0,
    setsWon: 0,
    setsLost: 0,
    pointsWon: 0,
    pointsLost: 0,
    setDiff: 0,
    pointDiff: 0,
    avgPointsPerMatch: 0
  };
}

export function calculateGroupStandings(group, players) {
  const rows = (group.playerIds || [])
    .map((id) => byId(players, id))
    .filter(Boolean)
    .map(createRankingRow);

  const rowMap = new Map(rows.map((row) => [row.playerId, row]));
  const outcomes = [];

  for (const match of group.matches || []) {
    const playerA = rowMap.get(match.player1Id);
    const playerB = rowMap.get(match.player2Id);
    if (!playerA || !playerB) continue;

    const outcome = getMatchOutcome(match);
    if (!outcome.finished) continue;

    playerA.played += 1;
    playerB.played += 1;
    playerA.setsWon += outcome.winsA;
    playerA.setsLost += outcome.winsB;
    playerB.setsWon += outcome.winsB;
    playerB.setsLost += outcome.winsA;
    playerA.pointsWon += outcome.pointsA;
    playerA.pointsLost += outcome.pointsB;
    playerB.pointsWon += outcome.pointsB;
    playerB.pointsLost += outcome.pointsA;
    playerA.rankingPoints += getMatchPointAward(outcome, 'a');
    playerB.rankingPoints += getMatchPointAward(outcome, 'b');

    if (outcome.winnerSlot === 'a') {
      playerA.wins += 1;
      playerB.losses += 1;
    }
    if (outcome.winnerSlot === 'b') {
      playerB.wins += 1;
      playerA.losses += 1;
    }

    outcomes.push({
      key: pairKey(match.player1Id, match.player2Id),
      winnerId: outcome.winnerSlot === 'a' ? match.player1Id : match.player2Id,
      loserId: outcome.winnerSlot === 'a' ? match.player2Id : match.player1Id
    });
  }

  rows.forEach((row) => {
    row.setDiff = row.setsWon - row.setsLost;
    row.pointDiff = row.pointsWon - row.pointsLost;
    row.avgPointsPerMatch = row.played ? Number((row.pointsWon / row.played).toFixed(2)) : 0;
  });

  const directResults = new Map(outcomes.map((item) => [item.key, item]));

  rows.sort((left, right) => {
    if (right.rankingPoints !== left.rankingPoints) return right.rankingPoints - left.rankingPoints;
    if (right.setDiff !== left.setDiff) return right.setDiff - left.setDiff;

    const direct = directResults.get(pairKey(left.playerId, right.playerId));
    if (direct && direct.winnerId !== direct.loserId) {
      if (direct.winnerId === left.playerId) return -1;
      if (direct.winnerId === right.playerId) return 1;
    }

    if (right.avgPointsPerMatch !== left.avgPointsPerMatch) return right.avgPointsPerMatch - left.avgPointsPerMatch;
    if (right.pointDiff !== left.pointDiff) return right.pointDiff - left.pointDiff;
    if (right.pointsWon !== left.pointsWon) return right.pointsWon - left.pointsWon;
    return sortNames(left.name, right.name);
  });

  return rows.map((row, index) => ({
    ...row,
    rank: index + 1
  }));
}

export function calculateAllGroupStandings(state) {
  return (state.groups || []).map((group) => ({
    groupId: group.id,
    groupName: group.name,
    standings: calculateGroupStandings(group, state.players)
  }));
}


export function calculateGeneralStats(state) {
  const baseRows = state.players
    .map(createRankingRow)
    .map((row) => ({
      ...row,
      bracketWins: 0,
      bracketLosses: 0,
      bracketPlacementBucket: 4,
      bracketPlacementLabel: ''
    }));
  const map = new Map(baseRows.map((row) => [row.playerId, row]));

  const applyMatch = (match, isBracket = false) => {
    const rowA = map.get(match.player1Id);
    const rowB = map.get(match.player2Id);
    if (!rowA || !rowB) return;
    const outcome = getMatchOutcome(match);
    if (!outcome.finished) return;

    rowA.played += 1;
    rowB.played += 1;
    rowA.setsWon += outcome.winsA;
    rowA.setsLost += outcome.winsB;
    rowB.setsWon += outcome.winsB;
    rowB.setsLost += outcome.winsA;
    rowA.pointsWon += outcome.pointsA;
    rowA.pointsLost += outcome.pointsB;
    rowB.pointsWon += outcome.pointsB;
    rowB.pointsLost += outcome.pointsA;

    if (!isBracket) {
      rowA.rankingPoints += getMatchPointAward(outcome, 'a');
      rowB.rankingPoints += getMatchPointAward(outcome, 'b');
    }

    if (outcome.winnerSlot === 'a') {
      rowA.wins += 1;
      rowB.losses += 1;
      if (isBracket) {
        rowA.bracketWins += 1;
        rowB.bracketLosses += 1;
      }
    }
    if (outcome.winnerSlot === 'b') {
      rowB.wins += 1;
      rowA.losses += 1;
      if (isBracket) {
        rowB.bracketWins += 1;
        rowA.bracketLosses += 1;
      }
    }
  };

  for (const group of state.groups || []) {
    for (const match of group.matches || []) {
      applyMatch(match, false);
    }
  }

  for (const round of state.bracket?.rounds || []) {
    for (const match of round.matches || []) {
      applyMatch(match, true);
    }
  }

  baseRows.forEach((row) => {
    row.setDiff = row.setsWon - row.setsLost;
    row.pointDiff = row.pointsWon - row.pointsLost;
    row.avgPointsPerMatch = row.played ? Number((row.pointsWon / row.played).toFixed(2)) : 0;
  });

  const bracketRounds = state.bracket?.rounds || [];
  const bracketPlayerIds = new Set();
  for (const round of bracketRounds) {
    for (const match of round.matches || []) {
      if (match.player1Id) bracketPlayerIds.add(match.player1Id);
      if (match.player2Id) bracketPlayerIds.add(match.player2Id);
    }
  }

  // Default: players not in the bracket come after the bracket participants.
  baseRows.forEach((row) => {
    if (bracketPlayerIds.has(row.playerId)) {
      row.bracketPlacementBucket = 3;
      row.bracketPlacementLabel = 'Tableau';
    }
  });

  const finalRound = bracketRounds[bracketRounds.length - 1];
  const finalMatch = finalRound?.matches?.[0];
  if (finalMatch?.winnerId) {
    const championId = finalMatch.winnerId;
    const finalistId = finalMatch.player1Id === championId ? finalMatch.player2Id : finalMatch.player1Id;

    const champion = map.get(championId);
    const finalist = map.get(finalistId);
    if (champion) {
      champion.bracketPlacementBucket = 1;
      champion.bracketPlacementLabel = '1er tableau';
    }
    if (finalist) {
      finalist.bracketPlacementBucket = 2;
      finalist.bracketPlacementLabel = '2e tableau';
    }
  }

  baseRows.sort((left, right) => {
    if (left.bracketPlacementBucket !== right.bracketPlacementBucket) {
      return left.bracketPlacementBucket - right.bracketPlacementBucket;
    }
    if (right.rankingPoints !== left.rankingPoints) return right.rankingPoints - left.rankingPoints;
    if (right.pointsWon !== left.pointsWon) return right.pointsWon - left.pointsWon;
    if (right.avgPointsPerMatch !== left.avgPointsPerMatch) return right.avgPointsPerMatch - left.avgPointsPerMatch;
    if (right.pointDiff !== left.pointDiff) return right.pointDiff - left.pointDiff;
    if (right.setDiff !== left.setDiff) return right.setDiff - left.setDiff;
    if (right.wins !== left.wins) return right.wins - left.wins;
    return sortNames(left.name, right.name);
  });

  return baseRows.map((row, index) => ({
    ...row,
    rank: index + 1
  }));
}


export function getQualifiedRankLabels(mode) {
  if (mode === 'top1') return [1];
  if (mode === 'top3') return [1, 2, 3];
  return [1, 2];
}

export function getQualifiedPlayers(state, mode = state.settings.qualifierMode) {
  const labels = getQualifiedRankLabels(mode);
  const standingsByGroup = calculateAllGroupStandings(state);
  const qualified = [];

  for (const rank of labels) {
    for (const groupEntry of standingsByGroup) {
      const found = groupEntry.standings.find((row) => row.rank === rank);
      if (!found) continue;
      qualified.push({
        playerId: found.playerId,
        playerName: found.name,
        groupName: groupEntry.groupName,
        rank
      });
    }
  }

  return qualified;
}

export function getTournamentDurationSummary(state) {
  const groupMatches = (state.groups || []).reduce((total, group) => total + (group.matches?.length || 0), 0);
  const qualifierCount = getQualifiedPlayers(state, state.settings.qualifierMode).length;
  const normalizedQualifierCount = Math.max(2, qualifierCount);
  const bracketMatches = Math.max(0, Math.pow(2, Math.ceil(Math.log2(normalizedQualifierCount))) - 1);
  const totalMatches = groupMatches + bracketMatches;
  const matchDuration = Number(state.settings.matchDuration || 20);
  const courtCount = Math.max(1, Number(state.settings.courtCount || 1));
  const totalMinutes = Math.ceil(totalMatches / courtCount) * matchDuration;

  return {
    groupMatches,
    bracketMatches,
    totalMatches,
    totalMinutes,
    courtCount,
    matchDuration
  };
}


export function getTournamentTimingState(state, nowTime = new Date().toTimeString().slice(0, 5)) {
  const duration = getTournamentDurationSummary(state);
  const completedGroupMatches = (state.groups || []).reduce(
    (total, group) => total + (group.matches || []).filter((match) => getMatchOutcome(match).finished).length,
    0
  );
  const completedBracketMatches = (state.bracket?.rounds || []).reduce(
    (total, round) => total + (round.matches || []).filter((match) => getMatchOutcome(match).finished).length,
    0
  );
  const completedMatches = completedGroupMatches + completedBracketMatches;
  const remainingMatches = Math.max(0, duration.totalMatches - completedMatches);
  const remainingMinutes = Math.ceil(remainingMatches / Math.max(1, Number(state.settings?.courtCount || 1))) * Number(state.settings?.matchDuration || 20);

  const startTime = state.settings?.startTime || '09:00';

  const toMinutes = (timeValue) => {
    const [hours = '0', minutes = '0'] = String(timeValue || '00:00').split(':');
    return (Number(hours) * 60) + Number(minutes);
  };

  const machineTimeMinutes = toMinutes(nowTime);
  const startTimeMinutes = toMinutes(startTime);

  // Use the machine time as soon as the planned tournament start has passed,
  // or as soon as at least one match has been completed. This makes the ETA react
  // to delays/advance during the day.
  const shouldUseMachineTime = completedMatches > 0 || machineTimeMinutes >= startTimeMinutes;
  const baseTime = shouldUseMachineTime ? nowTime : startTime;

  const projectedEndTime = addMinutesToTime(baseTime, shouldUseMachineTime ? remainingMinutes : duration.totalMinutes);

  return {
    ...duration,
    completedMatches,
    remainingMatches,
    remainingMinutes,
    projectedEndTime,
    baseTimeUsed: baseTime,
    machineTimeUsed: shouldUseMachineTime
  };
}


export function getChampion(state) {
  const finalRound = state.bracket?.rounds?.[state.bracket.rounds.length - 1];
  const finalMatch = finalRound?.matches?.[0];
  if (!finalMatch?.winnerId) return null;
  return byId(state.players, finalMatch.winnerId) || null;
}
