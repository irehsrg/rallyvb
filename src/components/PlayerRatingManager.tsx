import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase, logAdminAction } from '../lib/supabase';
import { Player } from '../types';
import { useAuth } from '../contexts/AuthContext';

export default function PlayerRatingManager() {
  const { player: currentAdmin } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [newRating, setNewRating] = useState<number>(1500);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPlayers();
  }, []);

  const fetchPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('is_guest', false)
        .order('name');

      if (error) throw error;
      setPlayers(data || []);
    } catch (error) {
      console.error('Error fetching players:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditRating = (player: Player) => {
    setEditingPlayer(player);
    setNewRating(player.rating);
  };

  const handleSaveRating = async () => {
    if (!editingPlayer) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('players')
        .update({
          rating: newRating,
          highest_rating: Math.max(newRating, editingPlayer.highest_rating || newRating),
        })
        .eq('id', editingPlayer.id);

      if (error) throw error;

      // Update local state
      setPlayers(players.map(p =>
        p.id === editingPlayer.id
          ? { ...p, rating: newRating, highest_rating: Math.max(newRating, p.highest_rating || newRating) }
          : p
      ));

      // Log the admin action
      if (currentAdmin?.id) {
        await logAdminAction(currentAdmin.id, 'adjust_rating', 'player', editingPlayer.id, {
          player_name: editingPlayer.name,
          previous_rating: editingPlayer.rating,
          new_rating: newRating,
          rating_change: newRating - editingPlayer.rating,
        });
      }

      setEditingPlayer(null);
      alert('Rating updated successfully!');
    } catch (error: any) {
      console.error('Error updating rating:', error);
      alert('Failed to update rating: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredPlayers = players.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-rally-coral"></div>
      </div>
    );
  }

  return (
    <>
      <div className="card-glass p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-100">Player Ratings</h2>
            <p className="text-sm text-gray-400 mt-1">Adjust player ratings manually</p>
          </div>
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search players by name..."
            className="input-modern w-full"
          />
        </div>

        {/* Player List */}
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {filteredPlayers.length === 0 ? (
            <p className="text-center py-8 text-gray-500">
              {searchQuery ? 'No players found' : 'No players yet'}
            </p>
          ) : (
            filteredPlayers.map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between p-4 bg-rally-dark/50 rounded-xl hover:bg-rally-dark/70 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {player.profile_photo_url ? (
                    <img
                      src={player.profile_photo_url}
                      alt={player.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-rally flex items-center justify-center">
                      <span className="text-white font-bold">
                        {player.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-medium text-gray-100 truncate">{player.name}</div>
                    <div className="text-xs text-gray-500">{player.games_played} games played</div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-100">{player.rating}</div>
                    <div className="text-xs text-gray-500">{player.games_played} games</div>
                  </div>
                  <button
                    onClick={() => handleEditRating(player)}
                    className="px-3 py-1.5 rounded-lg bg-rally-coral/20 hover:bg-rally-coral/30 text-rally-coral text-sm font-medium transition-all"
                  >
                    Adjust
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Edit Rating Modal - Portaled to body */}
      {editingPlayer && createPortal(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="card-glass p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-100">Adjust Rating</h3>
              <button
                onClick={() => setEditingPlayer(null)}
                className="text-gray-400 hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4 p-3 bg-rally-dark/50 rounded-xl">
                {editingPlayer.profile_photo_url ? (
                  <img
                    src={editingPlayer.profile_photo_url}
                    alt={editingPlayer.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-rally flex items-center justify-center">
                    <span className="text-white font-bold text-lg">
                      {editingPlayer.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <div className="font-semibold text-gray-100">{editingPlayer.name}</div>
                  <div className="text-sm text-gray-400">
                    Current: {editingPlayer.rating} • {editingPlayer.games_played} games played
                  </div>
                </div>
              </div>

              <label className="block text-sm font-medium text-gray-300 mb-2">
                New Rating
              </label>
              <input
                type="number"
                value={newRating}
                onChange={(e) => setNewRating(Number(e.target.value))}
                className="input-modern w-full text-center text-2xl font-bold"
                min={100}
                max={3000}
              />

              {/* Quick adjust buttons */}
              <div className="flex gap-2 mt-3">
                {[-100, -50, -25, 25, 50, 100].map((delta) => (
                  <button
                    key={delta}
                    onClick={() => setNewRating(Math.max(100, Math.min(3000, newRating + delta)))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      delta < 0
                        ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
                        : 'bg-green-500/20 hover:bg-green-500/30 text-green-400'
                    }`}
                  >
                    {delta > 0 ? '+' : ''}{delta}
                  </button>
                ))}
              </div>

              {/* Preset buttons */}
              <div className="mt-4">
                <label className="block text-xs text-gray-500 mb-2">Presets</label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { label: 'Beginner', value: 1200 },
                    { label: 'Casual', value: 1350 },
                    { label: 'Regular', value: 1500 },
                    { label: 'Experienced', value: 1650 },
                    { label: 'Advanced', value: 1800 },
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => setNewRating(preset.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        newRating === preset.value
                          ? 'bg-rally-coral text-white'
                          : 'bg-rally-dark hover:bg-rally-light text-gray-400'
                      }`}
                    >
                      {preset.label} ({preset.value})
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setEditingPlayer(null)}
                className="btn-secondary flex-1"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRating}
                className="btn-primary flex-1"
                disabled={saving || newRating === editingPlayer.rating}
              >
                {saving ? 'Saving...' : 'Save Rating'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
