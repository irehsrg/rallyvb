-- Rally App Database Migration V2
-- Run this in Supabase SQL Editor to add new features

-- ============================================
-- PLAYER TABLE UPDATES
-- ============================================

-- Add new player fields
ALTER TABLE players
ADD COLUMN IF NOT EXISTS position TEXT CHECK (position IN ('setter', 'outside', 'middle', 'opposite', 'libero', 'any')),
ADD COLUMN IF NOT EXISTS skill_level TEXT CHECK (skill_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS profile_photo_url TEXT,
ADD COLUMN IF NOT EXISTS highest_rating INTEGER DEFAULT 1500,
ADD COLUMN IF NOT EXISTS admin_role TEXT CHECK (admin_role IN ('super_admin', 'location_admin', 'scorekeeper')),
ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ban_reason TEXT,
ADD COLUMN IF NOT EXISTS ban_until TIMESTAMP WITH TIME ZONE;

-- Update highest_rating for existing players
UPDATE players SET highest_rating = rating WHERE highest_rating IS NULL OR highest_rating < rating;

-- ============================================
-- SESSION TABLE UPDATES
-- ============================================

-- Add new session fields
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS location_name TEXT,
ADD COLUMN IF NOT EXISTS max_players INTEGER,
ADD COLUMN IF NOT EXISTS checkin_deadline TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS recurrence_pattern TEXT CHECK (recurrence_pattern IN ('weekly', 'biweekly', 'monthly')),
ADD COLUMN IF NOT EXISTS recurrence_day INTEGER CHECK (recurrence_day BETWEEN 0 AND 6),
ADD COLUMN IF NOT EXISTS template_name TEXT,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Update status check to include 'cancelled'
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_status_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_status_check
  CHECK (status IN ('setup', 'active', 'completed', 'cancelled'));

-- ============================================
-- NEW TABLES
-- ============================================

-- Achievements
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  achievement_type TEXT NOT NULL,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  progress INTEGER DEFAULT 0,
  UNIQUE(player_id, achievement_type)
);

-- Endorsements
CREATE TABLE IF NOT EXISTS endorsements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  to_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  endorsement_type TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (from_player_id != to_player_id)
);

-- Player Relationships (Favorites/Avoid)
CREATE TABLE IF NOT EXISTS player_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  related_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('favorite', 'avoid')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(player_id, related_player_id, relationship_type),
  CHECK (player_id != related_player_id)
);

-- Waitlist
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notified BOOLEAN DEFAULT FALSE,
  UNIQUE(session_id, player_id)
);

-- Admin Activity Log
CREATE TABLE IF NOT EXISTS admin_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Session Templates
CREATE TABLE IF NOT EXISTS session_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  court_count INTEGER NOT NULL,
  location_name TEXT,
  max_players INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dispute Reports
CREATE TABLE IF NOT EXISTS dispute_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'rejected')),
  resolved_by UUID REFERENCES players(id),
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Feedback Reports
CREATE TABLE IF NOT EXISTS feedback_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('bug', 'feature', 'issue', 'other')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_achievements_player_id ON achievements(player_id);
CREATE INDEX IF NOT EXISTS idx_endorsements_to_player ON endorsements(to_player_id);
CREATE INDEX IF NOT EXISTS idx_endorsements_from_player ON endorsements(from_player_id);
CREATE INDEX IF NOT EXISTS idx_player_relationships_player ON player_relationships(player_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_session ON waitlist(session_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_admin ON admin_activity_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_entity ON admin_activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_session_templates_admin ON session_templates(admin_id);
CREATE INDEX IF NOT EXISTS idx_dispute_reports_game ON dispute_reports(game_id);
CREATE INDEX IF NOT EXISTS idx_dispute_reports_status ON dispute_reports(status);
CREATE INDEX IF NOT EXISTS idx_feedback_reports_status ON feedback_reports(status);

-- ============================================
-- RLS POLICIES
-- ============================================

-- Achievements (players can view all, system creates them)
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view achievements"
  ON achievements FOR SELECT
  USING (true);

CREATE POLICY "Only system can create achievements"
  ON achievements FOR INSERT
  WITH CHECK (false); -- Will be created via admin/system functions

-- Endorsements (anyone can endorse, view all)
ALTER TABLE endorsements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view endorsements"
  ON endorsements FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create endorsements"
  ON endorsements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = from_player_id);

-- Player Relationships (private - only owner can view/modify)
ALTER TABLE player_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own relationships"
  ON player_relationships FOR SELECT
  TO authenticated
  USING (auth.uid() = player_id);

CREATE POLICY "Users can manage their own relationships"
  ON player_relationships FOR ALL
  TO authenticated
  USING (auth.uid() = player_id)
  WITH CHECK (auth.uid() = player_id);

-- Waitlist (anyone can view, authenticated can join)
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view waitlist"
  ON waitlist FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can join waitlist"
  ON waitlist FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Users can remove themselves from waitlist"
  ON waitlist FOR DELETE
  TO authenticated
  USING (auth.uid() = player_id);

-- Admin Activity Log (only admins can view)
ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view activity log"
  ON admin_activity_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.id = auth.uid()
      AND players.is_admin = true
    )
  );

