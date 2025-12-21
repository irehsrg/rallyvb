import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Player } from '../types';
import { useAuth } from '../contexts/AuthContext';
import HeadToHeadModal from '../components/HeadToHeadModal';

interface RatingAdjustmentModalProps {
  player: Player;
  onClose: () => void;
  onUpdate: () => void;
}

function RatingAdjustmentModal({ player, onClose, onUpdate }: RatingAdjustmentModalProps) {
  const [newRating, setNewRating] = useState(player.rating);
  const [reason, setReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const handleAdjust = async () => {
    if (!reason.trim()) {
      alert('Please provide a reason for the adjustment');
      return;
    }

    if (newRating === player.rating) {
      alert('Rating is unchanged');
      return;
    }

    setAdjusting(true);
    try {
      const { error } = await supabase
        .from('players')
        .update({ rating: newRating })
        .eq('id', player.id);

      if (error) throw error;

      // Log the adjustment in rating_history
      await supabase.from('rating_history').insert({
        player_id: player.id,
        game_id: null, // null indicates manual adjustment
        previous_rating: player.rating,
        new_rating: newRating,
        change: newRating - player.rating,
        reason,
      });

      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error adjusting rating:', error);
      alert('Failed to adjust rating');
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="card-glass p-8 max-w-md w-full">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-100">Adjust Rating</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <div className="text-sm text-gray-400 mb-2">Player</div>
            <div className="text-lg font-semibold text-gray-100">{player.name}</div>
          </div>

          <div>
            <div className="text-sm text-gray-400 mb-2">Current Rating</div>
            <div className="text-3xl font-bold text-gradient-rally">{player.rating}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              New Rating
            </label>
            <input
              type="number"
              value={newRating}
              onChange={(e) => setNewRating(parseInt(e.target.value) || player.rating)}
              className="input-modern w-full"
              min="0"
              max="3000"
            />
            {newRating !== player.rating && (
              <div className={`text-sm mt-2 font-medium ${
                newRating > player.rating ? 'text-green-400' : 'text-red-400'
              }`}>
                {newRating > player.rating ? '+' : ''}{newRating - player.rating} change
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Reason for Adjustment <span className="text-red-400">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input-modern w-full"
              rows={3}
              placeholder="e.g. Incorrect initial rating, tournament performance..."
              maxLength={200}
            />
            <p className="text-xs text-gray-500 mt-1">
              {reason.length} / 200 characters
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={handleAdjust}
            disabled={adjusting || !reason.trim() || newRating === player.rating}
            className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {adjusting ? 'Adjusting...' : 'Adjust Rating'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Leaderboard() {
  const { player: currentPlayer } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'active'>('all');
  const [selectedOpponent, setSelectedOpponent] = useState<Player | null>(null);
  const [playerToAdjust, setPlayerToAdjust] = useState<Player | null>(null);

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
        .eq('is_guest', false) // Exclude guest players from leaderboard
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
              className="input-modern w-full"
            />
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
            // Get actual rank from full leaderboard
            const actualRank = players.findIndex(p => p.id === player.id);
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
                  <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${getRankColor(actualRank)} flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform`}>
                    <span className="text-2xl font-bold text-white">
                      {getRankBadge(actualRank)}
                    </span>
                  </div>

                  {/* Player Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Link
                        to={`/player/${player.id}`}
                        className="text-lg font-bold text-gray-100 truncate hover:text-rally-coral transition-colors"
                      >
                        {player.name}
                      </Link>
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

                  {/* Action Buttons */}
                  <div className="hidden sm:flex items-center gap-2 ml-4">
                    {/* Admin: Adjust Rating */}
                    {currentPlayer?.is_admin && (
                      <button
                        onClick={() => setPlayerToAdjust(player)}
                        className="px-4 py-2 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 hover:text-orange-300 border border-transparent hover:border-orange-500/30 transition-all text-sm font-medium"
                      >
                        <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Adjust
                      </button>
                    )}

                    {/* H2H Button */}
                    {currentPlayer && currentPlayer.id !== player.id && (
                      <button
                        onClick={() => setSelectedOpponent(player)}
                        className="px-4 py-2 rounded-lg bg-rally-dark/50 hover:bg-rally-coral/20 text-gray-400 hover:text-rally-coral border border-transparent hover:border-rally-coral/30 transition-all text-sm font-medium"
                      >
                        H2H
                      </button>
                    )}
                  </div>
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

        {/* Rating Adjustment Modal */}
        {playerToAdjust && (
          <RatingAdjustmentModal
            player={playerToAdjust}
            onClose={() => setPlayerToAdjust(null)}
            onUpdate={() => {
              fetchLeaderboard();
              setPlayerToAdjust(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
