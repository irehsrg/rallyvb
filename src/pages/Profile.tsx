import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { RatingHistory, Game } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface GameWithDetails extends Game {
  session?: {
    date: string;
  };
  myTeam?: 'A' | 'B';
  isWinner?: boolean;
  ratingChange?: number;
}

export default function Profile() {
  const { player } = useAuth();
  const [ratingHistory, setRatingHistory] = useState<RatingHistory[]>([]);
  const [gameHistory, setGameHistory] = useState<GameWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (player) {
      Promise.all([fetchRatingHistory(), fetchGameHistory()]);
    }
  }, [player]);

  const fetchRatingHistory = async () => {
    if (!player) return;

    try {
      const { data, error } = await supabase
        .from('rating_history')
        .select('*')
        .eq('player_id', player.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setRatingHistory(data || []);
    } catch (error) {
      console.error('Error fetching rating history:', error);
    }
  };

  const fetchGameHistory = async () => {
    if (!player) return;

    try {
      // Fetch games where player participated
      const { data: gamePlayers, error } = await supabase
        .from('game_players')
        .select(`
          team,
          rating_change,
          game:games (
            id,
            score_a,
            score_b,
            winner,
            status,
            court_number,
            created_at,
            session:sessions (
              date
            )
          )
        `)
        .eq('player_id', player.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      const games: GameWithDetails[] = gamePlayers?.map((gp: any) => ({
        ...gp.game,
        myTeam: gp.team,
        isWinner: gp.game.winner === gp.team,
        ratingChange: gp.rating_change,
        session: gp.game.session,
      })) || [];

      setGameHistory(games);
    } catch (error) {
      console.error('Error fetching game history:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!player) {
    return (
      <div className="min-h-screen bg-rally-darker flex items-center justify-center">
        <div className="text-gray-400">Please sign in to view your profile</div>
      </div>
    );
  }

  const winRate = player.games_played > 0
    ? ((player.wins / player.games_played) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="min-h-screen bg-rally-darker">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Header */}
        <div className="card-glass p-8 mb-8 animate-fade-in">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            {/* Avatar */}
            <div className="relative">
              <div className="w-32 h-32 rounded-3xl bg-gradient-rally flex items-center justify-center shadow-2xl shadow-rally-coral/50">
                <span className="text-5xl font-bold text-white">
                  {player.name.charAt(0).toUpperCase()}
                </span>
              </div>
              {player.is_admin && (
                <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-rally-dark rounded-xl border-2 border-rally-coral flex items-center justify-center">
                  <svg className="w-5 h-5 text-rally-coral" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              )}
            </div>

            {/* Player Info */}
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-4xl font-bold text-gray-100 mb-2">{player.name}</h1>
              <p className="text-gray-400 mb-4">
                Member since {new Date(player.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>

              {player.is_admin && (
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-rally-coral/20 text-rally-coral rounded-xl border border-rally-coral/30">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span className="font-semibold">Administrator</span>
                </span>
              )}
            </div>

            {/* Current Rating Badge */}
            <div className="card-glass px-8 py-6 text-center">
              <div className="text-sm text-gray-400 mb-2">Current Rating</div>
              <div className="text-5xl font-bold text-gradient-rally">
                {player.rating}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 animate-slide-up">
          <div className="stat-card">
            <div className="text-4xl font-bold text-gray-100">{player.games_played}</div>
            <div className="text-sm text-gray-400 mt-2">Games Played</div>
          </div>

          <div className="stat-card">
            <div className="text-4xl font-bold text-gray-100">
              {player.wins}-{player.losses}
            </div>
            <div className="text-sm text-gray-400 mt-2">Win-Loss</div>
          </div>

          <div className="stat-card">
            <div className={`text-4xl font-bold ${parseFloat(winRate) >= 50 ? 'text-green-400' : 'text-red-400'}`}>
              {winRate}%
            </div>
            <div className="text-sm text-gray-400 mt-2">Win Rate</div>
          </div>

          <div className="stat-card">
            <div className="text-4xl font-bold text-orange-400">
              {player.win_streak > 0 ? `🔥 ${player.win_streak}` : '-'}
            </div>
            <div className="text-sm text-gray-400 mt-2">Current Streak</div>
          </div>
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="card-glass p-6">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">Career Highlights</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-rally-dark/50 rounded-xl">
                <span className="text-gray-400">Best Win Streak</span>
                <span className="text-xl font-bold text-gray-100">{player.best_win_streak}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-rally-dark/50 rounded-xl">
                <span className="text-gray-400">Total Wins</span>
                <span className="text-xl font-bold text-green-400">{player.wins}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-rally-dark/50 rounded-xl">
                <span className="text-gray-400">Last Played</span>
                <span className="text-sm font-medium text-gray-300">
                  {player.last_played_at
                    ? new Date(player.last_played_at).toLocaleDateString()
                    : 'Never'}
                </span>
              </div>
            </div>
          </div>

          <div className="card-glass p-6">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">Performance</h3>
            <div className="space-y-4">
              {/* Win Rate Bar */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Win Rate</span>
                  <span className="font-semibold text-gray-100">{winRate}%</span>
                </div>
                <div className="h-3 bg-rally-dark rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500 rounded-full"
                    style={{ width: `${winRate}%` }}
                  ></div>
                </div>
              </div>

              {/* Games Distribution */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Win/Loss Distribution</span>
                </div>
                <div className="flex h-3 bg-rally-dark rounded-full overflow-hidden">
                  <div
                    className="bg-green-500"
                    style={{ width: `${winRate}%` }}
                  ></div>
                  <div
                    className="bg-red-500"
                    style={{ width: `${100 - parseFloat(winRate)}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-green-400">{player.wins} W</span>
                  <span className="text-red-400">{player.losses} L</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Game History */}
        <div className="card-glass p-6 mb-8 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <h3 className="text-xl font-semibold text-gray-100 mb-6">Recent Games</h3>

          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading...</div>
          ) : gameHistory.length > 0 ? (
            <div className="space-y-3">
              {gameHistory.map((game, index) => (
                <div
                  key={game.id}
                  className="flex items-center justify-between p-4 bg-rally-dark/50 rounded-xl hover:bg-rally-dark/70 transition-colors"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl ${
                      game.isWinner
                        ? 'bg-green-500/20 border border-green-500/30'
                        : 'bg-red-500/20 border border-red-500/30'
                    } flex items-center justify-center`}>
                      <span className={`text-xl font-bold ${game.isWinner ? 'text-green-400' : 'text-red-400'}`}>
                        {game.isWinner ? 'W' : 'L'}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-100">
                          Team {game.myTeam}
                        </span>
                        <span className="text-xs text-gray-500">•</span>
                        <span className="text-sm text-gray-400">
                          Court {game.court_number}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {game.session?.date && new Date(game.session.date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-100 mb-1">
                      {game.score_a} - {game.score_b}
                    </div>
                    {game.ratingChange !== null && game.ratingChange !== undefined && (
                      <span className={`text-sm font-bold ${
                        game.ratingChange > 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {game.ratingChange > 0 ? '+' : ''}
                        {game.ratingChange}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h4 className="text-lg font-semibold text-gray-300 mb-2">No games yet</h4>
              <p className="text-gray-500">Your game history will appear here!</p>
            </div>
          )}
        </div>

        {/* Rating History */}
        <div className="card-glass p-6 animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <h3 className="text-xl font-semibold text-gray-100 mb-6">Rating History</h3>

          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading...</div>
          ) : ratingHistory.length > 0 ? (
            <>
              {/* Chart */}
              <div className="mb-6" style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={[...ratingHistory].reverse().map((h, i) => ({
                      index: i,
                      rating: h.new_rating,
                      date: new Date(h.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="date"
                      stroke="#9CA3AF"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis
                      stroke="#9CA3AF"
                      style={{ fontSize: '12px' }}
                      domain={['dataMin - 50', 'dataMax + 50']}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: '1px solid #374151',
                        borderRadius: '12px',
                        color: '#F3F4F6',
                      }}
                      labelStyle={{ color: '#9CA3AF' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="rating"
                      stroke="#E07C7C"
                      strokeWidth={3}
                      dot={{ fill: '#E07C7C', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Recent Changes List */}
              <div>
                <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Recent Changes
                </h4>
                <div className="space-y-2">
                  {ratingHistory.slice(0, 5).map((history, index) => (
                    <div
                      key={history.id}
                      className="flex items-center justify-between p-3 bg-rally-dark/50 rounded-xl"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg ${
                          history.change > 0
                            ? 'bg-green-500/20 border border-green-500/30'
                            : 'bg-red-500/20 border border-red-500/30'
                        } flex items-center justify-center`}>
                          <span className={`text-sm ${history.change > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {history.change > 0 ? '↑' : '↓'}
                          </span>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400">
                            {new Date(history.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                          <div className="text-sm font-medium text-gray-300">
                            {history.previous_rating} → {history.new_rating}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-lg font-bold ${
                          history.change > 0 ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {history.change > 0 ? '+' : ''}
                        {history.change}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h4 className="text-lg font-semibold text-gray-300 mb-2">No rating history yet</h4>
              <p className="text-gray-500">Play some games to see your rating changes!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