-- Session Templates (owner and admins can manage)
ALTER TABLE session_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all templates"
  ON session_templates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.id = auth.uid()
      AND players.is_admin = true
    )
  );

CREATE POLICY "Admins can create templates"
  ON session_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = admin_id
    AND EXISTS (
      SELECT 1 FROM players
      WHERE players.id = auth.uid()
      AND players.is_admin = true
    )
  );

CREATE POLICY "Owner can update their templates"
  ON session_templates FOR UPDATE
  TO authenticated
  USING (auth.uid() = admin_id)
  WITH CHECK (auth.uid() = admin_id);

CREATE POLICY "Owner can delete their templates"
  ON session_templates FOR DELETE
  TO authenticated
  USING (auth.uid() = admin_id);

-- Dispute Reports (anyone can view, reporters can create)
ALTER TABLE dispute_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view dispute reports"
  ON dispute_reports FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create dispute reports"
  ON dispute_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Admins can update dispute reports"
  ON dispute_reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.id = auth.uid()
      AND players.is_admin = true
    )
  );

-- Feedback Reports (anyone can create, admins can view all)
ALTER TABLE feedback_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own feedback"
  ON feedback_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = player_id OR player_id IS NULL);

CREATE POLICY "Admins can view all feedback"
  ON feedback_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.id = auth.uid()
      AND players.is_admin = true
    )
  );

CREATE POLICY "Anyone can create feedback"
  ON feedback_reports FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can update feedback status"
  ON feedback_reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.id = auth.uid()
      AND players.is_admin = true
    )
  );

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to check and award achievements
CREATE OR REPLACE FUNCTION check_and_award_achievements()
RETURNS TRIGGER AS $$
DECLARE
  player_record RECORD;
BEGIN
  -- Get updated player stats
  SELECT * INTO player_record FROM players WHERE id = NEW.id;

  -- First game
  IF player_record.games_played = 1 THEN
    INSERT INTO achievements (player_id, achievement_type)
    VALUES (NEW.id, 'first_game')
    ON CONFLICT (player_id, achievement_type) DO NOTHING;
  END IF;

  -- Games milestones
  IF player_record.games_played = 10 THEN
    INSERT INTO achievements (player_id, achievement_type)
    VALUES (NEW.id, 'games_10')
    ON CONFLICT (player_id, achievement_type) DO NOTHING;
  END IF;

  IF player_record.games_played = 50 THEN
    INSERT INTO achievements (player_id, achievement_type)
    VALUES (NEW.id, 'games_50')
    ON CONFLICT (player_id, achievement_type) DO NOTHING;
  END IF;

  IF player_record.games_played = 100 THEN
    INSERT INTO achievements (player_id, achievement_type)
    VALUES (NEW.id, 'games_100')
    ON CONFLICT (player_id, achievement_type) DO NOTHING;
  END IF;

  -- Win streaks
  IF player_record.win_streak = 5 THEN
    INSERT INTO achievements (player_id, achievement_type)
    VALUES (NEW.id, 'win_streak_5')
    ON CONFLICT (player_id, achievement_type) DO NOTHING;
  END IF;

  IF player_record.win_streak = 10 THEN
    INSERT INTO achievements (player_id, achievement_type)
    VALUES (NEW.id, 'win_streak_10')
    ON CONFLICT (player_id, achievement_type) DO NOTHING;
  END IF;

  -- Rating milestones
  IF player_record.rating >= 1600 AND (OLD.rating IS NULL OR OLD.rating < 1600) THEN
    INSERT INTO achievements (player_id, achievement_type)
    VALUES (NEW.id, 'rating_1600')
    ON CONFLICT (player_id, achievement_type) DO NOTHING;
  END IF;

  IF player_record.rating >= 1800 AND (OLD.rating IS NULL OR OLD.rating < 1800) THEN
    INSERT INTO achievements (player_id, achievement_type)
    VALUES (NEW.id, 'rating_1800')
    ON CONFLICT (player_id, achievement_type) DO NOTHING;
  END IF;

  -- Update highest rating
  IF player_record.rating > player_record.highest_rating THEN
    UPDATE players SET highest_rating = player_record.rating WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to check achievements after player stats update
DROP TRIGGER IF EXISTS trigger_check_achievements ON players;
CREATE TRIGGER trigger_check_achievements
  AFTER UPDATE ON players
  FOR EACH ROW
  EXECUTE FUNCTION check_and_award_achievements();

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Display summary
DO $$
BEGIN
  RAISE NOTICE '✅ Migration V2 Complete!';
  RAISE NOTICE 'Added new player fields: position, skill_level, bio, profile_photo_url, highest_rating, admin_role, ban fields';
  RAISE NOTICE 'Added new session fields: max_players, checkin_deadline, notes, recurring fields, cancellation fields';
  RAISE NOTICE 'Created new tables: achievements, endorsements, player_relationships, waitlist, admin_activity_log, session_templates, dispute_reports, feedback_reports';
  RAISE NOTICE 'Added RLS policies for all new tables';
  RAISE NOTICE 'Created achievement auto-award system';
END $$;
