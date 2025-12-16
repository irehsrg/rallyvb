import { Player } from '../types';

// ELO rating system constants
export const K_FACTOR = 32;
export const INITIAL_RATING = 1500;

/**
 * Calculate ELO rating change for a player/team
 * @param teamAvgRating - Average rating of the player's team
 * @param opponentAvgRating - Average rating of opponent team
 * @param won - Whether the player's team won
 * @returns The rating change (positive or negative)
 */
export function calculateEloChange(
  teamAvgRating: number,
  opponentAvgRating: number,
  won: boolean
): number {
  const expectedScore = 1 / (1 + Math.pow(10, (opponentAvgRating - teamAvgRating) / 400));
  const actualScore = won ? 1 : 0;
  return Math.round(K_FACTOR * (actualScore - expectedScore));
}

/**
 * Calculate team balance score
 * @param teamA - Array of players on team A
 * @param teamB - Array of players on team B
 * @returns Balance metrics for the matchup
 */
export function calculateBalanceScore(
  teamA: Player[],
  teamB: Player[]
): { avgA: number; avgB: number; difference: number; fairnessPercent: number } {
  const avgA = teamA.reduce((sum, p) => sum + p.rating, 0) / teamA.length;
  const avgB = teamB.reduce((sum, p) => sum + p.rating, 0) / teamB.length;
  const difference = Math.abs(avgA - avgB);

  // 100% = perfectly balanced, decreases as difference grows
  const fairnessPercent = Math.max(0, 100 - (difference / 10));

  return { avgA, avgB, difference, fairnessPercent };
}
