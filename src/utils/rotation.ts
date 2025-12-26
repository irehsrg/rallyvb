import { SessionTeam, Game, RotationMode } from '../types';

export interface RoundMatchup {
  teamA: SessionTeam;
  teamB: SessionTeam;
  courtNumber: number;
}

export interface RotationResult {
  matchups: RoundMatchup[];
  benchedTeams: SessionTeam[];
  roundNumber: number;
}

/**
 * Generate the next round of games based on rotation mode
 */
export function generateNextRound(
  teams: SessionTeam[],
  completedGames: Game[],
  rotationMode: RotationMode,
  courtCount: number,
  currentRound: number
): RotationResult {
  switch (rotationMode) {
    case 'king_of_court':
      return generateKingOfCourtRound(teams, completedGames, courtCount, currentRound);
    case 'round_robin':
      return generateRoundRobinRound(teams, completedGames, courtCount, currentRound);
    case 'swiss':
      return generateSwissRound(teams, completedGames, courtCount, currentRound);
    case 'speed':
      return generateSpeedRound(teams, completedGames, courtCount, currentRound);
    case 'manual':
    default:
      return generateManualRound(teams, courtCount, currentRound);
  }
}

/**
 * King of Court: Winners stay on, losers rotate out
 * - First round: Teams assigned to courts, extra teams wait
 * - Subsequent rounds: Winners stay, losers go to bench, bench team comes in
 */
function generateKingOfCourtRound(
  teams: SessionTeam[],
  completedGames: Game[],
  courtCount: number,
  currentRound: number
): RotationResult {
  const matchups: RoundMatchup[] = [];
  const teamsPerCourt = 2;
  const activeTeamsNeeded = courtCount * teamsPerCourt;

  if (currentRound === 1) {
    // First round: Just assign teams to courts in order
    for (let court = 0; court < courtCount && court * 2 + 1 < teams.length; court++) {
      matchups.push({
        teamA: teams[court * 2],
        teamB: teams[court * 2 + 1],
        courtNumber: court + 1,
      });
    }
    const benchedTeams = teams.slice(activeTeamsNeeded);
    return { matchups, benchedTeams, roundNumber: currentRound };
  }

  // Get last round's games
  const lastRoundGames = completedGames.filter(g => g.round_number === currentRound - 1);

  // Determine winners and losers from last round
  const winners: SessionTeam[] = [];
  const losers: SessionTeam[] = [];
  const previouslyBenched: SessionTeam[] = [];

  // Find which teams played and which were benched
  const playedTeamIds = new Set<string>();
  lastRoundGames.forEach(game => {
    if (game.session_team_a_id) playedTeamIds.add(game.session_team_a_id);
    if (game.session_team_b_id) playedTeamIds.add(game.session_team_b_id);

    const teamA = teams.find(t => t.id === game.session_team_a_id);
    const teamB = teams.find(t => t.id === game.session_team_b_id);

    if (game.winner === 'A' && teamA && teamB) {
      winners.push(teamA);
      losers.push(teamB);
    } else if (game.winner === 'B' && teamA && teamB) {
      winners.push(teamB);
      losers.push(teamA);
    }
  });

  teams.forEach(team => {
    if (!playedTeamIds.has(team.id)) {
      previouslyBenched.push(team);
    }
  });

  // New matchups: winners stay, benched teams come in, losers go to bench
  const nextBenched: SessionTeam[] = [...losers];
  const activePlayers = [...winners, ...previouslyBenched];

  for (let court = 0; court < courtCount && court * 2 + 1 < activePlayers.length; court++) {
    matchups.push({
      teamA: activePlayers[court * 2],
      teamB: activePlayers[court * 2 + 1],
      courtNumber: court + 1,
    });
  }

  // Any remaining active players go to bench
  const assignedCount = matchups.length * 2;
  if (assignedCount < activePlayers.length) {
    nextBenched.push(...activePlayers.slice(assignedCount));
  }

  return { matchups, benchedTeams: nextBenched, roundNumber: currentRound };
}

