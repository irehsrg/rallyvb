import { supabase } from '../lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface SessionDetails {
  date: string;
  time: string;
  location: string;
}

interface GameDetails {
  result: 'win' | 'loss';
  ratingChange: number;
  newRating: number;
}

// Send push notification via Edge Function
async function sendPush(payload: object): Promise<boolean> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    console.log('[Push] Result:', result);
    return result.success;
  } catch (error) {
    console.error('[Push] Error:', error);
    return false;
  }
}

// Notify all subscribed users about a new session
export async function notifySessionCreated(session: {
  date: string;
  location_name?: string;
  venue?: { name: string };
}): Promise<void> {
  const date = new Date(session.date);
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const location = session.venue?.name || session.location_name || 'TBD';

  await sendPush({
    type: 'session_created',
    sessionDetails: {
      date: dateStr,
      time: timeStr,
      location,
    },
  });
}

// Notify a player about their game result
export async function notifyGameResult(
  playerId: string,
  result: 'win' | 'loss',
  ratingChange: number,
  newRating: number
): Promise<void> {
  await sendPush({
    type: 'game_results',
    playerId,
    gameDetails: {
      result,
      ratingChange,
      newRating,
    },
  });
}

// Notify a player they've been moved off the waitlist
export async function notifyWaitlistPromotion(playerId: string): Promise<void> {
  await sendPush({
    type: 'waitlist_update',
    playerId,
  });
}

// Notify checked-in players about an upcoming session
export async function notifySessionReminder(
  sessionId: string,
  session: {
    date: string;
    location_name?: string;
    venue?: { name: string };
  }
): Promise<void> {
  const date = new Date(session.date);
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const location = session.venue?.name || session.location_name || 'TBD';

  await sendPush({
    type: 'session_reminder',
    sessionId,
    sessionDetails: {
      date: dateStr,
      time: timeStr,
      location,
    },
  });
}
