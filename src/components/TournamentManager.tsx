import { useState, useEffect } from 'react';
import { supabase, logAdminAction } from '../lib/supabase';
import { Tournament, TournamentFormat, TournamentStatus, Venue, Team, TournamentTeam } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { generateSeasonSchedule, generatePlayoffBracket } from '../utils/schedule';

export default function TournamentManager() {
  const { player } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
  const [managingTeams, setManagingTeams] = useState<Tournament | null>(null);

  useEffect(() => {
    fetchTournaments();
    fetchVenues();
  }, []);

  const fetchTournaments = async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select(`
          *,
          venue:venues(id, name, address),
          teams:tournament_teams(
            id,
            team:teams(id, name, wins, losses)
          )
        `)
        .order('start_date', { ascending: false });

      if (error) throw error;
      setTournaments(data || []);
    } catch (error) {
      console.error('Error fetching tournaments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVenues = async () => {
    try {
      const { data, error } = await supabase
        .from('venues')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setVenues(data || []);
    } catch (error) {
      console.error('Error fetching venues:', error);
    }
  };

  const handleUpdateStatus = async (tournament: Tournament, newStatus: TournamentStatus) => {
    try {
      const updateData: any = { status: newStatus };
      const previousStatus = tournament.status;

      if (newStatus === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('tournaments')
        .update(updateData)
        .eq('id', tournament.id);

      if (error) throw error;

      // Log the admin action
      if (player?.id) {
        await logAdminAction(player.id, 'update_tournament_status', 'tournament', tournament.id, {
          tournament_name: tournament.name,
          previous_status: previousStatus,
          new_status: newStatus,
        });
      }

      await fetchTournaments();
      alert(`Tournament status updated to ${newStatus}!`);
    } catch (error: any) {
      console.error('Error updating tournament status:', error);
      alert('Failed to update status: ' + error.message);
    }
  };

  const handleGenerateSchedule = async (tournament: Tournament) => {
    if (!tournament.teams || tournament.teams.length < 2) {
      alert('Need at least 2 teams to generate schedule');
      return;
    }

    const seasonWeeks = tournament.season_weeks || 8;
    const gamesPerWeek = tournament.games_per_week || 1;

    if (!confirm(`Generate schedule for ${tournament.teams.length} teams over ${seasonWeeks} weeks (${gamesPerWeek} game(s)/week per team)?`)) {
      return;
    }

    try {
      const teams = tournament.teams.map((tt: any) => ({
        team_id: tt.team?.id || tt.team_id,
        team_name: tt.team?.name || 'Unknown',
      }));

      const result = await generateSeasonSchedule(
        tournament.id,
        teams,
        seasonWeeks,
        gamesPerWeek,
        tournament.start_date
      );

      if (result.success) {
        // Log the admin action
        if (player?.id) {
          await logAdminAction(player.id, 'generate_schedule', 'tournament', tournament.id, {
            tournament_name: tournament.name,
            teams_count: teams.length,
            games_created: result.gamesCreated,
          });
        }

        await fetchTournaments();
        alert(`Schedule generated! ${result.gamesCreated} games created.`);
      } else {
        alert('Failed to generate schedule: ' + result.error);
      }
    } catch (error: any) {
      console.error('Error generating schedule:', error);
      alert('Failed to generate schedule: ' + error.message);
    }
  };

  const handleGeneratePlayoffs = async (tournament: Tournament) => {
    const playoffTeams = Math.min(tournament.teams?.length || 0, 8);

    if (!confirm(`Generate playoff bracket with top ${playoffTeams} teams based on season standings?`)) {
      return;
    }

    try {
      const result = await generatePlayoffBracket(tournament.id, playoffTeams);

      if (result.success) {
        if (player?.id) {
          await logAdminAction(player.id, 'generate_playoffs', 'tournament', tournament.id, {
            tournament_name: tournament.name,
            playoff_teams: playoffTeams,
          });
        }

        await fetchTournaments();
        alert('Playoff bracket generated!');
      } else {
        alert('Failed to generate playoffs: ' + result.error);
      }
    } catch (error: any) {
      console.error('Error generating playoffs:', error);
      alert('Failed to generate playoffs: ' + error.message);
    }
  };

  const handleDelete = async (tournament: Tournament) => {
    if (!confirm('Are you sure you want to delete this tournament? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('tournaments')
        .delete()
        .eq('id', tournament.id);

      if (error) throw error;

      // Log the admin action
      if (player?.id) {
        await logAdminAction(player.id, 'delete_tournament', 'tournament', tournament.id, {
          tournament_name: tournament.name,
          tournament_status: tournament.status,
          teams_count: tournament.teams?.length || 0,
        });
      }

      await fetchTournaments();
      alert('Tournament deleted successfully!');
    } catch (error: any) {
      console.error('Error deleting tournament:', error);
      alert('Failed to delete tournament: ' + error.message);
    }
  };

  const getStatusBadgeClass = (status: TournamentStatus) => {
    switch (status) {
      case 'setup':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      case 'active':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'completed':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'cancelled':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getFormatDisplayName = (format: TournamentFormat) => {
    switch (format) {
      case 'single_elimination':
        return 'Single Elimination';
      case 'double_elimination':
        return 'Double Elimination';
      case 'round_robin':
        return 'Round Robin';
      default:
        return format;
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
          <h2 className="text-2xl font-bold text-gray-100">Tournament Management</h2>
          <p className="text-sm text-gray-400 mt-1">Create and manage volleyball tournaments</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary"
        >
          Create Tournament
        </button>
      </div>

      {tournaments.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-4">No tournaments created yet</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
          >
            Create Your First Tournament
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {tournaments.map((tournament) => (
            <div
              key={tournament.id}
              className="p-5 rounded-xl border-2 bg-rally-dark/50 border-white/10 hover:border-rally-coral/30 transition-all"
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-bold text-gray-100 truncate">{tournament.name}</h3>
                    <span className={`px-2 py-0.5 text-xs rounded border font-medium ${getStatusBadgeClass(tournament.status)}`}>
                      {tournament.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  {tournament.description && (
                    <p className="text-sm text-gray-400 mb-2">{tournament.description}</p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400">
                    <span>Format: {getFormatDisplayName(tournament.format)}</span>
                    <span>Best of {tournament.best_of}</span>
                    <span>Teams: {tournament.teams?.length || 0}{tournament.max_teams ? `/${tournament.max_teams}` : ''}</span>
                    {tournament.venue && <span>Venue: {tournament.venue.name}</span>}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">
                    Start: {new Date(tournament.start_date).toLocaleDateString()}
                    {tournament.end_date && ` - ${new Date(tournament.end_date).toLocaleDateString()}`}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setManagingTeams(tournament)}
                    className="px-3 py-1.5 rounded-lg bg-rally-dark hover:bg-rally-light text-gray-300 text-sm transition-all whitespace-nowrap"
                  >
                    Manage Teams ({tournament.teams?.length || 0})
                  </button>
                  <button
                    onClick={() => setEditingTournament(tournament)}
                    className="px-3 py-1.5 rounded-lg bg-rally-dark hover:bg-rally-light text-gray-300 text-sm transition-all whitespace-nowrap"
                  >
                    Edit Details
                  </button>

                  {tournament.status === 'setup' && (
                    <>
                      {!tournament.schedule_generated && tournament.season_weeks && (
                        <button
                          onClick={() => handleGenerateSchedule(tournament)}
                          className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-sm transition-all whitespace-nowrap"
                        >
                          Generate Schedule
                        </button>
                      )}
                      <button
                        onClick={() => handleUpdateStatus(tournament, 'active')}
                        className="px-3 py-1.5 rounded-lg bg-green-600/20 hover:bg-green-600/30 text-green-400 text-sm transition-all whitespace-nowrap"
                      >
                        Start Tournament
                      </button>
                    </>
                  )}

                  {tournament.status === 'active' && (
                    <>
                      {tournament.playoffs_enabled && (
                        <button
                          onClick={() => handleGeneratePlayoffs(tournament)}
                          className="px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 text-sm transition-all whitespace-nowrap"
                        >
                          Generate Playoffs
                        </button>
                      )}
                      <button
                        onClick={() => handleUpdateStatus(tournament, 'completed')}
                        className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-sm transition-all whitespace-nowrap"
                      >
                        Mark Complete
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(tournament, 'cancelled')}
                        className="px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm transition-all whitespace-nowrap"
                      >
                        Cancel
                      </button>
                    </>
                  )}

                  {(tournament.status === 'setup' || tournament.status === 'cancelled') && (
                    <button
                      onClick={() => handleDelete(tournament)}
                      className="px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm transition-all whitespace-nowrap"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {/* Show registered teams */}
              {tournament.teams && tournament.teams.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <p className="text-xs text-gray-400 mb-2">Registered Teams:</p>
                  <div className="flex flex-wrap gap-2">
                    {tournament.teams.map((tt: any) => (
                      <span
                        key={tt.id}
                        className="px-2 py-1 text-xs bg-rally-dark rounded border border-white/10 text-gray-300"
                      >
                        {tt.team?.name} ({tt.team?.wins}W-{tt.team?.losses}L)
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

    </div>

    {/* Create/Edit Tournament Modal - Outside card-glass for proper z-index */}
    {(showCreateModal || editingTournament) && (
      <TournamentFormModal
        tournament={editingTournament}
        venues={venues}
        adminId={player?.id}
        onClose={() => {
          setShowCreateModal(false);
          setEditingTournament(null);
        }}
        onSuccess={() => {
          setShowCreateModal(false);
          setEditingTournament(null);
          fetchTournaments();
        }}
      />
    )}

    {/* Team Management Modal - Outside card-glass for proper z-index */}
    {managingTeams && (
      <TeamManagementModal
        tournament={managingTeams}
        adminId={player?.id}
        onClose={() => setManagingTeams(null)}
        onSuccess={() => {
          setManagingTeams(null);
          fetchTournaments();
        }}
      />
    )}
    </>
  );
}

interface TournamentFormModalProps {
  tournament: Tournament | null;
  venues: Venue[];
  adminId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

function TournamentFormModal({ tournament, venues, adminId, onClose, onSuccess }: TournamentFormModalProps) {
  const [name, setName] = useState(tournament?.name || '');
  const [description, setDescription] = useState(tournament?.description || '');
  const [format, setFormat] = useState<TournamentFormat>(tournament?.format || 'round_robin');
  const [bestOf, setBestOf] = useState<1 | 3 | 5 | 7>(tournament?.best_of || 3);
  const [startDate, setStartDate] = useState(
    tournament?.start_date ? new Date(tournament.start_date).toISOString().split('T')[0] : ''
  );
  const [endDate, setEndDate] = useState(
    tournament?.end_date ? new Date(tournament.end_date).toISOString().split('T')[0] : ''
  );
  const [venueId, setVenueId] = useState(tournament?.venue_id || '');
  const [maxTeams, setMaxTeams] = useState<number | ''>(tournament?.max_teams || '');
  const [pointsToWin, setPointsToWin] = useState(tournament?.points_to_win || 25);
  const [decidingSetPoints, setDecidingSetPoints] = useState(tournament?.deciding_set_points || 15);
  const [minPointDifference, setMinPointDifference] = useState(tournament?.min_point_difference || 2);
  // Season scheduling
  const [seasonWeeks, setSeasonWeeks] = useState<number | ''>(tournament?.season_weeks || 8);
  const [gamesPerWeek, setGamesPerWeek] = useState<number | ''>(tournament?.games_per_week || 1);
  const [playoffsEnabled, setPlayoffsEnabled] = useState(tournament?.playoffs_enabled ?? true);
  const [autoSeedPlayoffs, setAutoSeedPlayoffs] = useState(tournament?.auto_seed_playoffs ?? true);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Please enter a tournament name');
      return;
    }

    if (!startDate) {
      alert('Please select a start date');
      return;
    }

    setSaving(true);
    try {
      const tournamentData = {
        name: name.trim(),
        description: description.trim() || null,
        format,
        best_of: bestOf,
        start_date: startDate,
        end_date: endDate || null,
        venue_id: venueId || null,
        max_teams: maxTeams || null,
        points_to_win: pointsToWin,
        deciding_set_points: decidingSetPoints,
        min_point_difference: minPointDifference,
        // Season scheduling
        season_weeks: seasonWeeks || null,
        games_per_week: gamesPerWeek || null,
        playoffs_enabled: playoffsEnabled,
        auto_seed_playoffs: autoSeedPlayoffs,
      };

      if (tournament) {
        // Update existing tournament
        const { error } = await supabase
          .from('tournaments')
          .update({
            ...tournamentData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', tournament.id);

        if (error) throw error;

        // Log the admin action
        if (adminId) {
          await logAdminAction(adminId, 'update_tournament', 'tournament', tournament.id, {
            tournament_name: name.trim(),
            previous_name: tournament.name,
            format,
          });
        }

        alert('Tournament updated successfully!');
      } else {
        // Create new tournament
        const { data: newTournament, error } = await supabase
          .from('tournaments')
          .insert({
            ...tournamentData,
            created_by: adminId || null,
            status: 'setup',
          })
          .select()
          .single();

        if (error) throw error;

        // Log the admin action
        if (adminId && newTournament) {
          await logAdminAction(adminId, 'create_tournament', 'tournament', newTournament.id, {
            tournament_name: name.trim(),
            format,
            start_date: startDate,
          });
        }

        alert('Tournament created successfully!');
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error saving tournament:', error);
      alert('Failed to save tournament: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="card-glass p-8 max-w-2xl w-full my-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-100">
            {tournament ? 'Edit Tournament' : 'Create Tournament'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 mb-6 max-h-[60vh] overflow-y-auto pr-2">
          {/* Basic Info */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tournament Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-modern w-full"
              placeholder="Enter tournament name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-modern w-full"
              rows={3}
              placeholder="Optional description"
            />
          </div>

          {/* Format and Best Of */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Format *
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as TournamentFormat)}
                className="input-modern w-full"
              >
                <option value="single_elimination">Single Elimination</option>
                <option value="double_elimination">Double Elimination</option>
                <option value="round_robin">Round Robin</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Best Of *
              </label>
              <select
                value={bestOf}
                onChange={(e) => setBestOf(Number(e.target.value) as 1 | 3 | 5 | 7)}
                className="input-modern w-full"
              >
                <option value={1}>Best of 1</option>
                <option value={3}>Best of 3</option>
                <option value={5}>Best of 5</option>
                <option value={7}>Best of 7</option>
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Start Date *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-modern w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input-modern w-full"
              />
            </div>
          </div>

          {/* Venue and Max Teams */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Venue
              </label>
              <select
                value={venueId}
                onChange={(e) => setVenueId(e.target.value)}
                className="input-modern w-full"
              >
                <option value="">No venue selected</option>
                {venues.map((venue) => (
                  <option key={venue.id} value={venue.id}>
                    {venue.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Max Teams
              </label>
              <input
                type="number"
                value={maxTeams}
                onChange={(e) => setMaxTeams(e.target.value ? Number(e.target.value) : '')}
                className="input-modern w-full"
                placeholder="Unlimited"
                min={2}
              />
            </div>
          </div>

          {/* Season Scheduling */}
          <div className="p-4 bg-rally-dark/50 rounded-xl">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Season Schedule</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Season Length (weeks)
                </label>
                <input
                  type="number"
                  value={seasonWeeks}
                  onChange={(e) => setSeasonWeeks(e.target.value ? Number(e.target.value) : '')}
                  className="input-modern w-full text-sm"
                  min={1}
                  max={52}
                  placeholder="8"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Games per Week (per team)
                </label>
                <input
                  type="number"
                  value={gamesPerWeek}
                  onChange={(e) => setGamesPerWeek(e.target.value ? Number(e.target.value) : '')}
                  className="input-modern w-full text-sm"
                  min={1}
                  max={7}
                  placeholder="1"
                />
              </div>
            </div>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={playoffsEnabled}
                  onChange={(e) => setPlayoffsEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 text-rally-coral focus:ring-rally-coral"
                />
                <span className="text-sm text-gray-300">Enable playoffs after regular season</span>
              </label>
              {playoffsEnabled && (
                <label className="flex items-center gap-3 cursor-pointer ml-7">
                  <input
                    type="checkbox"
                    checked={autoSeedPlayoffs}
                    onChange={(e) => setAutoSeedPlayoffs(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 text-rally-coral focus:ring-rally-coral"
                  />
                  <span className="text-sm text-gray-400">Auto-seed playoffs by season standings</span>
                </label>
              )}
            </div>
          </div>

          {/* Scoring Rules */}
          <div className="p-4 bg-rally-dark/50 rounded-xl">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Scoring Rules</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Points to Win
                </label>
                <input
                  type="number"
                  value={pointsToWin}
                  onChange={(e) => setPointsToWin(Number(e.target.value))}
                  className="input-modern w-full text-sm"
                  min={1}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Deciding Set Points
                </label>
                <input
                  type="number"
                  value={decidingSetPoints}
                  onChange={(e) => setDecidingSetPoints(Number(e.target.value))}
                  className="input-modern w-full text-sm"
                  min={1}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Min Point Diff
                </label>
                <input
                  type="number"
                  value={minPointDifference}
                  onChange={(e) => setMinPointDifference(Number(e.target.value))}
                  className="input-modern w-full text-sm"
                  min={1}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="btn-secondary flex-1"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn-primary flex-1"
            disabled={saving}
          >
            {saving ? 'Saving...' : tournament ? 'Update Tournament' : 'Create Tournament'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface TeamManagementModalProps {
  tournament: Tournament;
  adminId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

function TeamManagementModal({ tournament, adminId, onClose, onSuccess }: TeamManagementModalProps) {
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [registeredTeams, setRegisteredTeams] = useState<TournamentTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchTeams();
    fetchRegisteredTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setAllTeams(data || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRegisteredTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('tournament_teams')
        .select(`
          *,
          team:teams(id, name, wins, losses)
        `)
        .eq('tournament_id', tournament.id)
        .order('seed');

      if (error) throw error;
      setRegisteredTeams(data || []);
    } catch (error) {
      console.error('Error fetching registered teams:', error);
    }
  };

  const handleAddTeam = async (team: Team) => {
    try {
      // Check max teams limit
      if (tournament.max_teams && registeredTeams.length >= tournament.max_teams) {
        alert(`This tournament is limited to ${tournament.max_teams} teams`);
        return;
      }

      const { error } = await supabase
        .from('tournament_teams')
        .insert({
          tournament_id: tournament.id,
          team_id: team.id,
          seed: registeredTeams.length + 1,
        });

      if (error) throw error;

      // Log the admin action
      if (adminId) {
        await logAdminAction(adminId, 'add_team_to_tournament', 'tournament', tournament.id, {
          tournament_name: tournament.name,
          team_id: team.id,
          team_name: team.name,
        });
      }

      await fetchRegisteredTeams();
    } catch (error: any) {
      console.error('Error adding team:', error);
      alert('Failed to add team: ' + error.message);
    }
  };

  const handleRemoveTeam = async (tournamentTeam: any) => {
    try {
      const { error } = await supabase
        .from('tournament_teams')
        .delete()
        .eq('id', tournamentTeam.id);

      if (error) throw error;

      // Log the admin action
      if (adminId) {
        await logAdminAction(adminId, 'remove_team_from_tournament', 'tournament', tournament.id, {
          tournament_name: tournament.name,
          team_id: tournamentTeam.team?.id,
          team_name: tournamentTeam.team?.name,
        });
      }

      await fetchRegisteredTeams();
    } catch (error: any) {
      console.error('Error removing team:', error);
      alert('Failed to remove team: ' + error.message);
    }
  };

  const handleUpdateSeed = async (tournamentTeamId: string, newSeed: number) => {
    try {
      const { error } = await supabase
        .from('tournament_teams')
        .update({ seed: newSeed })
        .eq('id', tournamentTeamId);

      if (error) throw error;

      await fetchRegisteredTeams();
    } catch (error: any) {
      console.error('Error updating seed:', error);
      alert('Failed to update seed: ' + error.message);
    }
  };

  const availableTeams = allTeams.filter(
    (team) =>
      !registeredTeams.some((rt: any) => rt.team?.id === team.id) &&
      team.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-rally-coral"></div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="card-glass p-8 max-w-4xl w-full my-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-100">Manage Tournament Teams</h2>
            <p className="text-sm text-gray-400 mt-1">{tournament.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto">
          {/* Registered Teams */}
          <div>
            <h3 className="text-lg font-semibold text-gray-100 mb-4">
              Registered Teams ({registeredTeams.length}
              {tournament.max_teams ? `/${tournament.max_teams}` : ''})
            </h3>
            {registeredTeams.length === 0 ? (
              <p className="text-sm text-gray-400 py-4">No teams registered yet</p>
            ) : (
              <div className="space-y-2">
                {registeredTeams.map((tt: any) => (
                  <div
                    key={tt.id}
                    className="p-3 rounded-lg bg-rally-dark/50 border border-white/10"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-gray-100 truncate">
                          {tt.team?.name}
                        </h4>
                        <p className="text-xs text-gray-400">
                          Record: {tt.team?.wins || 0}W-{tt.team?.losses || 0}L
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveTeam(tt)}
                        className="px-2 py-1 rounded bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-400">Seed:</label>
                      <input
                        type="number"
                        value={tt.seed || ''}
                        onChange={(e) => handleUpdateSeed(tt.id, Number(e.target.value))}
                        className="input-modern w-16 text-xs px-2 py-1"
                        min={1}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Available Teams */}
          <div>
            <h3 className="text-lg font-semibold text-gray-100 mb-4">Available Teams</h3>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-modern w-full mb-4"
              placeholder="Search teams..."
            />
            {availableTeams.length === 0 ? (
              <p className="text-sm text-gray-400 py-4">
                {searchQuery ? 'No teams found' : 'All active teams are registered'}
              </p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {availableTeams.map((team) => (
                  <div
                    key={team.id}
                    className="p-3 rounded-lg bg-rally-dark/50 border border-white/10 hover:border-rally-coral/30 transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-gray-100 truncate">
                          {team.name}
                        </h4>
                        <p className="text-xs text-gray-400">
                          Record: {team.wins}W-{team.losses}L
                          {team.tournaments_played > 0 && ` • ${team.tournaments_played} tournaments`}
                        </p>
                      </div>
                      <button
                        onClick={() => handleAddTeam(team)}
                        className="px-3 py-1 rounded bg-rally-coral hover:bg-rally-coral/80 text-white text-xs whitespace-nowrap"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-white/10">
          <button
            onClick={onSuccess}
            className="btn-primary"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
