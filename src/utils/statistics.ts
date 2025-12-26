import { supabase } from '../lib/supabase';
import {
  GlobalStatistics,
  RatingBucket,
  PlayerActivity,
  GameOutcomeDistribution,
  HeadToHeadStats,
  HeadToHeadGame,
} from '../types';

// Fetch global overview statistics
export async function fetchGlobalStatistics(venueId?: string): Promise<GlobalStatistics> {
  // Get total players (excluding guests)
  const { count: totalPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('is_guest', false);

  // Get completed games with optional venue filter
  let gamesQuery = supabase
    .from('games')
    .select(`
      id,
      score_a,
      score_b,
      session:sessions!inner(venue_id)
    `)
    .eq('status', 'completed')
    .not('score_a', 'is', null)
    .not('score_b', 'is', null);

  if (venueId) {
    gamesQuery = gamesQuery.eq('session.venue_id', venueId);
  }

  const { data: games } = await gamesQuery;

  const totalGames = games?.length || 0;

  // Calculate point differential and close game stats
  let totalDifferential = 0;
  let closeGames = 0;

  games?.forEach(game => {
    const diff = Math.abs((game.score_a || 0) - (game.score_b || 0));
    totalDifferential += diff;
    if (diff <= 3) closeGames++;
  });

  const avgPointDifferential = totalGames > 0 ? totalDifferential / totalGames : 0;
  const closeGamePercentage = totalGames > 0 ? (closeGames / totalGames) * 100 : 0;

  // Calculate avg total points per game
  const totalPoints = games?.reduce((sum, g) => sum + (g.score_a || 0) + (g.score_b || 0), 0) || 0;
  const avgTotalPoints = totalGames > 0 ? totalPoints / totalGames : 0;

  return {
    totalPlayers: totalPlayers || 0,
    totalGames,
    avgPointDifferential: Math.round(avgPointDifferential * 10) / 10,
    closeGamePercentage: Math.round(closeGamePercentage),
    avgTotalPoints: Math.round(avgTotalPoints * 10) / 10,
  };
}

// Fetch rating distribution buckets
export async function fetchRatingDistribution(venueId?: string): Promise<RatingBucket[]> {
  let query = supabase
    .from('players')
    .select('rating')
    .eq('is_guest', false)
    .gt('games_played', 0);

  // If venue filter, only include players who have played at that venue
  if (venueId) {
    const { data: venuePlayers } = await supabase
      .from('session_checkins')
      .select('player_id, session:sessions!inner(venue_id)')
      .eq('session.venue_id', venueId);

    const playerIds = [...new Set(venuePlayers?.map(p => p.player_id) || [])];
    if (playerIds.length > 0) {
      query = query.in('id', playerIds);
    } else {
      return [];
    }
  }

  const { data: players } = await query;

  if (!players) return [];

  // Create buckets of 100 rating points
  const bucketMap: Map<number, number> = new Map();

  players.forEach(p => {
    const bucket = Math.floor(p.rating / 100) * 100;
    bucketMap.set(bucket, (bucketMap.get(bucket) || 0) + 1);
  });

  // Fill in empty buckets between min and max
  const buckets = Array.from(bucketMap.keys()).sort((a, b) => a - b);
  if (buckets.length === 0) return [];

  const minBucket = buckets[0];
  const maxBucket = buckets[buckets.length - 1];

  const result: RatingBucket[] = [];
  for (let b = minBucket; b <= maxBucket; b += 100) {
    result.push({ bucket: b, count: bucketMap.get(b) || 0 });
  }

  return result;
}

// Fetch most active players in last 30 days
export async function fetchActivePlayerLeaderboard(venueId?: string, limit = 10): Promise<PlayerActivity[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let query = supabase
    .from('game_players')
    .select(`
      player_id,
      rating_before,
      rating_after,
      game:games!inner(
        created_at,
        status,
        session:sessions!inner(venue_id)
      )
    `)
    .eq('game.status', 'completed')
    .gte('game.created_at', thirtyDaysAgo.toISOString());

  if (venueId) {
    query = query.eq('game.session.venue_id', venueId);
  }

  const { data: gameData } = await query;

  if (!gameData) return [];

  // Aggregate by player
  const playerMap: Map<string, {
    gamesPlayed: number;
    firstRating: number;
    lastRating: number;
  }> = new Map();

  gameData.forEach(gp => {
    const existing = playerMap.get(gp.player_id);
    if (!existing) {
      playerMap.set(gp.player_id, {
        gamesPlayed: 1,
        firstRating: gp.rating_before,
        lastRating: gp.rating_after || gp.rating_before,
      });
    } else {
      existing.gamesPlayed++;
      existing.lastRating = gp.rating_after || existing.lastRating;
    }
  });

  // Sort by games played and take top N
  const playerIds = [...playerMap.entries()]
    .sort((a, b) => b[1].gamesPlayed - a[1].gamesPlayed)
    .slice(0, limit)
    .map(([id]) => id);

  if (playerIds.length === 0) return [];

  // Fetch player details
  const { data: players } = await supabase
    .from('players')
    .select('id, name, rating, profile_photo_url')
    .in('id', playerIds);

  const playerDetails = new Map(players?.map(p => [p.id, p]) || []);

  return playerIds.map(id => {
    const stats = playerMap.get(id)!;
    const player = playerDetails.get(id);
    return {
      playerId: id,
      playerName: player?.name || 'Unknown',
      profilePhotoUrl: player?.profile_photo_url,
      gamesLastMonth: stats.gamesPlayed,
      ratingChange: stats.lastRating - stats.firstRating,
      currentRating: player?.rating || stats.lastRating,
    };
  });
}

// Fetch game outcome distribution
export async function fetchGameOutcomeDistribution(venueId?: string): Promise<GameOutcomeDistribution> {
  let query = supabase
    .from('games')
    .select(`
      score_a,
      score_b,
      session:sessions!inner(venue_id)
    `)
    .eq('status', 'completed')
    .not('score_a', 'is', null)
    .not('score_b', 'is', null);

  if (venueId) {
    query = query.eq('session.venue_id', venueId);
  }

  const { data: games } = await query;

  const distribution: GameOutcomeDistribution = {
    close: 0,
    moderate: 0,
    blowout: 0,
  };

  games?.forEach(game => {
    const diff = Math.abs((game.score_a || 0) - (game.score_b || 0));
    if (diff <= 3) {
      distribution.close++;
    } else if (diff <= 7) {
      distribution.moderate++;
    } else {
      distribution.blowout++;
    }
  });

  return distribution;
}

// Fetch head-to-head stats between two players
export async function fetchHeadToHead(player1Id: string, player2Id: string): Promise<HeadToHeadStats | null> {
  // Fetch player details
  const { data: players } = await supabase
    .from('players')
    .select('*')
    .in('id', [player1Id, player2Id]);

  if (!players || players.length < 2) return null;

  const player1 = players.find(p => p.id === player1Id)!;
  const player2 = players.find(p => p.id === player2Id)!;

  // Find games where both players participated
  const { data: player1Games } = await supabase
    .from('game_players')
    .select('game_id, team')
    .eq('player_id', player1Id);

  const { data: player2Games } = await supabase
    .from('game_players')
    .select('game_id, team')
    .eq('player_id', player2Id);

  if (!player1Games || !player2Games) {
    return {
      player1,
      player2,
      player1Wins: 0,
      player2Wins: 0,
      totalGames: 0,
      recentGames: [],
    };
  }

  const p1GameMap = new Map(player1Games.map(g => [g.game_id, g.team]));
  const p2GameMap = new Map(player2Games.map(g => [g.game_id, g.team]));

  // Find games where they were on opposite teams
  const sharedGameIds = [...p1GameMap.keys()].filter(gameId => {
    const p1Team = p1GameMap.get(gameId);
    const p2Team = p2GameMap.get(gameId);
    return p2Team && p1Team !== p2Team;
  });

  if (sharedGameIds.length === 0) {
    return {
      player1,
      player2,
      player1Wins: 0,
      player2Wins: 0,
      totalGames: 0,
      recentGames: [],
    };
  }

  // Fetch the actual game data
  const { data: games } = await supabase
    .from('games')
    .select('id, score_a, score_b, winner, created_at, status')
    .in('id', sharedGameIds)
    .eq('status', 'completed')
    .order('created_at', { ascending: false });

  if (!games) {
    return {
      player1,
      player2,
      player1Wins: 0,
      player2Wins: 0,
      totalGames: 0,
      recentGames: [],
    };
  }

  let player1Wins = 0;
  let player2Wins = 0;
  const recentGames: HeadToHeadGame[] = [];

  games.forEach(game => {
    const p1Team = p1GameMap.get(game.id)!;
    const winnerTeam = game.winner;

    if (winnerTeam) {
      if (winnerTeam === p1Team) {
        player1Wins++;
      } else {
        player2Wins++;
      }
    }

    recentGames.push({
      gameId: game.id,
      date: game.created_at,
      winnerId: winnerTeam === p1Team ? player1Id : player2Id,
      scoreA: game.score_a || 0,
      scoreB: game.score_b || 0,
      player1Team: p1Team as 'A' | 'B',
    });
  });

  return {
    player1,
    player2,
    player1Wins,
    player2Wins,
    totalGames: games.length,
    lastPlayed: games[0]?.created_at,
    recentGames: recentGames.slice(0, 10),
  };
}

// Search players for head-to-head lookup
export async function searchPlayers(query: string, excludeIds: string[] = []): Promise<{ id: string; name: string; rating: number; profile_photo_url?: string }[]> {
  let dbQuery = supabase
    .from('players')
    .select('id, name, rating, profile_photo_url')
    .eq('is_guest', false)
    .ilike('name', `%${query}%`)
    .order('rating', { ascending: false })
    .limit(10);

  if (excludeIds.length > 0) {
    dbQuery = dbQuery.not('id', 'in', `(${excludeIds.join(',')})`);
  }

  const { data } = await dbQuery;
  return data || [];
}
