import { useState, useEffect } from 'react';
import { supabase, logAdminAction } from '../lib/supabase';
import { Team, TeamMember, Player } from '../types';
import { useAuth } from '../contexts/AuthContext';

export default function TeamManager() {
  const { player } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [managingRoster, setManagingRoster] = useState<Team | null>(null);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select(`
          *,
          members:team_members(
            *,
            player:players(*)
          )
        `)
        .order('name');

      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (team: Team) => {
    try {
      const newActiveState = !team.is_active;
      const { error } = await supabase
        .from('teams')
        .update({ is_active: newActiveState })
        .eq('id', team.id);

      if (error) throw error;

      // Log the admin action
      if (player?.id) {
        await logAdminAction(player.id, newActiveState ? 'activate_team' : 'deactivate_team', 'team', team.id, {
          team_name: team.name,
        });
      }

      await fetchTeams();
    } catch (error) {
      console.error('Error toggling team:', error);
      alert('Failed to update team status');
    }
  };

  const handleDelete = async (team: Team) => {
    if (!confirm('Are you sure you want to delete this team? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', team.id);

      if (error) throw error;

      // Log the admin action
      if (player?.id) {
        await logAdminAction(player.id, 'delete_team', 'team', team.id, {
          team_name: team.name,
          member_count: team.members?.filter(m => m.is_active).length || 0,
        });
      }

      await fetchTeams();
    } catch (error) {
      console.error('Error deleting team:', error);
      alert('Failed to delete team');
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
    <>
    <div className="card-glass p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-100">Teams</h2>
          <p className="text-sm text-gray-400 mt-1">Manage teams and rosters for tournaments</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary"
        >
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Team
          </span>
        </button>
      </div>

      {teams.length === 0 ? (
        <div className="text-center py-12">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-300 mb-2">No teams yet</h3>
          <p className="text-gray-500 mb-6">Create your first team to get started with tournaments</p>
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            Create Team
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {teams.map((team) => {
            const activeMembers = team.members?.filter(m => m.is_active) || [];
            const managers = activeMembers.filter(m => m.role === 'manager');
            const winRate = team.wins + team.losses > 0
              ? Math.round((team.wins / (team.wins + team.losses)) * 100)
              : 0;

            return (
              <div
                key={team.id}
                className={`p-4 rounded-xl border-2 transition-all ${
                  team.is_active
                    ? 'bg-rally-dark/50 border-white/10 hover:border-rally-coral/30'
                    : 'bg-gray-800/30 border-gray-700/50 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-bold text-gray-100 truncate">{team.name}</h3>
                      {!team.is_active && (
                        <span className="px-2 py-0.5 text-xs bg-gray-600/20 text-gray-400 rounded-lg border border-gray-600/30">
                          Inactive
                        </span>
                      )}
                    </div>

                    {team.description && (
                      <p className="text-sm text-gray-400 mb-2">{team.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                        </svg>
                        <span className="text-gray-300">{activeMembers.length} members</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-gray-300">{team.wins}W - {team.losses}L</span>
                      </div>

                      {winRate > 0 && (
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${winRate >= 50 ? 'bg-green-400' : 'bg-red-400'}`}></div>
                          <span className="text-gray-300">{winRate}% win rate</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <span className="text-gray-300">{team.tournaments_played} tournaments</span>
                      </div>
                    </div>

                    {managers.length > 0 && (
                      <div className="mt-2 text-xs text-gray-500">
                        Managers: {managers.map(m => m.player?.name).join(', ')}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => setManagingRoster(team)}
                      className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 text-sm font-medium transition-all text-center"
                    >
                      Manage Roster
                    </button>
                    <button
                      onClick={() => setEditingTeam(team)}
                      className="px-3 py-1.5 rounded-lg bg-rally-dark hover:bg-rally-light text-gray-300 text-sm transition-all text-center"
                    >
                      Edit Details
                    </button>
                    <button
                      onClick={() => handleToggleActive(team)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all text-center ${
                        team.is_active
                          ? 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/30'
                          : 'bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30'
                      }`}
                    >
                      {team.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleDelete(team)}
                      className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm transition-all text-center"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>

    {/* Team Form Modal - Outside card-glass for proper z-index */}
    {(showAddModal || editingTeam) && (
      <TeamFormModal
        team={editingTeam}
        currentUserId={player?.id}
        adminId={player?.id}
        onClose={() => {
          setShowAddModal(false);
          setEditingTeam(null);
        }}
        onSuccess={() => {
          fetchTeams();
          setShowAddModal(false);
          setEditingTeam(null);
        }}
      />
    )}

    {/* Roster Management Modal - Outside card-glass for proper z-index */}
    {managingRoster && (
      <RosterManagementModal
        team={managingRoster}
        adminId={player?.id}
        onClose={() => setManagingRoster(null)}
        onSuccess={() => {
          fetchTeams();
          setManagingRoster(null);
        }}
      />
    )}
    </>
  );
}

// Team Form Modal Component
interface TeamFormModalProps {
  team: Team | null;
  currentUserId?: string;
  adminId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

function TeamFormModal({ team, currentUserId, adminId, onClose, onSuccess }: TeamFormModalProps) {
  const [name, setName] = useState(team?.name || '');
  const [description, setDescription] = useState(team?.description || '');
  const [logoUrl, setLogoUrl] = useState(team?.logo_url || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Please provide a team name');
      return;
    }

    setSaving(true);
    try {
      if (team) {
        // Update existing team
        const { error } = await supabase
          .from('teams')
          .update({
            name: name.trim(),
            description: description.trim() || null,
            logo_url: logoUrl.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', team.id);

        if (error) throw error;

        // Log the admin action
        if (adminId) {
          await logAdminAction(adminId, 'update_team', 'team', team.id, {
            team_name: name.trim(),
            previous_name: team.name,
          });
        }
      } else {
        // Create new team
        const { data: newTeam, error: teamError } = await supabase
          .from('teams')
          .insert({
            name: name.trim(),
            description: description.trim() || null,
            logo_url: logoUrl.trim() || null,
            created_by: currentUserId,
            is_active: true,
          })
          .select()
          .single();

        if (teamError) throw teamError;

        // Add creator as team manager
        if (newTeam && currentUserId) {
          const { error: memberError } = await supabase
            .from('team_members')
            .insert({
              team_id: newTeam.id,
              player_id: currentUserId,
              role: 'manager',
            });

          if (memberError) throw memberError;
        }

        // Log the admin action
        if (adminId && newTeam) {
          await logAdminAction(adminId, 'create_team', 'team', newTeam.id, {
            team_name: name.trim(),
          });
        }
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error saving team:', error);
      alert('Failed to save team: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="card-glass p-8 max-w-lg w-full">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-100">
            {team ? 'Edit Team' : 'Create Team'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Team Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-modern w-full"
              placeholder="e.g. Thunder Spikers"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description <span className="text-gray-500">(Optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-modern w-full"
              rows={3}
              placeholder="Brief description of the team..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Logo URL <span className="text-gray-500">(Optional)</span>
            </label>
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className="input-modern w-full"
              placeholder="https://example.com/logo.png"
            />
            <p className="text-xs text-gray-500 mt-1">
              URL to team logo image
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : team ? 'Update' : 'Create'} Team
          </button>
        </div>
      </div>
    </div>
  );
}

// Roster Management Modal Component
interface RosterManagementModalProps {
  team: Team;
  adminId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

function RosterManagementModal({ team, adminId, onClose, onSuccess }: RosterManagementModalProps) {
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const currentMembers = team.members?.filter(m => m.is_active) || [];
  const currentMemberIds = currentMembers.map(m => m.player_id);

  useEffect(() => {
    fetchAllPlayers();
  }, []);

  const fetchAllPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('is_guest', false)
        .order('name');

      if (error) throw error;
      setAllPlayers(data || []);
    } catch (error) {
      console.error('Error fetching players:', error);
    } finally {
      setLoading(false);
    }
  };

  const availablePlayers = allPlayers.filter(
    p => !currentMemberIds.includes(p.id) &&
         p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddMember = async (playerId: string, playerName: string) => {
    setWorking(true);
    try {
      const { error } = await supabase
        .from('team_members')
        .insert({
          team_id: team.id,
          player_id: playerId,
          role: 'member',
        });

      if (error) throw error;

      // Log the admin action
      if (adminId) {
        await logAdminAction(adminId, 'add_team_member', 'team', team.id, {
          team_name: team.name,
          player_id: playerId,
          player_name: playerName,
        });
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error adding member:', error);
      alert('Failed to add member: ' + error.message);
    } finally {
      setWorking(false);
    }
  };

  const handleRemoveMember = async (member: TeamMember) => {
    if (!confirm('Remove this player from the team?')) return;

    setWorking(true);
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ is_active: false })
        .eq('id', member.id);

      if (error) throw error;

      // Log the admin action
      if (adminId) {
        await logAdminAction(adminId, 'remove_team_member', 'team', team.id, {
          team_name: team.name,
          player_id: member.player_id,
          player_name: member.player?.name,
        });
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error removing member:', error);
      alert('Failed to remove member: ' + error.message);
    } finally {
      setWorking(false);
    }
  };

  const handleToggleRole = async (member: TeamMember) => {
    const newRole = member.role === 'manager' ? 'member' : 'manager';
    setWorking(true);
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ role: newRole })
        .eq('id', member.id);

      if (error) throw error;

      // Log the admin action
      if (adminId) {
        await logAdminAction(adminId, 'change_team_member_role', 'team', team.id, {
          team_name: team.name,
          player_id: member.player_id,
          player_name: member.player?.name,
          previous_role: member.role,
          new_role: newRole,
        });
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error updating role:', error);
      alert('Failed to update role: ' + error.message);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="card-glass p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-100">Manage Roster</h2>
            <p className="text-sm text-gray-400 mt-1">{team.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Current Roster */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-100 mb-3">Current Roster ({currentMembers.length})</h3>
          {currentMembers.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <p>No members yet. Add players below.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {currentMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 bg-rally-dark/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="font-medium text-gray-100">{member.player?.name}</div>
                      <div className="text-xs text-gray-400">Rating: {member.player?.rating}</div>
                    </div>
                    {member.role === 'manager' && (
                      <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded border border-yellow-500/30">
                        Manager
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggleRole(member)}
                      disabled={working}
                      className="px-3 py-1 text-xs rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-all disabled:opacity-50"
                    >
                      {member.role === 'manager' ? 'Demote' : 'Make Manager'}
                    </button>
                    <button
                      onClick={() => handleRemoveMember(member)}
                      disabled={working}
                      className="px-3 py-1 text-xs rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-all disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Members */}
        <div>
          <h3 className="text-lg font-semibold text-gray-100 mb-3">Add Members</h3>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search players..."
            className="input-modern w-full mb-3"
          />

          {loading ? (
            <div className="text-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-rally-coral mx-auto"></div>
            </div>
          ) : availablePlayers.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <p>{searchQuery ? 'No players found' : 'All players are on the team'}</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {availablePlayers.slice(0, 20).map((player) => (
                <div key={player.id} className="flex items-center justify-between p-3 bg-rally-dark/30 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-100">{player.name}</div>
                    <div className="text-xs text-gray-400">
                      Rating: {player.rating} • {player.games_played} games
                    </div>
                  </div>
                  <button
                    onClick={() => handleAddMember(player.id, player.name)}
                    disabled={working}
                    className="px-3 py-1 text-sm rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 transition-all disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6">
          <button onClick={onClose} className="btn-secondary w-full">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
