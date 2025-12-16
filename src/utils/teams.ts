import { Player, TeamAssignment } from '../types';

/**
 * Generate balanced teams using serpentine draft algorithm
 * @param players - List of checked-in players with ratings
 * @param courtCount - Number of courts available
 * @param teamSize - Players per team (default 6)
 * @returns Array of team assignments per court
 */
export function generateTeams(
  players: Player[],
  courtCount: number,
  teamSize: number = 6
): TeamAssignment[] {
  // Sort players by rating (highest first)
  const sorted = [...players].sort((a, b) => b.rating - a.rating);

  const totalNeeded = courtCount * teamSize * 2;
  const activePlayers = sorted.slice(0, totalNeeded);

  // Initialize courts
  const courts: { teamA: Player[]; teamB: Player[] }[] = [];
  for (let i = 0; i < courtCount; i++) {
    courts.push({ teamA: [], teamB: [] });
  }

  // Serpentine assignment
  let courtIndex = 0;
  let teamKey: 'teamA' | 'teamB' = 'teamA';
  let direction = 1;

  for (const player of activePlayers) {
    courts[courtIndex][teamKey].push(player);

    // Move to next team/court in serpentine pattern
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
