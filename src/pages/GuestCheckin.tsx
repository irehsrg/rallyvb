import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Session } from '../types';

export default function GuestCheckin() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [guestName, setGuestName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchSession();
  }, [sessionId]);

  const fetchSession = async () => {
    if (!sessionId) return;

    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .in('status', ['setup', 'active'])
        .single();

      if (error) throw error;
      setSession(data);
    } catch (error) {
      console.error('Error fetching session:', error);
      setError('Session not found or no longer active');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !guestName.trim()) return;

    setSubmitting(true);
    setError('');

    try {
      // Create or find guest player
      // Use simple format: guest{timestamp}@rally.app (no underscores or special chars)
      const guestEmail = `guest${Date.now()}${Math.random().toString(36).substring(2, 6)}@rally.app`;

      // Check if guest already exists (by name in this session)
      const { data: existingCheckin } = await supabase
        .from('session_checkins')
        .select(`
          *,
          player:players(name)
        `)
        .eq('session_id', session.id);

      const alreadyCheckedIn = existingCheckin?.some((c: any) =>
        c.player?.name?.toLowerCase() === guestName.trim().toLowerCase()
      );

      if (alreadyCheckedIn) {
        setError('A player with this name is already checked in');
        setSubmitting(false);
        return;
      }

      // Create guest player account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: guestEmail,
        password: Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2),
        options: {
          data: {
            name: `${guestName.trim()} (Guest)`,
          },
        },
      });

      if (authError) {
        console.error('Auth error:', authError);
        throw authError;
      }

      console.log('Auth successful:', { hasUser: !!authData.user, hasSession: !!authData.session });

      if (authData.user && authData.session) {
        console.log('Setting session...');
        // Ensure the session is set for subsequent requests
        await supabase.auth.setSession({
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
        });

        console.log('Creating player record...');
        // Create player record (now with authenticated context)
        let playerData;
        const { data: insertData, error: playerError } = await supabase
          .from('players')
          .insert({
            id: authData.user.id,
            name: `${guestName.trim()} (Guest)`,
            rating: 1500,
            is_guest: true, // Mark as guest to exclude from leaderboards
          })
          .select()
          .single();

        if (playerError) {
          // If duplicate key error, fetch the existing player instead
          if (playerError.code === '23505') {
            console.log('Player already exists, fetching existing record...');
            const { data: existingPlayer, error: fetchError } = await supabase
              .from('players')
              .select()
              .eq('id', authData.user.id)
              .single();

            if (fetchError) {
              console.error('Error fetching existing player:', fetchError);
              throw fetchError;
            }
            playerData = existingPlayer;
          } else {
            console.error('Player insert error:', playerError);
            throw playerError;
          }
        } else {
          playerData = insertData;
        }

        console.log('Player ready:', playerData);

        // Check in to session
        console.log('Attempting to check in guest player:', playerData.id, 'to session:', session.id);
        const { data: checkinData, error: checkinError } = await supabase
          .from('session_checkins')
          .insert({
            session_id: session.id,
            player_id: playerData.id,
          })
          .select();

        console.log('Check-in response:', { data: checkinData, error: checkinError });

        if (checkinError) {
          console.error('Check-in insert error:', checkinError);
          alert(`Check-in failed: ${checkinError.message}`);
          throw checkinError;
        }

        console.log('Check-in successful:', checkinData);
        alert('Guest checked in successfully!');
        setSuccess(true);
        setTimeout(() => {
          navigate('/');
        }, 2000);
      } else {
        console.error('Missing user or session after signup:', { user: authData.user, session: authData.session });
        throw new Error('Failed to create guest session');
      }
    } catch (error: any) {
      console.error('Error with guest check-in:', error);
      setError(error.message || 'Failed to check in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-rally-darker flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-rally-coral"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-rally-darker flex items-center justify-center p-4">
        <div className="card-glass p-8 max-w-md w-full text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-2xl font-bold text-gray-100 mb-2">Session Not Found</h2>
          <p className="text-gray-400 mb-6">{error || 'This session is no longer available'}</p>
          <button
            onClick={() => navigate('/')}
            className="btn-primary"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-rally-darker flex items-center justify-center p-4">
        <div className="card-glass p-8 max-w-md w-full text-center animate-fade-in">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-100 mb-2">Checked In!</h2>
          <p className="text-gray-400 mb-4">Welcome to the session, {guestName}!</p>
          <p className="text-sm text-gray-500">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-rally-darker flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-rally-coral/20 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-rally-accent/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="max-w-md w-full space-y-8 relative z-10">
        {/* Header */}
        <div className="text-center animate-fade-in">
          <img
            src="/RallyIcon.png"
            alt="Rally"
            className="w-24 h-24 mx-auto mb-6 rounded-3xl shadow-2xl shadow-rally-coral/50"
          />
          <h2 className="text-4xl font-bold text-gradient-rally mb-2">
            Guest Check-in
          </h2>
          <p className="text-gray-400 text-lg mb-2">
            {new Date(session.date).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric'
            })}
          </p>
          {session.location_name && (
            <p className="text-rally-coral font-medium">
              {session.location_name}
            </p>
          )}
        </div>

        {/* Form */}
        <form className="card-glass p-8 space-y-6 animate-slide-up" onSubmit={handleGuestCheckin}>
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl animate-fade-in">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="guestName" className="block text-sm font-medium text-gray-300 mb-2">
              Your Name
            </label>
            <input
              id="guestName"
              name="guestName"
              type="text"
              required
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="input-modern w-full"
              placeholder="Enter your name"
              disabled={submitting}
            />
            <p className="mt-2 text-xs text-gray-500">
              You'll be checked in as a guest for this session only
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting || !guestName.trim()}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Checking in...
              </span>
            ) : (
              'Check In'
            )}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-sm text-rally-coral hover:text-rally-accent transition-colors"
            >
              Have an account? Sign in
            </button>
          </div>
        </form>

        <div className="card-glass p-4 text-center">
          <p className="text-xs text-gray-500">
            <strong className="text-gray-400">Note:</strong> Guest check-ins are temporary and won't save your rating progress.
            Create an account to track your stats!
          </p>
        </div>
      </div>
    </div>
  );
}
