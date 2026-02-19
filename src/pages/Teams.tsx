import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Team } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { getAdminPermissions } from '../utils/permissions';

interface TeamWithMembers extends Team {
  member_count: number;
  manager_names: string[];
}

export default function Teams() {
  const { player } = useAuth();
  const permissions = getAdminPermissions(player);
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'wins' | 'tournaments'>('name');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDescription, setNewTeamDescription] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      // Fetch teams
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (teamsError) throw teamsError;

      // Fetch team members for each team
      const teamsWithMembers = await Promise.all(
        (teamsData || []).map(async (team) => {
          const { data: members } = await supabase
            .from('team_members')
            .select(`
              id,
              role,
              player:players(id, name)
            `)
            .eq('team_id', team.id)
            .eq('is_active', true);

          const managerNames = members
            ?.filter((m: any) => m.role === 'manager')
            .map((m: any) => m.player?.name)
            .filter(Boolean) as string[] || [];

          return {
            ...team,
            member_count: members?.length || 0,
            manager_names: managerNames,
          };
        })
      );

      setTeams(teamsWithMembers);
    } catch (error) {
      console.error('Error fetching teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeamName.trim() || !player) return;
    setCreating(true);
    try {
      const { data: team, error } = await supabase
        .from('teams')
        .insert({
          name: newTeamName.trim(),
          description: newTeamDescription.trim() || null,
          created_by: player.id,
          is_active: true,
          wins: 0,
          losses: 0,
          tournaments_played: 0,
        })
        .select()
        .single();

      if (error) throw error;

      await supabase.from('team_members').insert({
        team_id: team.id,
        player_id: player.id,
        role: 'manager',
        is_active: true,
      });

      setShowCreateModal(false);
      setNewTeamName('');
      setNewTeamDescription('');
      fetchTeams();
    } catch (error: any) {
      console.error('Error creating team:', error);
      alert('Failed to create team: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  const getWinRate = (team: Team) => {
    const totalGames = team.wins + team.losses;
    if (totalGames === 0) return 0;
    return Math.round((team.wins / totalGames) * 100);
  };

  const filteredTeams = teams
    .filter(team =>
      team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      team.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'wins':
          return b.wins - a.wins;
        case 'tournaments':
          return b.tournaments_played - a.tournaments_played;
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-rally-coral"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-rally-darker">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-fade-in">
          <div>
            <h1 className="text-4xl font-bold text-gray-100 mb-2">Teams</h1>
            <p className="text-gray-400">Browse and join volleyball teams</p>
          </div>
          {(permissions.canCreateTeams || permissions.canManageAllTeams) && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Team
            </button>
          )}
        </div>

        {/* Search and Filter */}
        <div className="card-glass p-6 mb-8 animate-slide-up">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search teams..."
                className="input-modern w-full"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSortBy('name')}
                className={`px-4 py-2 rounded-xl font-medium transition-all ${
                  sortBy === 'name'
                    ? 'bg-rally-coral text-white'
                    : 'bg-rally-dark/50 text-gray-400 hover:bg-rally-dark'
                }`}
              >
                Name
              </button>
              <button
                onClick={() => setSortBy('wins')}
                className={`px-4 py-2 rounded-xl font-medium transition-all ${
                  sortBy === 'wins'
                    ? 'bg-rally-coral text-white'
                    : 'bg-rally-dark/50 text-gray-400 hover:bg-rally-dark'
                }`}
              >
                Wins
              </button>
              <button
                onClick={() => setSortBy('tournaments')}
                className={`px-4 py-2 rounded-xl font-medium transition-all ${
                  sortBy === 'tournaments'
                    ? 'bg-rally-coral text-white'
                    : 'bg-rally-dark/50 text-gray-400 hover:bg-rally-dark'
                }`}
              >
                Tournaments
              </button>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="stat-card">
            <div className="text-3xl font-bold text-gradient-rally">{teams.length}</div>
            <div className="text-sm text-gray-400 mt-1">Active Teams</div>
          </div>
          <div className="stat-card">
            <div className="text-3xl font-bold text-gray-100">
              {teams.reduce((sum, t) => sum + t.member_count, 0)}
            </div>
            <div className="text-sm text-gray-400 mt-1">Total Players</div>
          </div>
          <div className="stat-card">
            <div className="text-3xl font-bold text-green-400">
              {teams.reduce((sum, t) => sum + t.wins, 0)}
            </div>
            <div className="text-sm text-gray-400 mt-1">Total Wins</div>
          </div>
          <div className="stat-card">
            <div className="text-3xl font-bold text-orange-400">
              {teams.reduce((sum, t) => sum + t.tournaments_played, 0)}
            </div>
            <div className="text-sm text-gray-400 mt-1">Tournaments Played</div>
          </div>
        </div>

        {/* Teams Grid */}
        {filteredTeams.length === 0 ? (
          <div className="card-glass p-12 text-center">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <h3 className="text-xl font-semibold text-gray-300 mb-2">No Teams Found</h3>
            <p className="text-gray-500">
              {searchQuery ? 'Try a different search term' : 'No teams have been created yet'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTeams.map((team, index) => (
              <Link
                key={team.id}
                to={`/teams/${team.id}`}
                className="card-glass p-6 hover:scale-105 transition-all duration-300 group animate-slide-up"
                style={{ animationDelay: `${0.1 + index * 0.05}s` }}
              >
                {/* Team Header */}
                <div className="flex items-start gap-4 mb-4">
                  {team.logo_url ? (
                    <img
                      src={team.logo_url}
                      alt={team.name}
                      className="w-16 h-16 rounded-xl object-cover border-2 border-white/10"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-gradient-rally flex items-center justify-center">
                      <span className="text-2xl font-bold text-white">
                        {team.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-gray-100 truncate group-hover:text-rally-coral transition-colors">
                      {team.name}
                    </h3>
                    {team.manager_names.length > 0 && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Manager: {team.manager_names[0]}
                        {team.manager_names.length > 1 && ` +${team.manager_names.length - 1}`}
                      </p>
                    )}
                  </div>
                </div>

                {/* Description */}
                {team.description && (
                  <p className="text-sm text-gray-400 mb-4 line-clamp-2">{team.description}</p>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-rally-dark/50 rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-gray-100">{team.member_count}</div>
                    <div className="text-xs text-gray-500">Members</div>
                  </div>
                  <div className="bg-rally-dark/50 rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-green-400">{team.wins}</div>
                    <div className="text-xs text-gray-500">Wins</div>
                  </div>
                  <div className="bg-rally-dark/50 rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-red-400">{team.losses}</div>
                    <div className="text-xs text-gray-500">Losses</div>
                  </div>
                </div>

                {/* Win Rate Bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Win Rate</span>
                    <span className="font-semibold">{getWinRate(team)}%</span>
                  </div>
                  <div className="h-2 bg-rally-dark rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-rally transition-all duration-500"
                      style={{ width: `${getWinRate(team)}%` }}
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{team.tournaments_played} tournaments</span>
                  <span className="text-rally-coral group-hover:text-rally-coral/80 font-medium">
                    View Details →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Create Team Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card-glass max-w-md w-full p-8 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-100">Create Team</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-lg bg-rally-dark/50 hover:bg-rally-dark flex items-center justify-center transition-colors"
              >
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Team Name *</label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g. Matchblocks Twenty"
                  className="input-modern w-full"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                <textarea
                  value={newTeamDescription}
                  onChange={(e) => setNewTeamDescription(e.target.value)}
                  placeholder="Optional team description..."
                  className="input-modern w-full h-24 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-3 bg-rally-dark border border-white/10 rounded-xl text-gray-300 hover:bg-rally-light transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTeam}
                disabled={creating || !newTeamName.trim()}
                className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Creating...' : 'Create Team'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
