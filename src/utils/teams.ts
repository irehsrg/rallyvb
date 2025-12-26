import { Player, TeamAssignment } from '../types';

export interface PlayerGroup {
  id: string;
  members: Player[];
}

/**
 * Generate balanced teams using improved snake draft algorithm
 * This ensures players are evenly distributed by skill level
 *
 * @param players - List of checked-in players with ratings
 * @param courtCount - Number of courts available
 * @param teamSize - Players per team (default 6)
 * @param usePositionBalancing - Whether to consider positions when balancing (default true)
 * @param groups - Optional array of player groups to keep together
 * @returns Array of team assignments per court
 */
export function generateTeams(
  players: Player[],
  courtCount: number,
  teamSize: number = 6,
  _usePositionBalancing: boolean = true, // Reserved for future position-aware balancing
  groups: PlayerGroup[] = []
): TeamAssignment[] {
  const totalNeeded = courtCount * teamSize * 2;
  const activePlayers = [...players].slice(0, totalNeeded);

  // Initialize courts
  const courts: { teamA: Player[]; teamB: Player[] }[] = [];
  for (let i = 0; i < courtCount; i++) {
    courts.push({ teamA: [], teamB: [] });
  }

  // Handle player groups first - assign them to teams
  const groupMemberIds = new Set<string>();
  if (groups.length > 0) {
    assignGroupsToTeams(groups, courts, teamSize, groupMemberIds);
  }

  // Filter out players already in groups
  const remainingPlayers = activePlayers.filter(p => !groupMemberIds.has(p.id));

  // Sort players by rating (highest first)
  const sortedPlayers = remainingPlayers.sort((a, b) => b.rating - a.rating);

  if (courtCount === 1) {
    // Single court: use optimized balancing for one game
    assignPlayersToSingleCourt(sortedPlayers, courts[0], teamSize);
  } else {
    // Multiple courts: use snake draft across all courts
    assignPlayersToMultipleCourts(sortedPlayers, courts, teamSize);
  }

  // Post-process: try to balance teams by swapping players if needed
  for (const court of courts) {
    optimizeTeamBalance(court);
  }

  return courts.map((court, i) => ({
    courtNumber: i + 1,
    teamA: court.teamA,
    teamB: court.teamB,
  }));
}

/**
 * Assign groups to teams, keeping group members together
 */
function assignGroupsToTeams(
  groups: PlayerGroup[],
  courts: { teamA: Player[]; teamB: Player[] }[],
  teamSize: number,
  groupMemberIds: Set<string>
): void {
  // Sort groups by average rating (highest first)
  const sortedGroups = [...groups].sort((a, b) => {
    const avgA = a.members.reduce((sum, p) => sum + p.rating, 0) / a.members.length;
    const avgB = b.members.reduce((sum, p) => sum + p.rating, 0) / b.members.length;
    return avgB - avgA;
  });

  // Use snake draft for groups across teams
  const teams: Player[][] = courts.flatMap(c => [c.teamA, c.teamB]);
  let teamIndex = 0;
  let direction = 1;

  for (const group of sortedGroups) {
    // Find a team with enough space
    let attempts = 0;
    while (attempts < teams.length) {
      if (teams[teamIndex].length + group.members.length <= teamSize) {
        teams[teamIndex].push(...group.members);
        group.members.forEach(p => groupMemberIds.add(p.id));
        break;
      }
      teamIndex += direction;
      if (teamIndex >= teams.length || teamIndex < 0) {
        direction *= -1;
        teamIndex += direction;
      }
      attempts++;
    }

    // Move to next team for next group
    teamIndex += direction;
    if (teamIndex >= teams.length || teamIndex < 0) {
      direction *= -1;
      teamIndex += direction;
    }
  }
}

/**
 * Optimized assignment for single court - ensures best possible balance
 */
