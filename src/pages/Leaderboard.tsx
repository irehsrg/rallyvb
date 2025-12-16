import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Player } from '../types';
import { useAuth } from '../contexts/AuthContext';
import HeadToHeadModal from '../components/HeadToHeadModal';

export default function Leaderboard() {
  const { player: currentPlayer } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'active'>('all');
  const [selectedOpponent, setSelectedOpponent] = useState<Player | null>(null);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  useEffect(() => {
    let filtered = players;

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter((player) =>
        player.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by type
    if (filterType === 'active') {
      filtered = filtered.filter((player) => player.games_played > 0);
    }

    setFilteredPlayers(filtered);
  }, [searchQuery, filterType, players]);

  const fetchLeaderboard = async () => {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .order('rating', { ascending: false });

      if (error) throw error;
      setPlayers(data || []);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-rally-coral"></div>
      </div>
    );
  }

  const getRankBadge = (index: number) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `#${index + 1}`;
  };

  const getRankColor = (index: number) => {
    if (index === 0) return 'from-yellow-400 to-yellow-600';
    if (index === 1) return 'from-gray-300 to-gray-500';
    if (index === 2) return 'from-orange-400 to-orange-600';
    return 'from-rally-coral to-rally-accent';
  };

  return (
    <div className="min-h-screen bg-rally-darker">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-4xl font-bold text-gray-100 mb-2">Leaderboard</h1>
          <p className="text-gray-400">Top players ranked by ELO rating</p>
        </div>

        {/* Search and Filter */}
        <div className="mb-6 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-modern w-full pl-12"
            />
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${
                filterType === 'all'
                  ? 'bg-rally-coral text-white'
                  : 'bg-rally-dark/50 text-gray-400 hover:bg-rally-dark'
              }`}
            >
              All Players
            </button>
            <button
              onClick={() => setFilterType('active')}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${
                filterType === 'active'
                  ? 'bg-rally-coral text-white'
                  : 'bg-rally-dark/50 text-gray-400 hover:bg-rally-dark'
              }`}
            >
              Active Only
            </button>
          </div>
        </div>

        {/* Leaderboard Grid */}
        <div className="space-y-3 animate-slide-up">
          {filteredPlayers.map((player, index) => {
            const winRate = player.games_played > 0
              ? Math.round((player.wins / player.games_played) * 100)
              : 0;

            return (
              <div
                key={player.id}
                className="card-glass p-5 hover:scale-[1.02] transition-all duration-300 group"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="flex items-center gap-4">
                  {/* Rank Badge */}
                  <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${getRankColor(index)} flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform`}>
                    <span className="text-2xl font-bold text-white">
                      {getRankBadge(index)}
                    </span>
                  </div>

                  {/* Player Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-gray-100 truncate">
                        {player.name}
                      </h3>
                      {player.is_admin && (
                        <span className="px-2 py-0.5 text-xs bg-rally-coral/20 text-rally-coral rounded-lg border border-rally-coral/30 font-medium">
                          ADMIN
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                        </svg>
                        {player.games_played} games
                      </span>
                      <span className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${winRate >= 50 ? 'bg-green-400' : 'bg-red-400'}`}></div>
                        {winRate}% win
                      </span>
                      {player.win_streak > 0 && (
                        <span className="flex items-center gap-1 text-orange-400">
                          🔥 {player.win_streak}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Rating Display - Responsive */}
                  <div className="text-right flex-shrink-0 ml-2">
                    <div className="text-2xl sm:text-3xl font-bold text-gradient-rally">
                      {player.rating}
                    </div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider hidden sm:block">Rating</div>
                  </div>

                  {/* Stats Grid (Desktop) */}
                  <div className="hidden lg:flex items-center gap-6 ml-6 pl-6 border-l border-white/10">
                    <div className="text-center">
                      <div className="text-xl font-bold text-green-400">{player.wins}</div>
                      <div className="text-xs text-gray-500">Wins</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-red-400">{player.losses}</div>
                      <div className="text-xs text-gray-500">Losses</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-purple-400">{player.best_win_streak}</div>
                      <div className="text-xs text-gray-500">Best Streak</div>
                    </div>
                  </div>

                  {/* H2H Button */}
                  {currentPlayer && currentPlayer.id !== player.id && (
                    <button
                      onClick={() => setSelectedOpponent(player)}
                      className="hidden sm:block ml-4 px-4 py-2 rounded-lg bg-rally-dark/50 hover:bg-rally-coral/20 text-gray-400 hover:text-rally-coral border border-transparent hover:border-rally-coral/30 transition-all text-sm font-medium"
                    >
                      H2H
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filteredPlayers.length === 0 && !loading && (
          <div className="card-glass p-12 text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="text-xl font-semibold text-gray-300 mb-2">
              {searchQuery ? 'No players found' : 'No players yet'}
            </h3>
            <p className="text-gray-500">
              {searchQuery ? 'Try adjusting your search' : 'Be the first to sign up!'}
            </p>
          </div>
        )}

        {/* Head-to-Head Modal */}
        {currentPlayer && selectedOpponent && (
          <HeadToHeadModal
            currentPlayer={currentPlayer}
            opponent={selectedOpponent}
            onClose={() => setSelectedOpponent(null)}
          />
        )}
      </div>
    </div>
  );
}