/**
 * Round Robin: Every team plays every other team exactly once
 * Uses circle method for optimal scheduling
 */
function generateRoundRobinRound(
  teams: SessionTeam[],
  completedGames: Game[],
  courtCount: number,
  currentRound: number
): RotationResult {
  // Find which matchups haven't been played yet
  const playedMatchups = new Set<string>();
  completedGames.forEach(game => {
    if (game.session_team_a_id && game.session_team_b_id) {
      const key1 = `${game.session_team_a_id}-${game.session_team_b_id}`;
      const key2 = `${game.session_team_b_id}-${game.session_team_a_id}`;
      playedMatchups.add(key1);
      playedMatchups.add(key2);
    }
  });

  // Generate all possible matchups that haven't been played
  const remainingMatchups: { teamA: SessionTeam; teamB: SessionTeam }[] = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const key = `${teams[i].id}-${teams[j].id}`;
      if (!playedMatchups.has(key)) {
        remainingMatchups.push({ teamA: teams[i], teamB: teams[j] });
      }
    }
  }

  // Schedule up to courtCount games, trying to include each team at most once
  const matchups: RoundMatchup[] = [];
  const scheduledTeamIds = new Set<string>();

  for (const matchup of remainingMatchups) {
    if (matchups.length >= courtCount) break;
    if (scheduledTeamIds.has(matchup.teamA.id) || scheduledTeamIds.has(matchup.teamB.id)) {
      continue;
    }
    matchups.push({
      teamA: matchup.teamA,
      teamB: matchup.teamB,
      courtNumber: matchups.length + 1,
    });
    scheduledTeamIds.add(matchup.teamA.id);
    scheduledTeamIds.add(matchup.teamB.id);
  }

  // Teams not playing this round are benched
  const benchedTeams = teams.filter(t => !scheduledTeamIds.has(t.id));

  return { matchups, benchedTeams, roundNumber: currentRound };
}

/**
 * Swiss: Winners play winners, losers play losers
 * After all games, teams play teams with similar records
 */
function generateSwissRound(
  teams: SessionTeam[],
  completedGames: Game[],
  courtCount: number,
  currentRound: number
): RotationResult {
  // Calculate records for each team
  const teamRecords = new Map<string, { wins: number; losses: number; pointDiff: number }>();
  teams.forEach(t => teamRecords.set(t.id, { wins: 0, losses: 0, pointDiff: 0 }));

  completedGames.forEach(game => {
    if (!game.session_team_a_id || !game.session_team_b_id) return;

    const scoreA = game.score_a || 0;
    const scoreB = game.score_b || 0;
    const diff = scoreA - scoreB;

    const recordA = teamRecords.get(game.session_team_a_id);
    const recordB = teamRecords.get(game.session_team_b_id);

    if (recordA && recordB) {
      if (game.winner === 'A') {
        recordA.wins++;
        recordB.losses++;
      } else if (game.winner === 'B') {
        recordB.wins++;
        recordA.losses++;
      }
      recordA.pointDiff += diff;
      recordB.pointDiff -= diff;
    }
  });

  // Track which teams have played each other
  const playedMatchups = new Set<string>();
  completedGames.forEach(game => {
    if (game.session_team_a_id && game.session_team_b_id) {
      playedMatchups.add(`${game.session_team_a_id}-${game.session_team_b_id}`);
      playedMatchups.add(`${game.session_team_b_id}-${game.session_team_a_id}`);
    }
  });

  // Sort teams by record (wins desc, then point diff desc)
  const sortedTeams = [...teams].sort((a, b) => {
    const recordA = teamRecords.get(a.id)!;
    const recordB = teamRecords.get(b.id)!;
    if (recordA.wins !== recordB.wins) return recordB.wins - recordA.wins;
    return recordB.pointDiff - recordA.pointDiff;
  });

  // Pair teams with similar records who haven't played each other
  const matchups: RoundMatchup[] = [];
  const scheduledTeamIds = new Set<string>();

  for (let i = 0; i < sortedTeams.length && matchups.length < courtCount; i++) {
    const teamA = sortedTeams[i];
    if (scheduledTeamIds.has(teamA.id)) continue;

    // Find best opponent (closest in standings, hasn't played yet)
    for (let j = i + 1; j < sortedTeams.length; j++) {
      const teamB = sortedTeams[j];
      if (scheduledTeamIds.has(teamB.id)) continue;

      const matchupKey = `${teamA.id}-${teamB.id}`;
      if (!playedMatchups.has(matchupKey)) {
        matchups.push({
          teamA,
          teamB,
          courtNumber: matchups.length + 1,
        });
        scheduledTeamIds.add(teamA.id);
        scheduledTeamIds.add(teamB.id);
        break;
      }
    }
  }

  const benchedTeams = teams.filter(t => !scheduledTeamIds.has(t.id));

  return { matchups, benchedTeams, roundNumber: currentRound };
}

