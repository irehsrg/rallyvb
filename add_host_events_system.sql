-- ============================================================================
-- HOST ROLE AND OPEN SESSIONS SCHEMA
-- Rally Volleyball App - Event Feed & Host System
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- Update admin_role CHECK constraint to include 'host'
DO $$
BEGIN
  ALTER TABLE players DROP CONSTRAINT IF EXISTS players_admin_role_check;
  ALTER TABLE players ADD CONSTRAINT players_admin_role_check
    CHECK (admin_role IN ('super_admin', 'location_admin', 'scorekeeper', 'team_manager', 'host'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- OPEN SESSIONS (Events) TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS open_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,

  -- Location
  venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
  custom_location TEXT,
  custom_address TEXT,
  google_maps_url TEXT,

  -- Timing
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME,

  -- Capacity & Requirements
  max_players INTEGER,
  min_players INTEGER DEFAULT 4,
  skill_level TEXT DEFAULT 'all_levels' CHECK (skill_level IN ('all_levels', 'beginner', 'intermediate', 'advanced', 'expert')),

  -- Settings
  is_public BOOLEAN DEFAULT TRUE,
  allow_comments BOOLEAN DEFAULT TRUE,
  rsvp_deadline TIMESTAMPTZ,

  -- Status
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('draft', 'upcoming', 'active', 'completed', 'cancelled')),
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for open_sessions
CREATE INDEX IF NOT EXISTS idx_open_sessions_host ON open_sessions(host_id);
CREATE INDEX IF NOT EXISTS idx_open_sessions_date ON open_sessions(event_date);
CREATE INDEX IF NOT EXISTS idx_open_sessions_status ON open_sessions(status) WHERE status IN ('upcoming', 'active');
CREATE INDEX IF NOT EXISTS idx_open_sessions_public ON open_sessions(is_public) WHERE is_public = TRUE;

-- ============================================================================
-- RSVP SYSTEM
-- ============================================================================

CREATE TABLE IF NOT EXISTS open_session_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES open_sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('going', 'maybe', 'not_going')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_rsvps_session ON open_session_rsvps(session_id);
CREATE INDEX IF NOT EXISTS idx_rsvps_player ON open_session_rsvps(player_id);
CREATE INDEX IF NOT EXISTS idx_rsvps_status ON open_session_rsvps(session_id, status);

-- ============================================================================
-- COMMENTS SYSTEM
-- ============================================================================

CREATE TABLE IF NOT EXISTS open_session_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES open_sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES open_session_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_edited BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_session ON open_session_comments(session_id);
CREATE INDEX IF NOT EXISTS idx_comments_player ON open_session_comments(player_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON open_session_comments(parent_id) WHERE parent_id IS NOT NULL;

-- ============================================================================
-- TOURNAMENT REGISTRATION ENHANCEMENTS (Only if tournaments table exists)
-- ============================================================================

-- Add registration columns to tournaments table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tournaments') THEN
    ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS registration_mode TEXT DEFAULT 'team_only';
    ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS allow_self_registration BOOLEAN DEFAULT FALSE;
    ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS registration_deadline TIMESTAMPTZ;
    ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS min_team_size INTEGER DEFAULT 2;
    ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS max_team_size INTEGER DEFAULT 6;

    -- Add check constraint if not exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.check_constraints
      WHERE constraint_name = 'tournaments_registration_mode_check'
    ) THEN
      ALTER TABLE tournaments ADD CONSTRAINT tournaments_registration_mode_check
        CHECK (registration_mode IN ('team_only', 'individuals_allowed', 'individuals_only'));
    END IF;
  END IF;
END $$;

-- Individual registrations (free agents) - only if tournaments table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tournaments') THEN
    CREATE TABLE IF NOT EXISTS tournament_individual_registrations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'assigned_to_team')),
      assigned_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(tournament_id, player_id)
    );

    CREATE INDEX IF NOT EXISTS idx_individual_regs_tournament ON tournament_individual_registrations(tournament_id);
    CREATE INDEX IF NOT EXISTS idx_individual_regs_player ON tournament_individual_registrations(player_id);
    CREATE INDEX IF NOT EXISTS idx_individual_regs_status ON tournament_individual_registrations(status);

    -- Team registration requests (for self-service)
    CREATE TABLE IF NOT EXISTS tournament_team_registrations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      registered_by UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      roster_snapshot JSONB,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      reviewed_at TIMESTAMPTZ,
      reviewed_by UUID REFERENCES players(id),
      UNIQUE(tournament_id, team_id)
    );

    CREATE INDEX IF NOT EXISTS idx_team_regs_tournament ON tournament_team_registrations(tournament_id);
    CREATE INDEX IF NOT EXISTS idx_team_regs_team ON tournament_team_registrations(team_id);
  END IF;
END $$;

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

ALTER TABLE open_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE open_session_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE open_session_comments ENABLE ROW LEVEL SECURITY;

-- Enable RLS on tournament registration tables if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tournament_individual_registrations') THEN
    ALTER TABLE tournament_individual_registrations ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tournament_team_registrations') THEN
    ALTER TABLE tournament_team_registrations ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Open Sessions: Anyone can view public sessions
CREATE POLICY "Anyone can view public open sessions"
  ON open_sessions FOR SELECT
  USING (is_public = TRUE OR host_id = auth.uid());

-- Open Sessions: Hosts can create sessions
CREATE POLICY "Hosts can create open sessions"
  ON open_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    host_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM players
      WHERE id = auth.uid() AND (admin_role = 'host' OR admin_role = 'super_admin')
    )
  );