function assignPlayersToSingleCourt(
  sortedPlayers: Player[],
  court: { teamA: Player[]; teamB: Player[] },
  teamSize: number
): void {
  const teamASize = Math.min(teamSize, sortedPlayers.length - court.teamB.length);
  const teamBSize = Math.min(teamSize, sortedPlayers.length - court.teamA.length);
  const availableSlots = {
    A: teamASize - court.teamA.length,
    B: teamBSize - court.teamB.length,
  };

  // Snake draft: 1st to A, 2nd to B, 3rd to B, 4th to A, 5th to A, 6th to B, etc.
  let currentTeam: 'A' | 'B' = 'A';
  let countInRound = 0;
  let roundSize = 1; // First round is 1, then alternates 2
  let isFirstRound = true;

  for (const player of sortedPlayers) {
    if (availableSlots[currentTeam] > 0) {
      if (currentTeam === 'A') {
        court.teamA.push(player);
      } else {
        court.teamB.push(player);
      }
      availableSlots[currentTeam]--;
    } else {
      // Other team must have space
      const otherTeam = currentTeam === 'A' ? 'B' : 'A';
      if (otherTeam === 'A') {
        court.teamA.push(player);
      } else {
        court.teamB.push(player);
      }
      availableSlots[otherTeam]--;
    }

    countInRound++;
    if (countInRound >= roundSize) {
      countInRound = 0;
      currentTeam = currentTeam === 'A' ? 'B' : 'A';
      if (isFirstRound) {
        isFirstRound = false;
        roundSize = 2;
      }
    }
  }
}

/**
 * Snake draft across multiple courts
 */
function assignPlayersToMultipleCourts(
  sortedPlayers: Player[],
  courts: { teamA: Player[]; teamB: Player[] }[],
  teamSize: number
): void {
  // Flatten all teams for snake draft
  const teams: Player[][] = courts.flatMap(c => [c.teamA, c.teamB]);
  const teamSizes = teams.map(t => teamSize - t.length); // Available slots

  let teamIndex = 0;
  let direction = 1;

  for (const player of sortedPlayers) {
    // Find next team with available space
    let attempts = 0;
    while (teamSizes[teamIndex] <= 0 && attempts < teams.length) {
      teamIndex += direction;
      if (teamIndex >= teams.length) {
        direction = -1;
        teamIndex = teams.length - 1;
      } else if (teamIndex < 0) {
        direction = 1;
        teamIndex = 0;
      }
      attempts++;
    }

    if (teamSizes[teamIndex] > 0) {
      teams[teamIndex].push(player);
      teamSizes[teamIndex]--;
    }

    // Move to next position in snake
    teamIndex += direction;
    if (teamIndex >= teams.length) {
      direction = -1;
      teamIndex = teams.length - 1;
    } else if (teamIndex < 0) {
      direction = 1;
      teamIndex = 0;
    }
  }
}

/**
 * Try to optimize team balance by swapping players if beneficial
 */
function optimizeTeamBalance(court: { teamA: Player[]; teamB: Player[] }): void {
  const maxIterations = 20;
  let improved = true;
  let iterations = 0;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    const avgA = getTeamAverage(court.teamA);
    const avgB = getTeamAverage(court.teamB);
    const currentDiff = Math.abs(avgA - avgB);

    // If already well balanced, stop
    if (currentDiff < 10) break;

    // Try swapping each pair of players
    for (let i = 0; i < court.teamA.length && !improved; i++) {
      for (let j = 0; j < court.teamB.length && !improved; j++) {
        // Calculate what the new averages would be if we swapped
        const playerA = court.teamA[i];
        const playerB = court.teamB[j];

        const newSumA = court.teamA.reduce((sum, p) => sum + p.rating, 0) - playerA.rating + playerB.rating;
        const newSumB = court.teamB.reduce((sum, p) => sum + p.rating, 0) - playerB.rating + playerA.rating;
        const newAvgA = newSumA / court.teamA.length;
        const newAvgB = newSumB / court.teamB.length;
        const newDiff = Math.abs(newAvgA - newAvgB);

        // If this swap improves balance, do it
        if (newDiff < currentDiff - 5) { // Must improve by at least 5 points
          court.teamA[i] = playerB;
          court.teamB[j] = playerA;
          improved = true;
        }
      }
    }
  }
}

function getTeamAverage(players: Player[]): number {
  if (players.length === 0) return 0;
  return players.reduce((sum, p) => sum + p.rating, 0) / players.length;
}
