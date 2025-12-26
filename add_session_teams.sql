-- Session Teams: Persistent teams that stay together throughout a session
-- This supports pickup volleyball formats like King of Court, Round Robin, etc.

-- Add rotation mode to sessions
-- First add the column (if it doesn't exist), then update constraint to include 'speed'
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS rotation_mode TEXT DEFAULT 'manual';

-- Drop old constraint if it exists and add new one with 'speed' option
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_rotation_mode_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_rotation_mode_check
  CHECK (rotation_mode IN ('manual', 'king_of_court', 'round_robin', 'swiss', 'speed'));
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS current_round INTEGER DEFAULT 1;

-- Session teams that persist throughout the session
CREATE TABLE IF NOT EXISTS session_teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL,
  team_number INTEGER NOT NULL,
  color TEXT, -- Optional color for UI display
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, team_number)
);

-- Players assigned to session teams
CREATE TABLE IF NOT EXISTS session_team_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_team_id UUID NOT NULL REFERENCES session_teams(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_team_id, player_id)
);

-- Add round number and team references to games
ALTER TABLE games ADD COLUMN IF NOT EXISTS round_number INTEGER DEFAULT 1;
ALTER TABLE games ADD COLUMN IF NOT EXISTS session_team_a_id UUID REFERENCES session_teams(id) ON DELETE SET NULL;
ALTER TABLE games ADD COLUMN IF NOT EXISTS session_team_b_id UUID REFERENCES session_teams(id) ON DELETE SET NULL;

-- Track which teams have played each other (for round robin / swiss)
CREATE TABLE IF NOT EXISTS session_team_matchups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  team_1_id UUID NOT NULL REFERENCES session_teams(id) ON DELETE CASCADE,
  team_2_id UUID NOT NULL REFERENCES session_teams(id) ON DELETE CASCADE,
  game_id UUID REFERENCES games(id) ON DELETE SET NULL,
  round_number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, team_1_id, team_2_id)
);

-- RLS Policies
ALTER TABLE session_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_team_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_team_matchups ENABLE ROW LEVEL SECURITY;

-- Session teams: anyone can view, admins can modify
CREATE POLICY "Anyone can view session teams"
  ON session_teams FOR SELECT USING (true);

CREATE POLICY "Admins can manage session teams"
  ON session_teams FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM players WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Session team players: anyone can view, admins can modify
CREATE POLICY "Anyone can view session team players"
  ON session_team_players FOR SELECT USING (true);

CREATE POLICY "Admins can manage session team players"
  ON session_team_players FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM players WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Session team matchups: anyone can view, admins can modify
CREATE POLICY "Anyone can view matchups"
  ON session_team_matchups FOR SELECT USING (true);

CREATE POLICY "Admins can manage matchups"
  ON session_team_matchups FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM players WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_session_teams_session ON session_teams(session_id);
CREATE INDEX IF NOT EXISTS idx_session_team_players_team ON session_team_players(session_team_id);
CREATE INDEX IF NOT EXISTS idx_session_team_players_player ON session_team_players(player_id);
CREATE INDEX IF NOT EXISTS idx_games_round ON games(session_id, round_number);
CREATE INDEX IF NOT EXISTS idx_matchups_session ON session_team_matchups(session_id);