-- Open Sessions: Hosts can update their own sessions
CREATE POLICY "Hosts can update own sessions"
  ON open_sessions FOR UPDATE
  TO authenticated
  USING (host_id = auth.uid());

-- Open Sessions: Hosts can delete their own sessions
CREATE POLICY "Hosts can delete own sessions"
  ON open_sessions FOR DELETE
  TO authenticated
  USING (host_id = auth.uid());

-- Super admins can manage all open sessions
CREATE POLICY "Super admins can manage all open sessions"
  ON open_sessions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE id = auth.uid() AND admin_role = 'super_admin'
    )
  );

-- RSVPs: Anyone can view RSVPs
CREATE POLICY "Anyone can view RSVPs"
  ON open_session_rsvps FOR SELECT
  USING (TRUE);

-- RSVPs: Authenticated users can insert their own RSVPs
CREATE POLICY "Users can create own RSVPs"
  ON open_session_rsvps FOR INSERT
  TO authenticated
  WITH CHECK (player_id = auth.uid());

-- RSVPs: Users can update their own RSVPs
CREATE POLICY "Users can update own RSVPs"
  ON open_session_rsvps FOR UPDATE
  TO authenticated
  USING (player_id = auth.uid());

-- RSVPs: Users can delete their own RSVPs
CREATE POLICY "Users can delete own RSVPs"
  ON open_session_rsvps FOR DELETE
  TO authenticated
  USING (player_id = auth.uid());

-- Comments: Anyone can view comments
CREATE POLICY "Anyone can view comments"
  ON open_session_comments FOR SELECT
  USING (TRUE);

-- Comments: Authenticated users can create comments
CREATE POLICY "Users can create comments"
  ON open_session_comments FOR INSERT
  TO authenticated
  WITH CHECK (player_id = auth.uid());

-- Comments: Users can update own comments
CREATE POLICY "Users can update own comments"
  ON open_session_comments FOR UPDATE
  TO authenticated
  USING (player_id = auth.uid());

-- Comments: Users can delete own comments
CREATE POLICY "Users can delete own comments"
  ON open_session_comments FOR DELETE
  TO authenticated
  USING (player_id = auth.uid());

-- Comments: Hosts can delete any comments on their sessions
CREATE POLICY "Hosts can delete comments on own sessions"
  ON open_session_comments FOR DELETE
  TO authenticated
  USING (
    session_id IN (
      SELECT id FROM open_sessions WHERE host_id = auth.uid()
    )
  );

-- Tournament registration policies (only if tables exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tournament_individual_registrations') THEN
    -- Anyone can view individual registrations
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view individual registrations') THEN
      CREATE POLICY "Anyone can view individual registrations"
        ON tournament_individual_registrations FOR SELECT
        USING (TRUE);
    END IF;

    -- Users can register themselves
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can register themselves') THEN
      CREATE POLICY "Users can register themselves"
        ON tournament_individual_registrations FOR INSERT
        TO authenticated
        WITH CHECK (player_id = auth.uid());
    END IF;

    -- Users can withdraw own registration
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can withdraw own registration') THEN
      CREATE POLICY "Users can withdraw own registration"
        ON tournament_individual_registrations FOR DELETE
        TO authenticated
        USING (player_id = auth.uid() AND status = 'pending');
    END IF;

    -- Admins can manage all
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage individual registrations') THEN
      CREATE POLICY "Admins can manage individual registrations"
        ON tournament_individual_registrations FOR ALL
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM players
            WHERE id = auth.uid() AND is_admin = TRUE
          )
        );
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tournament_team_registrations') THEN
    -- Anyone can view team registrations
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view team registrations') THEN
      CREATE POLICY "Anyone can view team registrations"
        ON tournament_team_registrations FOR SELECT
        USING (TRUE);
    END IF;

    -- Team managers can register their teams
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Team managers can register their teams') THEN
      CREATE POLICY "Team managers can register their teams"
        ON tournament_team_registrations FOR INSERT
        TO authenticated
        WITH CHECK (
          registered_by = auth.uid() AND
          team_id IN (
            SELECT team_id FROM team_members
            WHERE player_id = auth.uid() AND role = 'manager' AND is_active = TRUE
          )
        );
    END IF;

    -- Team managers can withdraw
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Team managers can withdraw registration') THEN
      CREATE POLICY "Team managers can withdraw registration"
        ON tournament_team_registrations FOR DELETE
        TO authenticated
        USING (
          status = 'pending' AND
          team_id IN (
            SELECT team_id FROM team_members
            WHERE player_id = auth.uid() AND role = 'manager' AND is_active = TRUE
          )
        );
    END IF;

    -- Admins can manage all
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage team registrations') THEN
      CREATE POLICY "Admins can manage team registrations"
        ON tournament_team_registrations FOR ALL
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM players
            WHERE id = auth.uid() AND is_admin = TRUE
          )
        );
    END IF;
  END IF;
END $$;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get RSVP counts for a session
CREATE OR REPLACE FUNCTION get_rsvp_counts(p_session_id UUID)
RETURNS TABLE (going BIGINT, maybe BIGINT, not_going BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE status = 'going') as going,
    COUNT(*) FILTER (WHERE status = 'maybe') as maybe,
    COUNT(*) FILTER (WHERE status = 'not_going') as not_going
  FROM open_session_rsvps
  WHERE session_id = p_session_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get push recipients for new events
CREATE OR REPLACE FUNCTION get_new_event_push_recipients()
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
    AND (p.notification_preferences ->> 'session_created')::boolean = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
