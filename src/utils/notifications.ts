import { supabase } from '../lib/supabase';

// Send push notification via Edge Function.
// supabase.functions.invoke attaches the signed-in user's access token, which the
// Edge Function verifies before sending anything (anon-key-only calls are rejected).
async function sendPush(payload: object): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.warn('[Push] Not signed in; skipping notification');
      return false;
    }

    const { data, error } = await supabase.functions.invoke('send-push', { body: payload });
    if (error) {
      console.error('[Push] Error:', error);
      return false;
    }
    console.log('[Push] Result:', data);
    return !!data?.success;
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

// ============================================================================
// OPEN SESSION (EVENT) NOTIFICATIONS
// ============================================================================

// Notify all subscribed users about a new public event
export async function notifyNewEvent(event: {
  id: string;
  title: string;
  event_date: string;
  start_time: string;
  host_name: string;
  location: string;
}): Promise<void> {
  const date = new Date(event.event_date + 'T00:00:00');
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  // Format time from HH:MM:SS to readable format
  const [hours, minutes] = event.start_time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  const timeStr = `${hour12}:${minutes} ${ampm}`;

  await sendPush({
    type: 'new_event',
    eventId: event.id,
    eventDetails: {
      title: event.title,
      date: dateStr,
      time: timeStr,
      host: event.host_name,
      location: event.location,
    },
  });
}

// Notify a user when someone replies to their comment
export async function notifyCommentReply(
  recipientId: string,
  event: {
    id: string;
    title: string;
  },
  commenterName: string
): Promise<void> {
  await sendPush({
    type: 'comment_reply',
    playerId: recipientId,
    eventId: event.id,
    eventDetails: {
      title: event.title,
      commenterName,
    },
  });
}

// Notify RSVPed users about an upcoming event (1 hour before)
export async function notifyEventReminder(
  eventId: string,
  event: {
    title: string;
    event_date: string;
    start_time: string;
    location: string;
  }
): Promise<void> {
  const date = new Date(event.event_date + 'T00:00:00');
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const [hours, minutes] = event.start_time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  const timeStr = `${hour12}:${minutes} ${ampm}`;

  await sendPush({
    type: 'event_reminder',
    eventId,
    eventDetails: {
      title: event.title,
      date: dateStr,
      time: timeStr,
      location: event.location,
    },
  });
}
