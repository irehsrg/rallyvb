-- Add is_guest flag to players table to exclude them from leaderboards
ALTER TABLE players
ADD COLUMN IF NOT EXISTS is_guest BOOLEAN DEFAULT FALSE;

-- Mark existing guest players (those with "(Guest)" in their name)
UPDATE players
SET is_guest = TRUE
WHERE name LIKE '%(Guest)%';

-- Create venues/locations table for managed location list
CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  google_maps_url TEXT,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Add RLS policies for venues
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active venues" ON venues;
CREATE POLICY "anyone_can_view_active_venues"
  ON venues
  FOR SELECT
  TO authenticated, anon
  USING (is_active = TRUE);

DROP POLICY IF EXISTS "Admins can manage venues" ON venues;
CREATE POLICY "admins_can_manage_venues"
  ON venues
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Add venue_id to sessions table
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES venues(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_venues_active ON venues(is_active);
CREATE INDEX IF NOT EXISTS idx_sessions_venue_id ON sessions(venue_id);
CREATE INDEX IF NOT EXISTS idx_players_is_guest ON players(is_guest);

-- Add comments
COMMENT ON COLUMN players.is_guest IS 'TRUE for temporary guest players who should not appear in leaderboards';
COMMENT ON TABLE venues IS 'Managed list of venues/locations where sessions can be held';
COMMENT ON COLUMN sessions.venue_id IS 'Reference to managed venue (replaces free-text location_name)';
