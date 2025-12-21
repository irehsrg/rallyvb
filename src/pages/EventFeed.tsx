import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { OpenSession, RSVPStatus } from '../types';
import { getAdminPermissions } from '../utils/permissions';
import CreateEventModal from '../components/CreateEventModal';

export default function EventFeed() {
  const { player } = useAuth();
  const [events, setEvents] = useState<OpenSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'my_events'>('upcoming');

  const permissions = getAdminPermissions(player);
  const canCreateEvents = permissions.canCreateOpenSessions;

  useEffect(() => {
    fetchEvents();
  }, [filter, player]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('open_sessions')
        .select(`
          *,
          host:players!open_sessions_host_id_fkey(id, name, profile_photo_url),
          venue:venues(id, name, address)
        `)
        .eq('is_public', true);

      const today = new Date().toISOString().split('T')[0];

      if (filter === 'upcoming') {
        query = query
          .gte('event_date', today)
          .in('status', ['upcoming', 'active'])
          .order('event_date', { ascending: true })
          .order('start_time', { ascending: true });
      } else if (filter === 'past') {
        query = query
          .lt('event_date', today)
          .order('event_date', { ascending: false });
      } else if (filter === 'my_events' && player) {
        query = supabase
          .from('open_sessions')
          .select(`
            *,
            host:players!open_sessions_host_id_fkey(id, name, profile_photo_url),
            venue:venues(id, name, address)
          `)
          .eq('host_id', player.id)
          .order('event_date', { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch RSVP counts for each event
      const eventsWithCounts = await Promise.all(
        (data || []).map(async (event) => {
          const { data: rsvpData } = await supabase
            .from('open_session_rsvps')
            .select('status')
            .eq('session_id', event.id);

          const counts = {
            going: 0,
            maybe: 0,
            not_going: 0,
          };

          rsvpData?.forEach((rsvp) => {
            if (rsvp.status === 'going') counts.going++;
            else if (rsvp.status === 'maybe') counts.maybe++;
            else if (rsvp.status === 'not_going') counts.not_going++;
          });

          // Check user's RSVP
          let userRsvp: RSVPStatus | null = null;
          if (player) {
            const { data: myRsvp } = await supabase
              .from('open_session_rsvps')
              .select('status')
              .eq('session_id', event.id)
              .eq('player_id', player.id)
              .single();
            userRsvp = myRsvp?.status || null;
          }

          return {
            ...event,
            rsvp_counts: counts,
            user_rsvp: userRsvp,
          };
        })
      );

      setEvents(eventsWithCounts);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRSVP = async (eventId: string, status: RSVPStatus) => {
    if (!player) return;

    try {
      // Upsert the RSVP
      const { error } = await supabase
        .from('open_session_rsvps')
        .upsert(
          {
            session_id: eventId,
            player_id: player.id,
            status,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'session_id,player_id' }
        );

      if (error) throw error;

      // Update local state
      setEvents((prev) =>
        prev.map((event) => {
          if (event.id !== eventId) return event;

          const oldStatus = (event as any).user_rsvp;
          const counts = { ...event.rsvp_counts! };

          // Decrement old status count
          if (oldStatus) {
            counts[oldStatus as keyof typeof counts]--;
          }
          // Increment new status count
          counts[status]++;

          return {
            ...event,
            rsvp_counts: counts,
            user_rsvp: status,
          };
        })
      );
    } catch (error) {
      console.error('Error updating RSVP:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';

    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const getSkillLevelColor = (level: string) => {
    switch (level) {
      case 'beginner':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'intermediate':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'advanced':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'expert':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-100">Events</h1>
            <p className="text-gray-400 text-sm mt-1">Find volleyball sessions near you</p>
          </div>
          {canCreateEvents && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">Create Event</span>
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setFilter('upcoming')}
            className={`px-4 py-2 rounded-xl font-medium transition-all whitespace-nowrap ${
              filter === 'upcoming'
                ? 'bg-rally-coral text-white'
                : 'bg-rally-dark/50 text-gray-400 hover:bg-rally-dark'
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setFilter('past')}
            className={`px-4 py-2 rounded-xl font-medium transition-all whitespace-nowrap ${
              filter === 'past'
                ? 'bg-rally-coral text-white'
                : 'bg-rally-dark/50 text-gray-400 hover:bg-rally-dark'
            }`}
          >
            Past Events
          </button>
          {canCreateEvents && (
            <button
              onClick={() => setFilter('my_events')}
              className={`px-4 py-2 rounded-xl font-medium transition-all whitespace-nowrap ${
                filter === 'my_events'
                  ? 'bg-rally-coral text-white'
                  : 'bg-rally-dark/50 text-gray-400 hover:bg-rally-dark'
              }`}
            >
              My Events
            </button>
          )}
        </div>

        {/* Events List */}
        {events.length === 0 ? (
          <div className="card-glass p-12 text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h3 className="text-xl font-semibold text-gray-300 mb-2">
              {filter === 'upcoming' ? 'No upcoming events' : filter === 'past' ? 'No past events' : 'No events created yet'}
            </h3>
            <p className="text-gray-500 mb-6">
              {filter === 'my_events'
                ? 'Create your first event to get started!'
                : 'Check back later for new volleyball sessions'}
            </p>
            {canCreateEvents && filter !== 'past' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary"
              >
                Create Event
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <div key={event.id} className="card-glass p-5 hover:scale-[1.01] transition-all">
                {/* Event Header */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <Link
                      to={`/events/${event.id}`}
                      className="text-xl font-bold text-gray-100 hover:text-rally-coral transition-colors"
                    >
                      {event.title}
                    </Link>
                    <div className="flex items-center gap-2 mt-1 text-sm text-gray-400">
                      <span>Hosted by</span>
                      {(event.host as any)?.profile_photo_url ? (
                        <img
                          src={(event.host as any).profile_photo_url}
                          alt={(event.host as any).name}
                          className="w-5 h-5 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-rally-coral/20 flex items-center justify-center text-xs text-rally-coral font-bold">
                          {(event.host as any)?.name?.charAt(0) || '?'}
                        </div>
                      )}
                      <span className="font-medium text-gray-300">{(event.host as any)?.name || 'Unknown'}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-rally-coral">{formatDate(event.event_date)}</div>
                    <div className="text-sm text-gray-400">{formatTime(event.start_time)}</div>
                  </div>
                </div>

                {/* Event Details */}
                <div className="flex flex-wrap items-center gap-3 mb-4 text-sm">
                  {/* Location */}
                  <div className="flex items-center gap-1.5 text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>{(event.venue as any)?.name || event.custom_location || 'TBD'}</span>
                  </div>

                  {/* Skill Level */}
                  <span className={`px-2 py-0.5 text-xs rounded border font-medium ${getSkillLevelColor(event.skill_level)}`}>
                    {event.skill_level === 'all_levels' ? 'All Levels' : event.skill_level}
                  </span>

                  {/* Max Players */}
                  {event.max_players && (
                    <div className="flex items-center gap-1.5 text-gray-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span>Max {event.max_players}</span>
                    </div>
                  )}
                </div>

                {/* Description Preview */}
                {event.description && (
                  <p className="text-sm text-gray-400 mb-4 line-clamp-2">{event.description}</p>
                )}

                {/* RSVP Section */}
                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  {/* RSVP Counts */}
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <span className="text-green-400 font-bold">{event.rsvp_counts?.going || 0}</span>
                      <span className="text-gray-500">going</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-yellow-400 font-bold">{event.rsvp_counts?.maybe || 0}</span>
                      <span className="text-gray-500">maybe</span>
                    </div>
                  </div>

                  {/* RSVP Buttons */}
                  {player && event.status !== 'completed' && event.status !== 'cancelled' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRSVP(event.id, 'going')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          (event as any).user_rsvp === 'going'
                            ? 'bg-green-500 text-white'
                            : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                        }`}
                      >
                        Going
                      </button>
                      <button
                        onClick={() => handleRSVP(event.id, 'maybe')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          (event as any).user_rsvp === 'maybe'
                            ? 'bg-yellow-500 text-white'
                            : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                        }`}
                      >
                        Maybe
                      </button>
                      <button
                        onClick={() => handleRSVP(event.id, 'not_going')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          (event as any).user_rsvp === 'not_going'
                            ? 'bg-red-500 text-white'
                            : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                        }`}
                      >
                        Can't Go
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Event Modal */}
      {showCreateModal && (
        <CreateEventModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchEvents();
          }}
        />
      )}
    </div>
  );
}
