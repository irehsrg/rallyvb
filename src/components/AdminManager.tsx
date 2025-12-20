import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Player, AdminRole } from '../types';
import { getAdminRoleDisplayName, getAdminRoleDescription } from '../utils/permissions';

export default function AdminManager() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [selectedRole, setSelectedRole] = useState<AdminRole | ''>('');

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

  const handleUpdateRole = async () => {
    if (!editingPlayer) return;

    try {
      const isAdmin = selectedRole !== '';
      const adminRole = selectedRole || null;

      const { error } = await supabase
        .from('players')
        .update({
          is_admin: isAdmin,
          admin_role: adminRole,
        })
        .eq('id', editingPlayer.id);

      if (error) throw error;

      await fetchPlayers();
      setEditingPlayer(null);
      setSelectedRole('');
      alert('Admin role updated successfully!');
    } catch (error: any) {
      console.error('Error updating role:', error);
      alert('Failed to update role: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-rally-coral"></div>
      </div>
    );
  }

  return (
    <div className="card-glass p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-100">Admin Management</h2>
        <p className="text-sm text-gray-400 mt-1">Manage admin roles and permissions</p>
      </div>

      {/* Role Legend */}
      <div className="mb-6 p-4 bg-rally-dark/50 rounded-xl">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Admin Roles:</h3>
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded border border-purple-500/30 font-medium whitespace-nowrap">
              Super Admin
            </span>
            <span className="text-xs text-gray-400">{getAdminRoleDescription('super_admin')}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded border border-blue-500/30 font-medium whitespace-nowrap">
              Location Admin
            </span>
            <span className="text-xs text-gray-400">{getAdminRoleDescription('location_admin')}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded border border-green-500/30 font-medium whitespace-nowrap">
              Scorekeeper
            </span>
            <span className="text-xs text-gray-400">{getAdminRoleDescription('scorekeeper')}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded border border-yellow-500/30 font-medium whitespace-nowrap">
              Team Manager
            </span>
            <span className="text-xs text-gray-400">{getAdminRoleDescription('team_manager')}</span>
          </div>
        </div>
      </div>

      {/* Players List */}
      <div className="space-y-2">
        {players.map((player) => (
          <div
            key={player.id}
            className="p-4 rounded-xl border-2 bg-rally-dark/50 border-white/10 hover:border-rally-coral/30 transition-all"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-bold text-gray-100 truncate">{player.name}</h3>
                  {player.is_admin && player.admin_role && (
                    <span
                      className={`px-2 py-0.5 text-xs rounded border font-medium ${
                        player.admin_role === 'super_admin'
                          ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                          : player.admin_role === 'location_admin'
                          ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                          : player.admin_role === 'team_manager'
                          ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                          : 'bg-green-500/20 text-green-400 border-green-500/30'
                      }`}
                    >
                      {getAdminRoleDisplayName(player.admin_role)}
                    </span>
                  )}
                  {!player.is_admin && (
                    <span className="px-2 py-0.5 text-xs bg-gray-600/20 text-gray-400 rounded border border-gray-600/30">
                      Player
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-400">
                  Rating: {player.rating} • {player.games_played} games
                </div>
              </div>
              <button
                onClick={() => {
                  setEditingPlayer(player);
                  setSelectedRole((player.admin_role || '') as AdminRole | '');
                }}
                className="px-3 py-1.5 rounded-lg bg-rally-dark hover:bg-rally-light text-gray-300 text-sm transition-all whitespace-nowrap"
              >
                Edit Role
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Role Modal */}
      {editingPlayer && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="card-glass p-8 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-100">Edit Admin Role</h2>
              <button
                onClick={() => {
                  setEditingPlayer(null);
                  setSelectedRole('');
                }}
                className="text-gray-400 hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <div className="text-sm text-gray-400 mb-2">Player</div>
                <div className="text-lg font-semibold text-gray-100">{editingPlayer.name}</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Admin Role
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as AdminRole | '')}
                  className="input-modern w-full"
                >
                  <option value="">No Admin Access (Regular Player)</option>
                  <option value="scorekeeper">Scorekeeper</option>
                  <option value="team_manager">Team Manager</option>
                  <option value="location_admin">Location Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>

                {/* Show description of selected role */}
                {selectedRole && (
                  <div className="mt-2 p-3 bg-rally-dark/50 rounded-lg">
                    <p className="text-xs text-gray-400">
                      {getAdminRoleDescription(selectedRole as AdminRole)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setEditingPlayer(null);
                  setSelectedRole('');
                }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateRole}
                className="btn-primary flex-1"
              >
                Update Role
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
