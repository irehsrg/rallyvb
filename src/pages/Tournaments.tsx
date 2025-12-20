import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Tournament, TournamentStatus, Venue } from '../types';

interface TournamentWithDetails extends Tournament {
  venue?: Venue;
  team_count: number;
}

export default function Tournaments() {
  const [tournaments, setTournaments] = useState<TournamentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | TournamentStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      const { data: tournamentsData, error: tournamentsError } = await supabase
        .from('tournaments')
        .select(`
          *,
          venue:venues(*)
        `)
        .order('start_date', { ascending: false });

      if (tournamentsError) throw tournamentsError;

      // Fetch team counts for each tournament
      const tournamentsWithCounts = await Promise.all(
        (tournamentsData || []).map(async (tournament) => {
          const { data: teams } = await supabase
            .from('tournament_teams')
            .select('id')
            .eq('tournament_id', tournament.id);

          return {
            ...tournament,
            team_count: teams?.length || 0,
          };
        })
      );

      setTournaments(tournamentsWithCounts);
    } catch (error) {
      console.error('Error fetching tournaments:', error);
    } finally {
      setLoading(false);
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

  const filteredTournaments = tournaments
    .filter(t => filter === 'all' || t.status === filter)
    .filter(t =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const statusCounts = {
    all: tournaments.length,
    setup: tournaments.filter(t => t.status === 'setup').length,
    active: tournaments.filter(t => t.status === 'active').length,
    completed: tournaments.filter(t => t.status === 'completed').length,
    cancelled: tournaments.filter(t => t.status === 'cancelled').length,
  };

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
        <div className="mb-8 animate-fade-in">
          <h1 className="text-4xl font-bold text-gray-100 mb-2">Tournaments</h1>
          <p className="text-gray-400">Browse volleyball tournaments and competitions</p>
        </div>

        {/* Search and Filters */}
        <div className="card-glass p-6 mb-8 animate-slide-up">
          <div className="mb-4">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tournaments..."
                className="input-modern w-full pl-10"
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
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
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${
                filter === 'all'
                  ? 'bg-rally-coral text-white'
                  : 'bg-rally-dark/50 text-gray-400 hover:bg-rally-dark'
              }`}
            >
              All ({statusCounts.all})
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${
                filter === 'active'
                  ? 'bg-green-500 text-white'
                  : 'bg-rally-dark/50 text-gray-400 hover:bg-rally-dark'
              }`}
            >
              Active ({statusCounts.active})
            </button>
            <button
              onClick={() => setFilter('setup')}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${
                filter === 'setup'
                  ? 'bg-gray-500 text-white'
                  : 'bg-rally-dark/50 text-gray-400 hover:bg-rally-dark'
              }`}
            >
              Upcoming ({statusCounts.setup})
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${
                filter === 'completed'
                  ? 'bg-blue-500 text-white'
                  : 'bg-rally-dark/50 text-gray-400 hover:bg-rally-dark'
              }`}
            >
              Completed ({statusCounts.completed})
            </button>
          </div>
        </div>

        {/* Tournaments List */}
        {filteredTournaments.length === 0 ? (
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
                d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
              />
            </svg>
            <h3 className="text-xl font-semibold text-gray-300 mb-2">No Tournaments Found</h3>
            <p className="text-gray-500">
              {searchQuery ? 'Try a different search term' : 'No tournaments match your filters'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredTournaments.map((tournament, index) => (
              <Link
                key={tournament.id}
                to={`/tournaments/${tournament.id}`}
                className="card-glass p-6 hover:scale-[1.02] transition-all duration-300 group block animate-slide-up"
                style={{ animationDelay: `${0.1 + index * 0.05}s` }}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-2xl font-bold text-gray-100 group-hover:text-rally-coral transition-colors">
                        {tournament.name}
                      </h3>
                      <span className={`px-3 py-1 text-xs rounded-lg border font-medium ${getStatusBadgeClass(tournament.status)}`}>
                        {tournament.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    {tournament.description && (
                      <p className="text-gray-400 mb-3">{tournament.description}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-gray-400">
                      {new Date(tournament.start_date).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span className="text-gray-400">
                      {tournament.team_count} {tournament.team_count === 1 ? 'team' : 'teams'}
                      {tournament.max_teams && ` / ${tournament.max_teams}`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-gray-400">{getFormatDisplayName(tournament.format)}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span className="text-gray-400">Best of {tournament.best_of}</span>
                  </div>
                </div>

                {tournament.venue && (
                  <div className="flex items-center gap-2 text-sm text-rally-coral">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>{tournament.venue.name}</span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
