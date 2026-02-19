import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Tournament, Team, TournamentGame, Venue } from '../types';
import TournamentBracket from '../components/TournamentBracket';
import TournamentSchedule from '../components/TournamentSchedule';
import { useAuth } from '../contexts/AuthContext';
import { getAdminPermissions } from '../utils/permissions';

interface TournamentWithVenue extends Tournament {
  venue?: Venue;
}

export default function TournamentView() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const { player } = useAuth();
  const permissions = getAdminPermissions(player);
  const [tournament, setTournament] = useState<TournamentWithVenue | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<TournamentGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableTeams, setAvailableTeams] = useState<Team[]>([]);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    if (tournamentId) {
      fetchTournamentData();
      fetchAvailableTeams();
    }
  }, [tournamentId]);

  const fetchTournamentData = async () => {
    try {
      // Fetch tournament
      const { data: tournamentData, error: tournamentError } = await supabase
        .from('tournaments')
        .select(`
          *,
          venue:venues(*)
        `)
        .eq('id', tournamentId)
        .single();

      if (tournamentError) throw tournamentError;
      setTournament(tournamentData);

      // Fetch registered teams
      const { data: tournamentTeams, error: teamsError } = await supabase
        .from('tournament_teams')
        .select(`
          *,
          team:teams(*)
        `)
        .eq('tournament_id', tournamentId)
        .order('seed');

      if (teamsError) throw teamsError;
      const teamsList = tournamentTeams?.map((tt: any) => tt.team).filter(Boolean) || [];
      setTeams(teamsList);

      // Fetch matches
      const { data: matchesData, error: matchesError } = await supabase
        .from('games')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('created_at');

      if (matchesError) throw matchesError;
      setMatches(matchesData as TournamentGame[] || []);
    } catch (error) {
      console.error('Error fetching tournament data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableTeams = async () => {
    try {
      // Get all active teams
      const { data: allTeams, error: allError } = await supabase
        .from('teams')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (allError) throw allError;

      // Get teams already registered for this tournament
      const { data: registered, error: regError } = await supabase
        .from('tournament_teams')
        .select('team_id')
        .eq('tournament_id', tournamentId);

      if (regError) throw regError;

      const registeredIds = new Set(registered?.map((r: any) => r.team_id) || []);
      const available = (allTeams || []).filter((t: Team) => !registeredIds.has(t.id));
      setAvailableTeams(available);
    } catch (error) {
      console.error('Error fetching available teams:', error);
    }
  };

  const handleRegisterTeam = async (teamId: string) => {
    if (registering) return;
    setRegistering(true);
    try {
      const nextSeed = teams.length + 1;
      const { error } = await supabase
        .from('tournament_teams')
        .insert({
          tournament_id: tournamentId,
          team_id: teamId,
          seed: nextSeed,
        });

      if (error) throw error;
      await fetchTournamentData();
      await fetchAvailableTeams();
    } catch (error: any) {
      console.error('Error registering team:', error);
      alert('Failed to register team: ' + error.message);
    } finally {
      setRegistering(false);
    }
  };

  const handleUnregisterTeam = async (teamId: string) => {
    if (registering) return;
    setRegistering(true);
    try {
      const { error } = await supabase
        .from('tournament_teams')
        .delete()
        .eq('tournament_id', tournamentId)
        .eq('team_id', teamId);

      if (error) throw error;
      await fetchTournamentData();
      await fetchAvailableTeams();
    } catch (error: any) {
      console.error('Error unregistering team:', error);
      alert('Failed to remove team: ' + error.message);
    } finally {
      setRegistering(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
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

  const getFormatDisplayName = (format: string) => {
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
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-rally-coral"></div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-rally-darker flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-100 mb-2">Tournament Not Found</h2>
          <Link to="/tournaments" className="text-rally-coral hover:underline">
            Back to Tournaments
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-rally-darker">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Link
          to="/tournaments"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-gray-200 mb-6 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Tournaments
        </Link>

        {/* Tournament Header */}
        <div className="card-glass p-8 mb-8 animate-fade-in">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <h1 className="text-4xl font-bold text-gray-100">{tournament.name}</h1>
                <span className={`px-3 py-1 text-sm rounded-lg border font-medium ${getStatusBadgeClass(tournament.status)}`}>
                  {tournament.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              {tournament.description && (
                <p className="text-gray-400 mb-4">{tournament.description}</p>
              )}
            </div>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rally-dark flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <div className="text-sm text-gray-500">Start Date</div>
                <div className="font-semibold text-gray-100">
                  {new Date(tournament.start_date).toLocaleDateString()}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rally-dark flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <div className="text-sm text-gray-500">Teams</div>
                <div className="font-semibold text-gray-100">
                  {teams.length}{tournament.max_teams ? ` / ${tournament.max_teams}` : ''}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rally-dark flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-sm text-gray-500">Format</div>
                <div className="font-semibold text-gray-100">{getFormatDisplayName(tournament.format)}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rally-dark flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <div className="text-sm text-gray-500">Match Format</div>
                <div className="font-semibold text-gray-100">Best of {tournament.best_of}</div>
              </div>
            </div>
          </div>

          {/* Venue */}
          {tournament.venue && (
            <div className="p-4 bg-rally-dark/50 rounded-xl">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-rally-coral" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div>
                  <div className="font-semibold text-gray-100">{tournament.venue.name}</div>
                  <div className="text-sm text-gray-400">{tournament.venue.address}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Schedule / Bracket / Standings */}
        {tournament.status === 'setup' ? (
          <div className="space-y-6 animate-slide-up">
            {/* Registration Banner */}
            <div className="card-glass p-6">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
                <h3 className="text-xl font-bold text-gray-100">Registration Open</h3>
              </div>
              <p className="text-gray-400">
                {teams.length} team{teams.length !== 1 ? 's' : ''} registered
                {tournament.max_teams ? ` of ${tournament.max_teams} max` : ''}
                {' — '}schedule and bracket will be available once the tournament begins
              </p>
            </div>

            {/* Registered Teams */}
            <div className="card-glass p-6">
              <h4 className="font-semibold text-gray-100 mb-4">
                Registered Teams ({teams.length})
              </h4>
              {teams.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-gray-500 mb-2">No teams registered yet</p>
                  <Link to="/teams" className="text-rally-coral hover:underline text-sm">
                    Create a team first →
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {teams.map((team, index) => (
                    <div key={team.id} className="flex items-center gap-3 p-3 bg-rally-dark/50 rounded-xl group">
                      <div className="w-8 h-8 rounded-lg bg-rally-dark flex items-center justify-center text-sm font-bold text-gray-400 shrink-0">
                        #{index + 1}
                      </div>
                      {team.logo_url ? (
                        <img src={team.logo_url} alt={team.name} className="w-10 h-10 rounded-lg object-cover border border-white/10" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gradient-rally flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold text-white">{team.name.charAt(0).toUpperCase()}</span>
                        </div>
                      )}
                      <Link to={`/teams/${team.id}`} className="flex-1 min-w-0">
                        <span className="font-medium text-gray-200 hover:text-rally-coral transition-colors truncate block">
                          {team.name}
                        </span>
                      </Link>
                      {(permissions.canManageTournaments || permissions.canRegisterTeamsForTournaments) && (
                        <button
                          onClick={() => handleUnregisterTeam(team.id)}
                          disabled={registering}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100"
                          title="Remove from tournament"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Teams (admin only) */}
            {(permissions.canManageTournaments || permissions.canRegisterTeamsForTournaments) && (
              <div className="card-glass p-6">
                <h4 className="font-semibold text-gray-100 mb-4">Add Teams</h4>
                {availableTeams.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-gray-500 mb-2">
                      {teams.length > 0 ? 'All teams are already registered' : 'No teams available'}
                    </p>
                    <Link to="/teams" className="text-rally-coral hover:underline text-sm">
                      Create a new team →
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {availableTeams.map((team) => (
                      <div key={team.id} className="flex items-center gap-3 p-3 bg-rally-dark/30 rounded-xl border border-dashed border-white/10">
                        {team.logo_url ? (
                          <img src={team.logo_url} alt={team.name} className="w-10 h-10 rounded-lg object-cover border border-white/10" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-rally-dark flex items-center justify-center shrink-0">
                            <span className="text-sm font-bold text-gray-400">{team.name.charAt(0).toUpperCase()}</span>
                          </div>
                        )}
                        <span className="flex-1 min-w-0 font-medium text-gray-400 truncate">{team.name}</span>
                        <button
                          onClick={() => handleRegisterTeam(team.id)}
                          disabled={registering || (!!tournament.max_teams && teams.length >= tournament.max_teams)}
                          className="px-3 py-1.5 bg-rally-coral/20 text-rally-coral rounded-lg text-sm font-medium hover:bg-rally-coral/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                        >
                          + Register
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-8 animate-slide-up">
            {/* Season Schedule */}
            {tournament.season_weeks && (
              <div className="card-glass p-6">
                <h3 className="text-xl font-bold text-gray-100 mb-4">Season Schedule</h3>
                <TournamentSchedule tournament={tournament} teams={teams} onGameUpdated={fetchTournamentData} />
              </div>
            )}

            {/* Bracket (for playoffs or single elimination) */}
            {(tournament.playoffs_enabled || tournament.format === 'single_elimination') && (
              <div className="card-glass p-6">
                <h3 className="text-xl font-bold text-gray-100 mb-4">
                  {tournament.playoffs_enabled ? 'Playoff Bracket' : 'Tournament Bracket'}
                </h3>
                <TournamentBracket tournament={tournament} teams={teams} matches={matches} onMatchUpdated={fetchTournamentData} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
