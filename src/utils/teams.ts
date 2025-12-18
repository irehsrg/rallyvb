import { Player, TeamAssignment } from '../types';

export interface PlayerGroup {
  id: string;
  members: Player[];
}

/**
 * Generate balanced teams using serpentine draft algorithm with position awareness
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
  usePositionBalancing: boolean = true,
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
    // Sort groups by average rating (highest first) for balanced distribution
    const sortedGroups = groups.sort((a, b) => {
      const avgA = a.members.reduce((sum, p) => sum + p.rating, 0) / a.members.length;
      const avgB = b.members.reduce((sum, p) => sum + p.rating, 0) / b.members.length;
      return avgB - avgA;
    });

    // Assign groups to teams using serpentine pattern
    let courtIndex = 0;
    let teamKey: 'teamA' | 'teamB' = 'teamA';
    let direction = 1;

    for (const group of sortedGroups) {
      // Find next team with enough space
      let attempts = 0;
      const maxAttempts = courtCount * 2; // teamA and teamB for each court

      while (attempts < maxAttempts) {
        const currentTeam = courts[courtIndex][teamKey];

        if (currentTeam.length + group.members.length <= teamSize) {
          // Add all group members to the same team
          currentTeam.push(...group.members);
          group.members.forEach(p => groupMemberIds.add(p.id));
          break;
        }

        // Move to next team
        if (teamKey === 'teamA') {
          teamKey = 'teamB';
        } else {
          teamKey = 'teamA';
          courtIndex += direction;

          if (courtIndex >= courtCount || courtIndex < 0) {
            direction *= -1;
            courtIndex += direction;
          }
        }
        attempts++;
      }

      // After placing a group, move to next team
      if (teamKey === 'teamA') {
        teamKey = 'teamB';
      } else {
        teamKey = 'teamA';
        courtIndex += direction;

        if (courtIndex >= courtCount || courtIndex < 0) {
          direction *= -1;
          courtIndex += direction;
        }
      }
    }
  }

  // Filter out players already in groups
  const remainingPlayers = activePlayers.filter(p => !groupMemberIds.has(p.id));

  if (usePositionBalancing && remainingPlayers.some(p => p.position && p.position !== 'any')) {
    // Position-based balancing for remaining players
    fillTeamsWithPositionBalancing(remainingPlayers, courts, teamSize);
    return courts.map((court, i) => ({
      courtNumber: i + 1,
      teamA: court.teamA,
      teamB: court.teamB,
    }));
  }

  // Standard rating-based serpentine assignment for remaining players
  const sorted = remainingPlayers.sort((a, b) => b.rating - a.rating);
  let courtIndex = 0;
  let teamKey: 'teamA' | 'teamB' = 'teamA';
  let direction = 1;

  for (const player of sorted) {
    // Find the next non-full team
    let attempts = 0;
    while (courts[courtIndex][teamKey].length >= teamSize && attempts < courtCount * 2) {
      if (teamKey === 'teamA') {
        teamKey = 'teamB';
      } else {
        teamKey = 'teamA';
        courtIndex += direction;

        if (courtIndex >= courtCount || courtIndex < 0) {
          direction *= -1;
          courtIndex += direction;
        }
      }
      attempts++;
    }

    if (courts[courtIndex][teamKey].length < teamSize) {
      courts[courtIndex][teamKey].push(player);
    }

    if (teamKey === 'teamA') {
      teamKey = 'teamB';
    } else {
      teamKey = 'teamA';
      courtIndex += direction;

      if (courtIndex >= courtCount || courtIndex < 0) {
        direction *= -1;
        courtIndex += direction;
      }
    }
  }

  return courts.map((court, i) => ({
    courtNumber: i + 1,
    teamA: court.teamA,
    teamB: court.teamB,
  }));
}

/**
 * Fill existing teams (courts) with remaining players using position-based balancing
 */
function fillTeamsWithPositionBalancing(
  players: Player[],
  courts: { teamA: Player[]; teamB: Player[] }[],
  teamSize: number
): void {
  // Group players by position and sort by rating within each position
  const positions = {
    setter: players.filter(p => p.position === 'setter').sort((a, b) => b.rating - a.rating),
    libero: players.filter(p => p.position === 'libero').sort((a, b) => b.rating - a.rating),
    outside: players.filter(p => p.position === 'outside').sort((a, b) => b.rating - a.rating),
    middle: players.filter(p => p.position === 'middle').sort((a, b) => b.rating - a.rating),
    opposite: players.filter(p => p.position === 'opposite').sort((a, b) => b.rating - a.rating),
    any: players.filter(p => !p.position || p.position === 'any').sort((a, b) => b.rating - a.rating),
  };

  // Flatten courts into teams array
  const teams: Player[][] = courts.flatMap(c => [c.teamA, c.teamB]);

  // Distribute each position
  distributePositionToTeams(positions.setter, teams, teamSize);
  distributePositionToTeams(positions.libero, teams, teamSize);
  distributePositionToTeams(positions.outside, teams, teamSize);
  distributePositionToTeams(positions.middle, teams, teamSize);
  distributePositionToTeams(positions.opposite, teams, teamSize);
  distributePositionToTeams(positions.any, teams, teamSize);
}

/**
 * Distribute players of a specific position to teams, respecting team size limits
 */
function distributePositionToTeams(positionPlayers: Player[], teams: Player[][], teamSize: number): void {
  let teamIndex = 0;
  let direction = 1;

  for (const player of positionPlayers) {
    // Find next non-full team
    let attempts = 0;
    while (teams[teamIndex].length >= teamSize && attempts < teams.length) {
      teamIndex += direction;

      if (teamIndex >= teams.length || teamIndex < 0) {
        direction *= -1;
        teamIndex += direction;
      }
      attempts++;
    }

    if (teams[teamIndex].length < teamSize) {
      teams[teamIndex].push(player);
    }

    teamIndex += direction;

    if (teamIndex >= teams.length || teamIndex < 0) {
      direction *= -1;
      teamIndex += direction;
    }
  }
}

