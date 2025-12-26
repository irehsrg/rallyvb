-- Multi-Venue Support Migration
-- Adds player venue follows and admin venue assignments
-- Run this in Supabase SQL Editor

-- ============================================
-- PLAYER VENUE FOLLOWS TABLE
-- ============================================
-- Tracks which venues a player follows (explicit) or has played at (auto)

CREATE TABLE IF NOT EXISTS player_venue_follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  follow_type TEXT NOT NULL CHECK (follow_type IN ('explicit', 'auto')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(player_id, venue_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_player_venue_follows_player ON player_venue_follows(player_id);
CREATE INDEX IF NOT EXISTS idx_player_venue_follows_venue ON player_venue_follows(venue_id);

-- ============================================
-- ADMIN VENUE ASSIGNMENTS TABLE
-- ============================================
-- Scopes location_admins to specific venues (super_admins see all)

CREATE TABLE IF NOT EXISTS admin_venue_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES players(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(admin_id, venue_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_venue_assignments_admin ON admin_venue_assignments(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_venue_assignments_venue ON admin_venue_assignments(venue_id);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on player_venue_follows
ALTER TABLE player_venue_follows ENABLE ROW LEVEL SECURITY;

-- Anyone can view venue follows (for leaderboard filtering)
CREATE POLICY "anyone_can_view_venue_follows"
  ON player_venue_follows FOR SELECT
  USING (true);

-- Users can insert their own follows
CREATE POLICY "users_can_insert_own_follows"
  ON player_venue_follows FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = player_id);

-- Users can delete their own explicit follows
CREATE POLICY "users_can_delete_own_follows"
  ON player_venue_follows FOR DELETE
  TO authenticated
  USING (auth.uid() = player_id AND follow_type = 'explicit');

-- Admins can manage all follows (for auto-follows on checkin)
CREATE POLICY "admins_can_manage_follows"
  ON player_venue_follows FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND is_admin = true));

-- Enable RLS on admin_venue_assignments
ALTER TABLE admin_venue_assignments ENABLE ROW LEVEL SECURITY;

-- Admins can view their own assignments
CREATE POLICY "admins_can_view_own_assignments"
  ON admin_venue_assignments FOR SELECT
  TO authenticated
  USING (
    admin_id = auth.uid()
    OR EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND admin_role = 'super_admin')
  );

-- Super admins can manage all assignments
CREATE POLICY "super_admins_can_manage_assignments"
  ON admin_venue_assignments FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND admin_role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND admin_role = 'super_admin'));

-- ============================================
-- AUTO-FOLLOW TRIGGER
-- ============================================
-- Automatically creates an 'auto' follow when a player checks into a session at a venue

CREATE OR REPLACE FUNCTION auto_follow_venue_on_checkin()
RETURNS TRIGGER AS $$
DECLARE
  session_venue_id UUID;
BEGIN
  -- Get the venue_id for this session
  SELECT venue_id INTO session_venue_id
  FROM sessions
  WHERE id = NEW.session_id;

  -- If the session has a venue, create an auto-follow (if not already following)
  IF session_venue_id IS NOT NULL THEN
    INSERT INTO player_venue_follows (player_id, venue_id, follow_type)
    VALUES (NEW.player_id, session_venue_id, 'auto')
    ON CONFLICT (player_id, venue_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_auto_follow_venue ON session_checkins;

-- Create trigger on session_checkins
CREATE TRIGGER trigger_auto_follow_venue
  AFTER INSERT ON session_checkins
  FOR EACH ROW
  EXECUTE FUNCTION auto_follow_venue_on_checkin();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get venues a player follows (both explicit and auto)
CREATE OR REPLACE FUNCTION get_player_venues(p_player_id UUID)
RETURNS TABLE (
  venue_id UUID,
  venue_name TEXT,
  follow_type TEXT,
  followed_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id,
    v.name,
    pvf.follow_type,
    pvf.created_at
  FROM player_venue_follows pvf
  JOIN venues v ON v.id = pvf.venue_id
  WHERE pvf.player_id = p_player_id
    AND v.is_active = true
  ORDER BY pvf.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get venues assigned to an admin (returns all for super_admin)
CREATE OR REPLACE FUNCTION get_admin_venues(p_admin_id UUID)
RETURNS TABLE (
  venue_id UUID,
  venue_name TEXT,
  assigned_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  admin_role TEXT;
BEGIN
  -- Get the admin's role
  SELECT players.admin_role INTO admin_role
  FROM players
  WHERE id = p_admin_id;

  -- Super admins get all active venues
  IF admin_role = 'super_admin' THEN
    RETURN QUERY
    SELECT v.id, v.name, v.created_at
    FROM venues v
    WHERE v.is_active = true
    ORDER BY v.name;
  ELSE
    -- Other admins get only assigned venues
    RETURN QUERY
    SELECT v.id, v.name, ava.created_at
    FROM admin_venue_assignments ava
    JOIN venues v ON v.id = ava.venue_id
    WHERE ava.admin_id = p_admin_id
      AND v.is_active = true
    ORDER BY v.name;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if admin can access a specific venue
CREATE OR REPLACE FUNCTION admin_can_access_venue(p_admin_id UUID, p_venue_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  admin_role TEXT;
BEGIN
  -- Get the admin's role
  SELECT players.admin_role INTO admin_role
  FROM players
  WHERE id = p_admin_id;

  -- Super admins can access all venues
  IF admin_role = 'super_admin' THEN
    RETURN true;
  END IF;

  -- Check if admin is assigned to this venue
  RETURN EXISTS (
    SELECT 1 FROM admin_venue_assignments
    WHERE admin_id = p_admin_id AND venue_id = p_venue_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- VENUE-SPECIFIC LEADERBOARD VIEW
-- ============================================
-- Get players who have played at a specific venue, ranked by rating

CREATE OR REPLACE FUNCTION get_venue_leaderboard(p_venue_id UUID)
RETURNS TABLE (
  player_id UUID,
  player_name TEXT,
  rating INTEGER,
  games_played INTEGER,
  wins INTEGER,
  losses INTEGER,
  win_streak INTEGER,
  profile_photo_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    p.id,
    p.name,
    p.rating,
    p.games_played,
    p.wins,
    p.losses,
    p.win_streak,
    p.profile_photo_url
  FROM players p
  JOIN player_venue_follows pvf ON pvf.player_id = p.id
  WHERE pvf.venue_id = p_venue_id
    AND p.is_guest = false
  ORDER BY p.rating DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- VERIFICATION
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'player_venue_follows') THEN
    RAISE NOTICE 'SUCCESS: player_venue_follows table created';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_venue_assignments') THEN
    RAISE NOTICE 'SUCCESS: admin_venue_assignments table created';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_auto_follow_venue') THEN
    RAISE NOTICE 'SUCCESS: auto_follow_venue trigger created';
  END IF;
END $$;
