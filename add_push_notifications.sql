-- Push Notifications Schema for Rally
-- Run this in your Supabase SQL Editor

-- Push subscriptions table to store Web Push subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each endpoint should be unique per player
  UNIQUE(player_id, endpoint)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_player_id ON push_subscriptions(player_id);

-- Notification preferences - add to players table
ALTER TABLE players
ADD COLUMN IF NOT EXISTS push_notifications_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "session_created": true,
  "session_reminder": true,
  "waitlist_update": true,
  "game_results": false
}'::jsonb;

-- Push notification log for tracking sent notifications
CREATE TABLE IF NOT EXISTS push_notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'clicked')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ
);

-- Index for notification logs
CREATE INDEX IF NOT EXISTS idx_push_notification_logs_player_id ON push_notification_logs(player_id);
CREATE INDEX IF NOT EXISTS idx_push_notification_logs_created_at ON push_notification_logs(created_at DESC);

-- RLS Policies
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_notification_logs ENABLE ROW LEVEL SECURITY;

-- Players can manage their own push subscriptions
CREATE POLICY "Players can view own push subscriptions"
  ON push_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = player_id);

CREATE POLICY "Players can insert own push subscriptions"
  ON push_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Players can delete own push subscriptions"
  ON push_subscriptions FOR DELETE
  TO authenticated
  USING (auth.uid() = player_id);

-- Service role can manage all subscriptions (for Edge Functions)
CREATE POLICY "Service role can manage all push subscriptions"
  ON push_subscriptions FOR ALL
  TO service_role
  USING (true);

-- Players can view their own notification logs
CREATE POLICY "Players can view own notification logs"
  ON push_notification_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = player_id);

-- Service role can manage all logs
CREATE POLICY "Service role can manage all notification logs"
  ON push_notification_logs FOR ALL
  TO service_role
  USING (true);

-- Function to get players who should receive a notification type
CREATE OR REPLACE FUNCTION get_push_notification_recipients(notification_type TEXT)
RETURNS TABLE (
  player_id UUID,
  player_name TEXT,
  endpoint TEXT,
  p256dh_key TEXT,
  auth_key TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id as player_id,
    p.name as player_name,
    ps.endpoint,
    ps.p256dh_key,
    ps.auth_key
  FROM players p
  JOIN push_subscriptions ps ON ps.player_id = p.id
  WHERE p.push_notifications_enabled = true
    AND p.is_banned = false
    AND (p.notification_preferences ->> notification_type)::boolean = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get push recipients for a specific session (for reminders)
CREATE OR REPLACE FUNCTION get_session_push_recipients(session_uuid UUID)
RETURNS TABLE (
  player_id UUID,
  player_name TEXT,
  endpoint TEXT,
  p256dh_key TEXT,
  auth_key TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id as player_id,
    p.name as player_name,
    ps.endpoint,
    ps.p256dh_key,
    ps.auth_key
  FROM players p
  JOIN push_subscriptions ps ON ps.player_id = p.id
  JOIN session_checkins sc ON sc.player_id = p.id
  WHERE sc.session_id = session_uuid
    AND p.push_notifications_enabled = true
    AND p.is_banned = false
    AND (p.notification_preferences ->> 'session_reminder')::boolean = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
