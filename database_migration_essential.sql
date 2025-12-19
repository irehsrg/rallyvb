-- Essential migrations - only creates what doesn't exist
-- Safe to run multiple times due to IF NOT EXISTS clauses

-- ============================================
-- ADD MISSING COLUMNS TO EXISTING TABLES
-- ============================================

-- Add missing columns to sessions (you already did location_name)
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS max_players INTEGER,
ADD COLUMN IF NOT EXISTS checkin_deadline TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS recurrence_pattern TEXT CHECK (recurrence_pattern IN ('weekly', 'biweekly', 'monthly')),
ADD COLUMN IF NOT EXISTS recurrence_day INTEGER CHECK (recurrence_day BETWEEN 0 AND 6),
ADD COLUMN IF NOT EXISTS template_name TEXT,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Add missing columns to players
ALTER TABLE players
ADD COLUMN IF NOT EXISTS profile_photo_url TEXT,
ADD COLUMN IF NOT EXISTS highest_rating INTEGER DEFAULT 1500,
ADD COLUMN IF NOT EXISTS admin_role TEXT CHECK (admin_role IN ('super_admin', 'location_admin', 'scorekeeper')),
ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ban_reason TEXT,
ADD COLUMN IF NOT EXISTS ban_until TIMESTAMP WITH TIME ZONE;

-- Update highest_rating for existing players
UPDATE players SET highest_rating = rating WHERE highest_rating IS NULL OR highest_rating < rating;

-- ============================================
-- CREATE NEW TABLES
-- ============================================

-- Admin Activity Log (REQUIRED for activity logging!)
CREATE TABLE IF NOT EXISTS admin_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Waitlist (REQUIRED for waitlist feature!)
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  preferred_position TEXT,
  notified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, player_id)
);

-- Feedback Reports (REQUIRED for feedback feature!)
CREATE TABLE IF NOT EXISTS feedback_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('bug', 'feature', 'general')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Endorsements (REQUIRED for endorsement feature!)
CREATE TABLE IF NOT EXISTS endorsements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  to_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  endorsement_type TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (from_player_id != to_player_id)
);

-- Player Relationships (REQUIRED for favorites/avoid lists!)
CREATE TABLE IF NOT EXISTS player_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  related_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('favorite', 'avoid')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(player_id, related_player_id, relationship_type),
  CHECK (player_id != related_player_id)
);

-- Achievements
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  achievement_type TEXT NOT NULL,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  progress INTEGER DEFAULT 0,
  UNIQUE(player_id, achievement_type)
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

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_admin_activity_log_admin ON admin_activity_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_created ON admin_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_waitlist_session ON waitlist(session_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_player ON waitlist(player_id);
CREATE INDEX IF NOT EXISTS idx_endorsements_to_player ON endorsements(to_player_id);
CREATE INDEX IF NOT EXISTS idx_endorsements_from_player ON endorsements(from_player_id);
CREATE INDEX IF NOT EXISTS idx_player_relationships_player ON player_relationships(player_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback_reports(status);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on new tables
ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE endorsements ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_templates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to allow re-running script)
DROP POLICY IF EXISTS "Admins can view all activity logs" ON admin_activity_log;
DROP POLICY IF EXISTS "Admins can insert activity logs" ON admin_activity_log;
DROP POLICY IF EXISTS "Anyone can view waitlist" ON waitlist;
DROP POLICY IF EXISTS "Players can add themselves to waitlist" ON waitlist;
DROP POLICY IF EXISTS "Admins can manage waitlist" ON waitlist;
DROP POLICY IF EXISTS "Players can view their own feedback" ON feedback_reports;
DROP POLICY IF EXISTS "Anyone can submit feedback" ON feedback_reports;
DROP POLICY IF EXISTS "Admins can view all feedback" ON feedback_reports;
DROP POLICY IF EXISTS "Anyone can view endorsements" ON endorsements;
DROP POLICY IF EXISTS "Players can give endorsements" ON endorsements;
DROP POLICY IF EXISTS "Players can view their own relationships" ON player_relationships;
DROP POLICY IF EXISTS "Players can manage their own relationships" ON player_relationships;
DROP POLICY IF EXISTS "Anyone can view achievements" ON achievements;
DROP POLICY IF EXISTS "System can manage achievements" ON achievements;
DROP POLICY IF EXISTS "Admins can manage templates" ON session_templates;

-- Admin Activity Log Policies
CREATE POLICY "Admins can view all activity logs"
  ON admin_activity_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM players WHERE players.id = auth.uid() AND players.is_admin = true
    )
  );

CREATE POLICY "Admins can insert activity logs"
  ON admin_activity_log FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players WHERE players.id = auth.uid() AND players.is_admin = true
    )
  );

-- Waitlist Policies
CREATE POLICY "Anyone can view waitlist"
  ON waitlist FOR SELECT
  USING (true);

CREATE POLICY "Players can add themselves to waitlist"
  ON waitlist FOR INSERT
  WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Admins can manage waitlist"
  ON waitlist FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM players WHERE players.id = auth.uid() AND players.is_admin = true
    )
  );

-- Feedback Reports Policies
CREATE POLICY "Players can view their own feedback"
  ON feedback_reports FOR SELECT
  USING (auth.uid() = player_id OR player_id IS NULL);

CREATE POLICY "Anyone can submit feedback"
  ON feedback_reports FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all feedback"
  ON feedback_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM players WHERE players.id = auth.uid() AND players.is_admin = true
    )
  );

-- Endorsements Policies
CREATE POLICY "Anyone can view endorsements"
  ON endorsements FOR SELECT
  USING (true);

CREATE POLICY "Players can give endorsements"
  ON endorsements FOR INSERT
  WITH CHECK (auth.uid() = from_player_id);

-- Player Relationships Policies
CREATE POLICY "Players can view their own relationships"
  ON player_relationships FOR SELECT
  USING (auth.uid() = player_id);

CREATE POLICY "Players can manage their own relationships"
  ON player_relationships FOR ALL
  USING (auth.uid() = player_id)
  WITH CHECK (auth.uid() = player_id);

-- Achievements Policies
CREATE POLICY "Anyone can view achievements"
  ON achievements FOR SELECT
  USING (true);

CREATE POLICY "System can manage achievements"
  ON achievements FOR ALL
  USING (true)
  WITH CHECK (true);

-- Session Templates Policies
CREATE POLICY "Admins can manage templates"
  ON session_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM players WHERE players.id = auth.uid() AND players.is_admin = true
    )
  );
