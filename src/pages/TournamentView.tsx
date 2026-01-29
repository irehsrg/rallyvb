import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Tournament, Team, TournamentGame, Venue } from '../types';
import TournamentBracket from '../components/TournamentBracket';
import TournamentSchedule from '../components/TournamentSchedule';

interface TournamentWithVenue extends Tournament {
  venue?: Venue;
}

export default function TournamentView() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const [tournament, setTournament] = useState<TournamentWithVenue | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<TournamentGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tournamentId) {
      fetchTournamentData();
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
          <div className="card-glass p-12 text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-xl font-semibold text-gray-300 mb-2">Tournament Not Started</h3>
            <p className="text-gray-500">The schedule and bracket will be available once the tournament begins</p>
            <div className="mt-6">
              <h4 className="font-semibold text-gray-300 mb-3">Registered Teams</h4>
              <div className="flex flex-wrap justify-center gap-2">
                {teams.map((team) => (
                  <Link
                    key={team.id}
                    to={`/teams/${team.id}`}
                    className="px-4 py-2 bg-rally-dark/50 hover:bg-rally-dark rounded-lg text-gray-300 hover:text-rally-coral transition-all"
                  >
                    {team.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-slide-up">
            {/* Season Schedule */}
            {tournament.season_weeks && (
              <div className="card-glass p-6">
                <h3 className="text-xl font-bold text-gray-100 mb-4">Season Schedule</h3>
                <TournamentSchedule tournament={tournament} teams={teams} />
              </div>
            )}

            {/* Bracket (for playoffs or single elimination) */}
            {(tournament.playoffs_enabled || tournament.format === 'single_elimination') && (
              <div className="card-glass p-6">
                <h3 className="text-xl font-bold text-gray-100 mb-4">
                  {tournament.playoffs_enabled ? 'Playoff Bracket' : 'Tournament Bracket'}
                </h3>
                <TournamentBracket tournament={tournament} teams={teams} matches={matches} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
