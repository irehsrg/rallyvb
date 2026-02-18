import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Session, Game } from '../types';

interface SessionWithGames extends Session {
  games: Game[];
  checkin_count: number;
}

export default function SessionHistory() {
  const [sessions, setSessions] = useState<SessionWithGames[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'completed'>('completed');

  useEffect(() => {
    fetchSessions();
  }, [filter]);

  const fetchSessions = async () => {
    try {
      let query = supabase
        .from('sessions')
        .select(`
          *,
          games (
            id,
            court_number,
            score_a,
            score_b,
            winner,
            status
          )
        `)
        .order('date', { ascending: false })
        .limit(20);

      if (filter === 'completed') {
        query = query.eq('status', 'completed');
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch checkin counts for each session
      const sessionsWithCounts = await Promise.all(
        (data || []).map(async (session) => {
          const { count } = await supabase
            .from('session_checkins')
            .select('*', { count: 'exact', head: true })
            .eq('session_id', session.id);

          return {
            ...session,
            checkin_count: count || 0,
          };
        })
      );

      setSessions(sessionsWithCounts);
    } catch (error) {
      console.error('Error fetching sessions:', error);
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

  const getStatusBadge = (status: string) => {
    const styles = {
      setup: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      active: 'bg-green-500/20 text-green-400 border-green-500/30',
      completed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    };
    return styles[status as keyof typeof styles] || styles.completed;
  };

  return (
    <div className="min-h-screen bg-rally-darker">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-4xl font-bold text-gray-100 mb-2">Session History</h1>
          <p className="text-gray-400">View past volleyball sessions and games</p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-xl font-medium transition-all ${
              filter === 'all'
                ? 'bg-rally-coral text-white'
                : 'bg-rally-dark/50 text-gray-400 hover:bg-rally-dark'
            }`}
          >
            All Sessions
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-4 py-2 rounded-xl font-medium transition-all ${
              filter === 'completed'
                ? 'bg-rally-coral text-white'
                : 'bg-rally-dark/50 text-gray-400 hover:bg-rally-dark'
            }`}
          >
            Completed Only
          </button>
        </div>

        {/* Sessions List */}
        <div className="space-y-4 animate-slide-up">
          {sessions.map((session, index) => (
            <div
              key={session.id}
              className="card-glass p-6 hover:scale-[1.01] transition-all duration-300"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-gray-100">
                      {new Date(session.date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </h3>
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-bold border ${getStatusBadge(
                        session.status
                      )}`}
                    >
                      {session.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      {session.court_count} {session.court_count === 1 ? 'court' : 'courts'}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                      </svg>
                      {session.checkin_count} {session.checkin_count === 1 ? 'player' : 'players'}
                    </span>
                    {session.games && session.games.length > 0 && (
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        {session.games.length} {session.games.length === 1 ? 'game' : 'games'}
                      </span>
                    )}
                  </div>
                </div>

                {session.completed_at && (
                  <div className="text-sm text-gray-500 mt-2 md:mt-0">
                    Completed {new Date(session.completed_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} at {new Date(session.completed_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </div>
                )}
              </div>

              {/* Games Grid */}
              {session.games && session.games.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Games Played
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {session.games.map((game) => (
                      <div
                        key={game.id}
                        className="bg-rally-dark/50 rounded-lg p-3 hover:bg-rally-dark/70 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-medium text-gray-500">Court {game.court_number}</div>
                          {game.status === 'completed' && (
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-bold text-gray-100">
                                {game.score_a} - {game.score_b}
                              </div>
                              {game.winner && (
                                <span className="text-xs font-bold text-green-400">
                                  Team {game.winner}
                                </span>
                              )}
                            </div>
                          )}
                          {game.status === 'pending' && (
                            <span className="text-xs text-yellow-400">Pending</span>
                          )}
                          {game.status === 'in_progress' && (
                            <span className="text-xs text-blue-400">In Progress</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {sessions.length === 0 && (
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
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <h3 className="text-xl font-semibold text-gray-300 mb-2">No sessions found</h3>
            <p className="text-gray-500">Past sessions will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}
