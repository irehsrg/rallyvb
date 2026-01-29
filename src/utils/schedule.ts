import { supabase } from '../lib/supabase';

interface ScheduledGame {
  tournament_id: string;
  team_a_id: string;
  team_b_id: string;
  week_number: number;
  scheduled_date?: string;
  scheduled_time?: string; // e.g., "17:45"
  match_round: string;
  court_number: number;
  status: 'pending' | 'in_progress' | 'completed';
}

interface TeamInfo {
  team_id: string;
  team_name: string;
}

interface TimeSlotConfig {
  firstGameTime?: string; // e.g., "17:45"
  gameDurationMinutes?: number; // e.g., 45
  courtsAvailable?: number; // e.g., 2
}

/**
 * Generate a season schedule for a tournament
 * Uses round-robin format spread across the specified weeks
 */
export async function generateSeasonSchedule(
  tournamentId: string,
  teams: TeamInfo[],
  seasonWeeks: number,
  gamesPerWeek: number,
  startDate: string,
  timeConfig?: TimeSlotConfig
): Promise<{ success: boolean; error?: string; gamesCreated?: number }> {
  try {
    if (teams.length < 2) {
      return { success: false, error: 'Need at least 2 teams to generate schedule' };
    }

    // Generate all round-robin matchups
    const allMatchups: { teamA: TeamInfo; teamB: TeamInfo }[] = [];
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        allMatchups.push({ teamA: teams[i], teamB: teams[j] });
      }
    }

    // Shuffle matchups for variety
    shuffleArray(allMatchups);

    // Distribute games across weeks
    const scheduledGames: ScheduledGame[] = [];
    const startDateObj = new Date(startDate);
    let matchupIndex = 0;
    let gameNumber = 1;

    for (let week = 1; week <= seasonWeeks && matchupIndex < allMatchups.length; week++) {
      // Calculate the date for this week
      const weekDate = new Date(startDateObj);
      weekDate.setDate(weekDate.getDate() + (week - 1) * 7);
      const weekDateStr = weekDate.toISOString().split('T')[0];

      // Track games per team this week to respect gamesPerWeek limit
      const teamGamesThisWeek = new Map<string, number>();

      // Schedule games for this week
      const weekMatchups = [];

      // First pass: find valid matchups for this week
      for (let i = matchupIndex; i < allMatchups.length && weekMatchups.length < gamesPerWeek * (teams.length / 2); i++) {
        const matchup = allMatchups[i];
        const teamAGames = teamGamesThisWeek.get(matchup.teamA.team_id) || 0;
        const teamBGames = teamGamesThisWeek.get(matchup.teamB.team_id) || 0;

        // Check if both teams can play another game this week
        if (teamAGames < gamesPerWeek && teamBGames < gamesPerWeek) {
          weekMatchups.push({ matchup, originalIndex: i });
          teamGamesThisWeek.set(matchup.teamA.team_id, teamAGames + 1);
          teamGamesThisWeek.set(matchup.teamB.team_id, teamBGames + 1);
        }
      }

      // Add games for this week with time slots
      const courts = timeConfig?.courtsAvailable || 1;
      const gameDuration = timeConfig?.gameDurationMinutes || 45;
      const firstTime = timeConfig?.firstGameTime || '18:00';

      for (let i = 0; i < weekMatchups.length; i++) {
        const { matchup } = weekMatchups[i];
        const courtNum = (i % courts) + 1;
        const timeSlotIndex = Math.floor(i / courts);
        const gameTime = addMinutesToTime(firstTime, timeSlotIndex * gameDuration);

        scheduledGames.push({
          tournament_id: tournamentId,
          team_a_id: matchup.teamA.team_id,
          team_b_id: matchup.teamB.team_id,
          week_number: week,
          scheduled_date: weekDateStr,
          scheduled_time: gameTime,
          match_round: `week_${week}`,
          court_number: courtNum,
          status: 'pending',
        });
        gameNumber++;
      }

      // Remove used matchups from the pool
      const usedIndices = new Set(weekMatchups.map(w => w.originalIndex));
      const remainingMatchups = allMatchups.filter((_, idx) => !usedIndices.has(idx));
      allMatchups.length = 0;
      allMatchups.push(...remainingMatchups);
    }

    // If we still have matchups left, distribute them in additional weeks
    let extraWeek = seasonWeeks + 1;
    const courts = timeConfig?.courtsAvailable || 1;
    const gameDuration = timeConfig?.gameDurationMinutes || 45;
    const firstTime = timeConfig?.firstGameTime || '18:00';

    while (allMatchups.length > 0) {
      const weekDate = new Date(startDateObj);
      weekDate.setDate(weekDate.getDate() + (extraWeek - 1) * 7);
      const weekDateStr = weekDate.toISOString().split('T')[0];

      const teamGamesThisWeek = new Map<string, number>();
      const weekMatchups: typeof allMatchups = [];

      for (let i = 0; i < allMatchups.length; i++) {
        const matchup = allMatchups[i];
        const teamAGames = teamGamesThisWeek.get(matchup.teamA.team_id) || 0;
        const teamBGames = teamGamesThisWeek.get(matchup.teamB.team_id) || 0;

        if (teamAGames < gamesPerWeek && teamBGames < gamesPerWeek) {
          const gameIndex = weekMatchups.length;
          const courtNum = (gameIndex % courts) + 1;
          const timeSlotIndex = Math.floor(gameIndex / courts);
          const gameTime = addMinutesToTime(firstTime, timeSlotIndex * gameDuration);

          scheduledGames.push({
            tournament_id: tournamentId,
            team_a_id: matchup.teamA.team_id,
            team_b_id: matchup.teamB.team_id,
            week_number: extraWeek,
            scheduled_date: weekDateStr,
            scheduled_time: gameTime,
            match_round: `week_${extraWeek}`,
            court_number: courtNum,
            status: 'pending',
          });
          weekMatchups.push(matchup);
          teamGamesThisWeek.set(matchup.teamA.team_id, teamAGames + 1);
          teamGamesThisWeek.set(matchup.teamB.team_id, teamBGames + 1);
        }
      }

      // Remove scheduled matchups
      const scheduledSet = new Set(weekMatchups);
      allMatchups.splice(0, allMatchups.length, ...allMatchups.filter(m => !scheduledSet.has(m)));
      extraWeek++;

      // Safety break
      if (extraWeek > seasonWeeks + 20) break;
    }

    // Insert all games into database
    const { error } = await supabase.from('games').insert(scheduledGames);

    if (error) {
      return { success: false, error: error.message };
    }

    // Mark schedule as generated
    await supabase
      .from('tournaments')
      .update({ schedule_generated: true })
      .eq('id', tournamentId);

    return { success: true, gamesCreated: scheduledGames.length };
  } catch (error: any) {
    console.error('Error generating schedule:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Generate playoff bracket from season standings
 */
export async function generatePlayoffBracket(
  tournamentId: string,
  topTeams: number = 8 // Number of teams to include in playoffs
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get tournament teams with their season records
    const { data: tournamentTeams, error: teamsError } = await supabase
      .from('tournament_teams')
      .select(`
        *,
        team:teams(id, name)
      `)
      .eq('tournament_id', tournamentId)
      .order('wins', { ascending: false });

    if (teamsError) throw teamsError;

    // Take top N teams for playoffs
    const playoffTeams = tournamentTeams?.slice(0, topTeams) || [];

    if (playoffTeams.length < 2) {
      return { success: false, error: 'Not enough teams for playoffs' };
    }

    // Calculate bracket size
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(playoffTeams.length)));
    const rounds = Math.log2(bracketSize);

    // Generate bracket pairings (1 vs 8, 4 vs 5, 2 vs 7, 3 vs 6 for 8 teams)
    const bracketOrder = generateBracketOrder(bracketSize);
    const games: any[] = [];

    // First round
    const firstRoundName = getRoundName(0, rounds);
    for (let i = 0; i < bracketSize / 2; i++) {
      const seedA = bracketOrder[i * 2];
      const seedB = bracketOrder[i * 2 + 1];
      const teamA = playoffTeams[seedA - 1];
      const teamB = playoffTeams[seedB - 1];

      games.push({
        tournament_id: tournamentId,
        team_a_id: teamA?.team_id || null,
        team_b_id: teamB?.team_id || null,
        match_round: firstRoundName,
        court_number: i + 1,
        status: 'pending',
        // Handle byes
        ...(teamA && !teamB ? { match_winner: 'A', status: 'completed' } : {}),
        ...(!teamA && teamB ? { match_winner: 'B', status: 'completed' } : {}),
      });
    }

    // Subsequent rounds (placeholders)
    for (let round = 1; round < rounds; round++) {
      const roundName = getRoundName(round, rounds);
      const matchesInRound = Math.pow(2, rounds - round - 1);

      for (let i = 0; i < matchesInRound; i++) {
        games.push({
          tournament_id: tournamentId,
          team_a_id: null,
          team_b_id: null,
          match_round: roundName,
          court_number: i + 1,
          status: 'pending',
        });
      }
    }

    // Insert playoff games
    const { error } = await supabase.from('games').insert(games);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error generating playoff bracket:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get season standings for a tournament
 */
export async function getSeasonStandings(tournamentId: string): Promise<{
  standings: Array<{
    team_id: string;
    team_name: string;
    wins: number;
    losses: number;
    points_for: number;
    points_against: number;
    point_diff: number;
    win_pct: number;
  }>;
}> {
  // Get all completed games
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('status', 'completed')
    .like('match_round', 'week_%');

  // Get teams
  const { data: tournamentTeams } = await supabase
    .from('tournament_teams')
    .select('team_id, team:teams(id, name)')
    .eq('tournament_id', tournamentId);

  const standings = new Map<string, {
    team_id: string;
    team_name: string;
    wins: number;
    losses: number;
    points_for: number;
    points_against: number;
  }>();

  // Initialize standings
  tournamentTeams?.forEach((tt: any) => {
    standings.set(tt.team_id, {
      team_id: tt.team_id,
      team_name: tt.team?.name || 'Unknown',
      wins: 0,
      losses: 0,
      points_for: 0,
      points_against: 0,
    });
  });

  // Calculate from games
  games?.forEach((game: any) => {
    const teamA = standings.get(game.team_a_id);
    const teamB = standings.get(game.team_b_id);

    if (teamA) {
      teamA.points_for += game.score_a || 0;
      teamA.points_against += game.score_b || 0;
      if (game.match_winner === 'A') teamA.wins++;
      else if (game.match_winner === 'B') teamA.losses++;
    }

    if (teamB) {
      teamB.points_for += game.score_b || 0;
      teamB.points_against += game.score_a || 0;
      if (game.match_winner === 'B') teamB.wins++;
      else if (game.match_winner === 'A') teamB.losses++;
    }
  });

  // Convert to array and calculate derived stats
  const standingsArray = Array.from(standings.values()).map(s => ({
    ...s,
    point_diff: s.points_for - s.points_against,
    win_pct: s.wins + s.losses > 0 ? s.wins / (s.wins + s.losses) : 0,
  }));

  // Sort by wins, then point diff
  standingsArray.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.point_diff - a.point_diff;
  });

  return { standings: standingsArray };
}

// Helper functions
function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function generateBracketOrder(size: number): number[] {
  if (size === 2) return [1, 2];
  const half = size / 2;
  const top = generateBracketOrder(half);
  const result: number[] = [];
  for (const seed of top) {
    result.push(seed);
    result.push(size + 1 - seed);
  }
  return result;
}

function getRoundName(roundIndex: number, totalRounds: number): string {
  const fromEnd = totalRounds - roundIndex;
  if (fromEnd === 1) return 'finals';
  if (fromEnd === 2) return 'semifinals';
  if (fromEnd === 3) return 'quarterfinals';
  return `round_${roundIndex + 1}`;
}

/**
 * Add minutes to a time string (HH:MM format)
 */
function addMinutesToTime(time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMins = totalMinutes % 60;
  return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
}

/**
 * Format time for display (e.g., "17:45" -> "5:45 PM")
 */
export function formatTime(time: string): string {
  const [hours, mins] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`;
}
