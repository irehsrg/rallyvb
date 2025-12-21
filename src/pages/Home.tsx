import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Session as SessionType, Player, Waitlist } from '../types';
import { Link } from 'react-router-dom';
import GroupsModal from '../components/GroupsModal';

export default function Home() {
  const { player } = useAuth();
  const [currentSession, setCurrentSession] = useState<SessionType | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkinCount, setCheckinCount] = useState(0);
  const [checkedInPlayers, setCheckedInPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [waitlist, setWaitlist] = useState<(Waitlist & { player?: Player })[]>([]);
  const [onWaitlist, setOnWaitlist] = useState(false);
  const [deadlinePassed, setDeadlinePassed] = useState(false);
  const [timeUntilDeadline, setTimeUntilDeadline] = useState<string | null>(null);
  const [showGroupsModal, setShowGroupsModal] = useState(false);

  useEffect(() => {
    fetchCurrentSession();
  }, [player]);

  // Check deadline status periodically
  useEffect(() => {
    if (!currentSession?.checkin_deadline) return;

    const checkDeadline = () => {
      const now = new Date();
      const deadline = new Date(currentSession.checkin_deadline!);
      const isPast = now > deadline;
      setDeadlinePassed(isPast);

      if (!isPast) {
        // Calculate time remaining
        const diff = deadline.getTime() - now.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 0) {
          setTimeUntilDeadline(`${hours}h ${minutes}m`);
        } else if (minutes > 0) {
          setTimeUntilDeadline(`${minutes}m`);
        } else {
          setTimeUntilDeadline('< 1m');
        }
      } else {
        setTimeUntilDeadline(null);
      }
    };

    checkDeadline();
    const interval = setInterval(checkDeadline, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [currentSession?.checkin_deadline]);

  // Real-time subscription for check-ins and waitlist
  useEffect(() => {
    if (!currentSession) return;

    const channel = supabase
      .channel('session_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'session_checkins',
          filter: `session_id=eq.${currentSession.id}`,
        },
        () => {
          // Refresh checked-in players when changes occur
          fetchCheckedInPlayers();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'waitlist',
          filter: `session_id=eq.${currentSession.id}`,
        },
        () => {
          // Refresh waitlist when changes occur
          fetchWaitlist();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentSession?.id]);

  const fetchCheckedInPlayers = async () => {
    if (!currentSession || !player) return;

    try {
      const { data: checkin } = await supabase
        .from('session_checkins')
        .select('*')
        .eq('session_id', currentSession.id)
        .eq('player_id', player.id)
        .single();

      setCheckedIn(!!checkin);

      // Fetch checked-in players with their details
      const { data: checkins } = await supabase
        .from('session_checkins')
        .select(`
          *,
          player:players (*)
        `)
        .eq('session_id', currentSession.id)
        .order('checked_in_at', { ascending: true });

      const players = checkins?.map(c => c.player).filter(Boolean) || [];
      setCheckedInPlayers(players as Player[]);
      setCheckinCount(players.length);
    } catch (error) {
      console.error('Error fetching checked-in players:', error);
    }
  };

  const fetchWaitlist = async () => {
    if (!currentSession || !player) return;

    try {
      // Check if current player is on waitlist
      const { data: myWaitlistEntry } = await supabase
        .from('waitlist')
        .select('*')
        .eq('session_id', currentSession.id)
        .eq('player_id', player.id)
        .single();

      setOnWaitlist(!!myWaitlistEntry);

      // Fetch all waitlist entries with player details
      const { data: waitlistEntries } = await supabase
        .from('waitlist')
        .select(`
          *,
          player:players (*)
        `)
        .eq('session_id', currentSession.id)
        .order('position', { ascending: true });

      setWaitlist((waitlistEntries as any) || []);
    } catch (error) {
      console.error('Error fetching waitlist:', error);
    }
  };

  const fetchCurrentSession = async () => {
    try {
      const { data: session } = await supabase
        .from('sessions')
        .select(`
          *,
          venue:venues(*)
        `)
        .in('status', ['setup', 'active'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      setCurrentSession(session as any);

      if (session && player) {
        await Promise.all([fetchCheckedInPlayers(), fetchWaitlist()]);
      }
    } catch (error) {
      console.error('Error fetching session:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckin = async () => {
    if (!currentSession || !player) return;

    try {
      if (checkedIn) {
        // Check out
        await supabase
          .from('session_checkins')
          .delete()
          .eq('session_id', currentSession.id)
          .eq('player_id', player.id);
        setCheckedIn(false);
        setCheckinCount(prev => prev - 1);
        setCheckedInPlayers(prev => prev.filter(p => p.id !== player.id));
      } else {
        // Check if deadline has passed
        if (currentSession.checkin_deadline && deadlinePassed) {
          alert(`Check-in deadline has passed! The deadline was ${new Date(currentSession.checkin_deadline).toLocaleString()}.`);
          return;
        }

        // Check if session is full
        if (currentSession.max_players && checkinCount >= currentSession.max_players) {
          alert(`Session is full! Join the waitlist to be notified when a spot opens up.`);
          return;
        }

        // Check in
        await supabase
          .from('session_checkins')
          .insert({
            session_id: currentSession.id,
            player_id: player.id,
          });
        setCheckedIn(true);
        setCheckinCount(prev => prev + 1);
        setCheckedInPlayers(prev => [...prev, player]);
      }
    } catch (error: any) {
      console.error('Error toggling check-in:', error);
      alert('Failed to update check-in status');
    }
  };

  const handleJoinWaitlist = async () => {
    if (!currentSession || !player) return;

    try {
      // Get current waitlist count to determine position
      const { data: currentWaitlist } = await supabase
        .from('waitlist')
        .select('position')
        .eq('session_id', currentSession.id)
        .order('position', { ascending: false })
        .limit(1);

      const nextPosition = currentWaitlist && currentWaitlist.length > 0
        ? currentWaitlist[0].position + 1
        : 1;

      await supabase
        .from('waitlist')
        .insert({
          session_id: currentSession.id,
          player_id: player.id,
          position: nextPosition,
          notified: false,
        });

      setOnWaitlist(true);
      await fetchWaitlist();
    } catch (error) {
      console.error('Error joining waitlist:', error);
      alert('Failed to join waitlist');
    }
  };

  const handleLeaveWaitlist = async () => {
    if (!currentSession || !player) return;

    try {
      await supabase
        .from('waitlist')
        .delete()
        .eq('session_id', currentSession.id)
        .eq('player_id', player.id);

      setOnWaitlist(false);
      await fetchWaitlist();
    } catch (error) {
      console.error('Error leaving waitlist:', error);
      alert('Failed to leave waitlist');
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-4xl font-bold text-gray-100 mb-8 animate-fade-in">
          Welcome back{player ? `, ${player.name.split(' ')[0]}` : ''}! 🏐
        </h1>

        {/* Stats Grid */}
        {player && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 animate-slide-up">
            <div className="stat-card">
              <div className="text-3xl font-bold text-gradient-rally">
                {player.rating}
              </div>
              <div className="text-sm text-gray-400 mt-1">Rating</div>
            </div>

            <div className="stat-card">
              <div className="text-3xl font-bold text-gray-100">
                {player.games_played}
              </div>
              <div className="text-sm text-gray-400 mt-1">Games</div>
            </div>

            <div className="stat-card">
              <div className="text-3xl font-bold text-green-400">
                {player.games_played > 0
                  ? Math.round((player.wins / player.games_played) * 100)
                  : 0}
                %
              </div>
              <div className="text-sm text-gray-400 mt-1">Win Rate</div>
            </div>

            <div className="stat-card">
              <div className="text-3xl font-bold text-orange-400">
                {player.win_streak > 0 ? `🔥 ${player.win_streak}` : '-'}
              </div>
              <div className="text-sm text-gray-400 mt-1">Streak</div>
            </div>
          </div>
        )}

        {/* Current Session Card */}
        {currentSession ? (
          <div className="card-glass p-8 mb-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-100 mb-2">Current Session</h3>
                <div className="flex items-center gap-4 text-gray-400">
                  <span className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {new Date(currentSession.date).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {currentSession.court_count} courts
                  </span>
                </div>
              </div>
              <span
                className={`px-4 py-2 rounded-xl text-sm font-bold ${
                  currentSession.status === 'setup'
                    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                    : currentSession.status === 'active'
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                }`}
              >
                {currentSession.status.toUpperCase()}
              </span>
            </div>

            {/* Location with Google Maps */}
            {(currentSession.venue || currentSession.location_name) && (
              <div className="bg-rally-dark/50 border border-rally-coral/30 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <svg className="w-5 h-5 text-rally-coral mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <div>
                      <div className="font-semibold text-rally-coral mb-1">Location</div>
                      {currentSession.venue ? (
                        <>
                          <div className="text-sm font-medium text-gray-200">{currentSession.venue.name}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{currentSession.venue.address}</div>
                          {currentSession.venue.notes && (
                            <div className="text-xs text-gray-500 mt-1 italic">{currentSession.venue.notes}</div>
                          )}
                        </>
                      ) : (
                        <div className="text-sm text-gray-300">{currentSession.location_name}</div>
                      )}
                    </div>
                  </div>
                  <a
                    href={
                      currentSession.venue?.google_maps_url ||
                      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        currentSession.venue?.address || currentSession.location_name || ''
                      )}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 hover:border-blue-500/50 transition-all text-sm font-medium flex items-center gap-2 whitespace-nowrap"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    Get Directions
                  </a>
                </div>
              </div>
            )}

            {/* Session Notes */}
            {currentSession.notes && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <div className="font-semibold text-blue-400 mb-1">Session Notes</div>
                    <div className="text-sm text-gray-300">{currentSession.notes}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Check-in Deadline */}
            {currentSession.checkin_deadline && (
              <div className={`rounded-xl p-4 mb-6 ${
                deadlinePassed
                  ? 'bg-red-500/10 border border-red-500/30'
                  : timeUntilDeadline && (timeUntilDeadline.includes('h') || parseInt(timeUntilDeadline) > 30)
                  ? 'bg-green-500/10 border border-green-500/30'
                  : 'bg-orange-500/10 border border-orange-500/30'
              }`}>
                <div className="flex items-start gap-3">
                  <svg className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                    deadlinePassed ? 'text-red-400' : timeUntilDeadline && (timeUntilDeadline.includes('h') || parseInt(timeUntilDeadline) > 30) ? 'text-green-400' : 'text-orange-400'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <div className={`font-semibold mb-1 ${
                      deadlinePassed ? 'text-red-400' : timeUntilDeadline && (timeUntilDeadline.includes('h') || parseInt(timeUntilDeadline) > 30) ? 'text-green-400' : 'text-orange-400'
                    }`}>
                      {deadlinePassed ? 'Check-in Deadline Passed' : 'Check-in Deadline'}
                    </div>
                    <div className="text-sm text-gray-300">
                      {new Date(currentSession.checkin_deadline).toLocaleString([], {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                      {!deadlinePassed && timeUntilDeadline && (
                        <span className={`ml-2 font-semibold ${
                          timeUntilDeadline.includes('h') || parseInt(timeUntilDeadline) > 30 ? 'text-green-400' : 'text-orange-400'
                        }`}>
                          ({timeUntilDeadline} remaining)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between bg-rally-dark/50 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-rally flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                  </svg>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-100">
                    {checkinCount}
                    {currentSession.max_players && (
                      <span className="text-lg text-gray-400"> / {currentSession.max_players}</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-400">
                    Players Checked In
                    {currentSession.max_players && checkinCount >= currentSession.max_players && (
                      <span className="ml-2 text-red-400 font-semibold">(FULL)</span>
                    )}
                  </div>
                </div>
              </div>

              {player && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowGroupsModal(true)}
                    className="px-4 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center gap-2 bg-rally-dark/50 text-gray-300 border-2 border-white/10 hover:border-rally-coral/30 hover:bg-rally-dark"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Groups
                  </button>
                  {checkedIn ? (
                    <button
                      onClick={handleCheckin}
                      className="px-6 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center gap-2 bg-red-500/20 text-red-400 border-2 border-red-500/50 hover:bg-red-500/30"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Check Out
                    </button>
                  ) : (
                    <>
                      {deadlinePassed ? (
                        <button
                          disabled
                          className="px-6 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center gap-2 bg-gray-500/20 text-gray-500 border-2 border-gray-500/50 cursor-not-allowed"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Deadline Passed
                        </button>
                      ) : currentSession.max_players && checkinCount >= currentSession.max_players ? (
                        onWaitlist ? (
                          <button
                            onClick={handleLeaveWaitlist}
                            className="px-6 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center gap-2 bg-orange-500/20 text-orange-400 border-2 border-orange-500/50 hover:bg-orange-500/30"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Leave Waitlist
                          </button>
                        ) : (
                          <button
                            onClick={handleJoinWaitlist}
                            className="px-6 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center gap-2 bg-yellow-500/20 text-yellow-400 border-2 border-yellow-500/50 hover:bg-yellow-500/30"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Join Waitlist
                          </button>
                        )
                      ) : (
                        <button
                          onClick={handleCheckin}
                          className="px-6 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center gap-2 btn-primary"
                        >
                          Check In Now
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {checkedIn && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-green-400 text-center">
                <svg className="w-6 h-6 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div className="font-medium">You're all set! We'll notify you when teams are ready.</div>
              </div>
            )}

            {onWaitlist && !checkedIn && (
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 text-orange-400 text-center">
                <svg className="w-6 h-6 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="font-medium">
                  You're on the waitlist! Position: #{waitlist.findIndex(w => w.player_id === player?.id) + 1}
                </div>
                <div className="text-sm mt-1">We'll notify you when a spot opens up.</div>
              </div>
            )}

            {/* Checked-in Players List */}
            {checkedInPlayers.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Checked In ({checkedInPlayers.length})
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {checkedInPlayers.map((p) => (
                    <div
                      key={p.id}
                      className="bg-rally-dark/50 rounded-xl p-3 flex items-center gap-2 hover:bg-rally-dark/70 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-rally flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-sm">
                          {p.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-100 truncate">
                          {p.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {p.rating}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Waitlist */}
            {waitlist.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Waitlist ({waitlist.length})
                </h4>
                <div className="space-y-2">
                  {waitlist.map((entry, index) => (
                    <div
                      key={entry.id}
                      className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-orange-400 font-bold text-sm">
                          #{index + 1}
                        </span>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-sm">
                          {entry.player?.name.charAt(0).toUpperCase() || '?'}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-100">
                          {entry.player?.name || 'Unknown'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {entry.player?.rating || 'N/A'}
                        </div>
                      </div>
                      <div className="text-xs text-orange-400 font-medium">
                        {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="card-glass p-12 mb-8 text-center animate-slide-up">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h3 className="text-xl font-semibold text-gray-300 mb-2">No Active Session</h3>
            <p className="text-gray-500">Check back later or contact your admin to create a session</p>
          </div>
        )}

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            to="/leaderboard"
            className="card-glass p-6 hover:scale-105 transition-transform duration-300 group"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-rally flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-100 mb-1">Leaderboard</h3>
                <p className="text-sm text-gray-400">View player rankings and stats</p>
              </div>
            </div>
          </Link>

          {player && (
            <Link
              to="/profile"
              className="card-glass p-6 hover:scale-105 transition-transform duration-300 group"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-rally flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-100 mb-1">My Profile</h3>
                  <p className="text-sm text-gray-400">View your stats and game history</p>
                </div>
              </div>
            </Link>
          )}
        </div>

        {/* Groups Modal */}
        {showGroupsModal && (
          <GroupsModal
            onClose={() => setShowGroupsModal(false)}
            sessionId={currentSession?.id}
          />
        )}
      </div>
    </div>
  );
}
