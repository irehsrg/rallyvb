-- ============================================================================
-- EVENT REMINDER SCHEDULED JOB
-- Rally Volleyball App - Sends push notifications 1 hour before events
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres user
GRANT USAGE ON SCHEMA cron TO postgres;

-- ============================================================================
-- FUNCTION: Send event reminders
-- ============================================================================

CREATE OR REPLACE FUNCTION send_event_reminders()
RETURNS void AS $$
DECLARE
  event_record RECORD;
  recipient RECORD;
  payload JSONB;
BEGIN
  -- Find events starting in the next hour that haven't had reminders sent
  FOR event_record IN
    SELECT
      os.id,
      os.title,
      os.event_date,
      os.start_time,
      COALESCE(v.name, os.custom_location, 'TBD') as location
    FROM open_sessions os
    LEFT JOIN venues v ON v.id = os.venue_id
    WHERE os.status = 'upcoming'
      AND os.event_date = CURRENT_DATE
      AND os.start_time BETWEEN
          (CURRENT_TIME + INTERVAL '55 minutes')
          AND (CURRENT_TIME + INTERVAL '65 minutes')
      -- Check if reminder was already sent (use a simple approach with logs)
      AND NOT EXISTS (
        SELECT 1 FROM push_notification_logs pnl
        WHERE pnl.notification_type = 'event_reminder'
          AND pnl.title LIKE '%' || os.title || '%'
          AND pnl.sent_at > NOW() - INTERVAL '2 hours'
      )
  LOOP
    -- For each upcoming event, notify users who RSVP'd "going"
    FOR recipient IN
      SELECT
        ps.player_id,
        ps.endpoint,
        ps.p256dh_key,
        ps.auth_key,
        p.name as player_name
      FROM open_session_rsvps osr
      JOIN players p ON p.id = osr.player_id
      JOIN push_subscriptions ps ON ps.player_id = p.id
      WHERE osr.session_id = event_record.id
        AND osr.status = 'going'
        AND p.push_notifications_enabled = true
        AND (p.notification_preferences->>'session_reminder')::boolean = true
    LOOP
      -- Log that we're sending a reminder (the actual push is handled by Edge Function)
      INSERT INTO push_notification_logs (
        player_id,
        notification_type,
        title,
        body,
        status
      ) VALUES (
        recipient.player_id,
        'event_reminder',
        'Event Starting Soon!',
        event_record.title || ' at ' || event_record.location || ' starts in 1 hour!',
        'pending'
      );
    END LOOP;

    -- Call the Edge Function to send the actual notifications
    -- Note: This requires http extension or you can use Supabase's built-in webhook
    PERFORM
      net.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/send-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
        ),
        body := jsonb_build_object(
          'type', 'event_reminder',
          'eventId', event_record.id,
          'eventDetails', jsonb_build_object(
            'title', event_record.title,
            'date', to_char(event_record.event_date, 'Dy, Mon DD'),
            'time', to_char(event_record.start_time, 'HH12:MI AM'),
            'location', event_record.location
          )
        )
      );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ALTERNATIVE: Simple cron job that uses Edge Function directly
-- This is simpler and more reliable than calling HTTP from within PostgreSQL
-- ============================================================================

-- Create a function that just marks events needing reminders
CREATE OR REPLACE FUNCTION get_events_needing_reminders()
RETURNS TABLE (
  event_id UUID,
  title TEXT,
  event_date DATE,
  start_time TIME,
  location TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    os.id as event_id,
    os.title,
    os.event_date,
    os.start_time,
    COALESCE(v.name, os.custom_location, 'TBD') as location
  FROM open_sessions os
  LEFT JOIN venues v ON v.id = os.venue_id
  WHERE os.status = 'upcoming'
    AND os.event_date = CURRENT_DATE
    AND os.start_time BETWEEN
        (CURRENT_TIME + INTERVAL '55 minutes')
        AND (CURRENT_TIME + INTERVAL '65 minutes');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SCHEDULE THE CRON JOB
-- Runs every 10 minutes to check for events needing reminders
-- ============================================================================

-- First, remove any existing job with the same name (if it exists)
DO $$
BEGIN
  PERFORM cron.unschedule('send-event-reminders');
EXCEPTION WHEN OTHERS THEN
  -- Job doesn't exist yet, that's fine
  NULL;
END $$;

-- Schedule the job to run every 10 minutes
SELECT cron.schedule(
  'send-event-reminders',           -- job name
  '*/10 * * * *',                   -- every 10 minutes
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := (
      SELECT jsonb_build_object(
        'type', 'event_reminder_batch',
        'events', COALESCE(jsonb_agg(jsonb_build_object(
          'eventId', e.event_id,
          'title', e.title,
          'date', to_char(e.event_date, 'Dy, Mon DD'),
          'time', to_char(e.start_time, 'HH12:MI AM'),
          'location', e.location
        )), '[]'::jsonb)
      )
      FROM get_events_needing_reminders() e
    )
  )
  $$
);

-- ============================================================================
-- SIMPLER ALTERNATIVE: Use Supabase Dashboard Cron
-- ============================================================================
-- If pg_cron doesn't work well with HTTP calls, you can:
-- 1. Go to Supabase Dashboard > Database > Extensions > Enable pg_net
-- 2. Go to Supabase Dashboard > Database > Webhooks
-- 3. Create a scheduled webhook that calls your Edge Function every 10 minutes
--
-- Or use an external service like:
-- - Vercel Cron Jobs
-- - GitHub Actions scheduled workflows
-- - Upstash QStash
-- ============================================================================