/**
 * Manual mode: Admin picks matchups, but we can suggest based on who hasn't played
 */
function generateManualRound(
  teams: SessionTeam[],
  courtCount: number,
  currentRound: number
): RotationResult {
  // For manual mode, just suggest teams in order as a starting point
  const matchups: RoundMatchup[] = [];

  for (let court = 0; court < courtCount && court * 2 + 1 < teams.length; court++) {
    matchups.push({
      teamA: teams[court * 2],
      teamB: teams[court * 2 + 1],
      courtNumber: court + 1,
    });
  }

  const benchedTeams = teams.slice(courtCount * 2);

  return { matchups, benchedTeams, roundNumber: currentRound };
}

/**
 * Speed mode: Rapid rotation, winners stay, losers immediately swap out
 * - No rating changes (too playful/casual)
 * - Losing team runs off immediately, next waiting team runs on
 * - Optimized for quick games and continuous play
 * - Uses a FIFO queue for waiting teams
 */
function generateSpeedRound(
  teams: SessionTeam[],
  completedGames: Game[],
  courtCount: number,
  currentRound: number
): RotationResult {
  const matchups: RoundMatchup[] = [];

  if (currentRound === 1) {
    // First round: Assign teams to courts in order, rest wait in queue
    for (let court = 0; court < courtCount && court * 2 + 1 < teams.length; court++) {
      matchups.push({
        teamA: teams[court * 2],
        teamB: teams[court * 2 + 1],
        courtNumber: court + 1,
      });
    }
    const benchedTeams = teams.slice(courtCount * 2);
    return { matchups, benchedTeams, roundNumber: currentRound };
  }

  // Get last round's games to determine winners and losers
  const lastRoundGames = completedGames.filter(g => g.round_number === currentRound - 1);

  // Track who played in last round
  const playedTeamIds = new Set<string>();
  const winners: SessionTeam[] = [];
  const losers: SessionTeam[] = [];

  lastRoundGames.forEach(game => {
    if (game.session_team_a_id) playedTeamIds.add(game.session_team_a_id);
    if (game.session_team_b_id) playedTeamIds.add(game.session_team_b_id);

    const teamA = teams.find(t => t.id === game.session_team_a_id);
    const teamB = teams.find(t => t.id === game.session_team_b_id);

    if (game.winner === 'A' && teamA && teamB) {
      winners.push(teamA);
      losers.push(teamB);
    } else if (game.winner === 'B' && teamA && teamB) {
      winners.push(teamB);
      losers.push(teamA);
    }
  });

  // Build waiting queue: teams that didn't play last round
  const waitingQueue: SessionTeam[] = [];
  teams.forEach(team => {
    if (!playedTeamIds.has(team.id)) {
      waitingQueue.push(team);
    }
  });

  // Speed mode: Winners stay on court, waiting teams come in to challenge
  // Losers go to the back of the waiting queue
  const nextWaiting = [...losers]; // Losers go to back of queue
  const challengers = waitingQueue.slice(0, winners.length); // Take enough to match winners

  // Remaining waiting teams stay in queue
  if (waitingQueue.length > winners.length) {
    nextWaiting.push(...waitingQueue.slice(winners.length));
  }

  // Create matchups: each winner plays a challenger
  for (let i = 0; i < winners.length && i < challengers.length; i++) {
    matchups.push({
      teamA: winners[i],
      teamB: challengers[i],
      courtNumber: i + 1,
    });
  }

  // If we have more winners than challengers, winners play each other
  if (winners.length > challengers.length) {
    const unmatched = winners.slice(challengers.length);
    for (let i = 0; i + 1 < unmatched.length && matchups.length < courtCount; i += 2) {
      matchups.push({
        teamA: unmatched[i],
        teamB: unmatched[i + 1],
        courtNumber: matchups.length + 1,
      });
    }
    // If odd number of unmatched winners, one waits
    if (unmatched.length % 2 === 1) {
      nextWaiting.unshift(unmatched[unmatched.length - 1]); // Put at front since they won
    }
  }

  return { matchups, benchedTeams: nextWaiting, roundNumber: currentRound };
}

/**
 * Calculate team standings from completed games
 */
export function calculateStandings(teams: SessionTeam[], games: Game[]): SessionTeam[] {
  const standings = teams.map(team => {
    let wins = 0;
    let losses = 0;
    let pointDiff = 0;

    games.forEach(game => {
      if (game.status !== 'completed') return;

      const scoreA = game.score_a || 0;
      const scoreB = game.score_b || 0;

      if (game.session_team_a_id === team.id) {
        if (game.winner === 'A') wins++;
        else if (game.winner === 'B') losses++;
        pointDiff += scoreA - scoreB;
      } else if (game.session_team_b_id === team.id) {
        if (game.winner === 'B') wins++;
        else if (game.winner === 'A') losses++;
        pointDiff += scoreB - scoreA;
      }
    });

    return { ...team, wins, losses, point_differential: pointDiff };
  });

  // Sort by wins desc, then point diff desc
  return standings.sort((a, b) => {
    if ((a.wins || 0) !== (b.wins || 0)) return (b.wins || 0) - (a.wins || 0);
    return (b.point_differential || 0) - (a.point_differential || 0);
  });
}

/**
 * Check if round robin is complete (all teams have played each other)
 */
export function isRoundRobinComplete(teams: SessionTeam[], games: Game[]): boolean {
  const playedMatchups = new Set<string>();
  games.forEach(game => {
    if (game.session_team_a_id && game.session_team_b_id && game.status === 'completed') {
      const key = [game.session_team_a_id, game.session_team_b_id].sort().join('-');
      playedMatchups.add(key);
    }
  });

  const totalMatchupsNeeded = (teams.length * (teams.length - 1)) / 2;
  return playedMatchups.size >= totalMatchupsNeeded;
}

/**
 * Get rotation mode display name
 */
export function getRotationModeName(mode: RotationMode): string {
  switch (mode) {
    case 'king_of_court':
      return 'King of the Court';
    case 'round_robin':
      return 'Round Robin';
    case 'swiss':
      return 'Swiss (Winners vs Winners)';
    case 'speed':
      return 'Speed Mode';
    case 'manual':
    default:
      return 'Manual';
  }
}

/**
 * Get rotation mode description
 */
export function getRotationModeDescription(mode: RotationMode): string {
  switch (mode) {
    case 'king_of_court':
      return 'Winners stay on court, losers rotate to bench';
    case 'round_robin':
      return 'Every team plays every other team once';
    case 'swiss':
      return 'Teams with similar records play each other';
    case 'speed':
      return 'Rapid rotation, no rating changes - losers run off, next team runs on';
    case 'manual':
    default:
      return 'Manually assign matchups each round';
  }
}

/**
 * Check if rotation mode should skip rating changes
 */
export function shouldSkipRatings(mode: RotationMode): boolean {
  return mode === 'speed';
}
