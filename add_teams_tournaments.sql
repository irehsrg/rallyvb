-- Teams and Tournaments System Migration
-- Adds support for persistent teams, tournaments, and enhanced match formats

-- ============================================================================
-- TEAMS TABLES
-- ============================================================================

-- Teams: Persistent team entities with identity
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  created_by UUID REFERENCES players(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  -- Team stats (calculated)
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  tournaments_played INTEGER DEFAULT 0
);

-- Team Members: Roster management with roles
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('manager', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(team_id, player_id)
);

-- Indexes for teams
CREATE INDEX IF NOT EXISTS idx_teams_active ON teams(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_team_members_player ON team_members(player_id);

-- ============================================================================
-- TOURNAMENTS TABLES
-- ============================================================================

-- Tournaments: Competitive events with brackets/rounds
CREATE TABLE IF NOT EXISTS tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  format TEXT NOT NULL CHECK (format IN ('single_elimination', 'double_elimination', 'round_robin')),
  best_of INTEGER NOT NULL CHECK (best_of IN (1, 3, 5, 7)),
  status TEXT NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'active', 'completed', 'cancelled')),
  start_date DATE NOT NULL,
  end_date DATE,
  venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
  created_by UUID REFERENCES players(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  -- Tournament settings
  max_teams INTEGER,
  points_to_win INTEGER DEFAULT 25,
  deciding_set_points INTEGER DEFAULT 15,
  min_point_difference INTEGER DEFAULT 2
);

-- Tournament Teams: Which teams are in which tournaments
CREATE TABLE IF NOT EXISTS tournament_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE NOT NULL,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  seed INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'eliminated', 'champion', 'runner_up')),
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tournament_id, team_id),
  UNIQUE(tournament_id, seed)
);

-- Indexes for tournaments
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_date ON tournaments(start_date DESC);
CREATE INDEX IF NOT EXISTS idx_tournament_teams_tournament ON tournament_teams(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_teams_team ON tournament_teams(team_id);

-- ============================================================================
-- EXTEND GAMES TABLE FOR TOURNAMENT SUPPORT
-- ============================================================================

-- Add tournament support columns to existing games table
ALTER TABLE games
ADD COLUMN IF NOT EXISTS tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS match_round TEXT, -- 'round_of_16', 'quarterfinals', 'semifinals', 'finals', etc.
ADD COLUMN IF NOT EXISTS set_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS set_scores JSONB, -- Array of set scores: [{"team_a": 25, "team_b": 23}, ...]
ADD COLUMN IF NOT EXISTS match_winner TEXT CHECK (match_winner IN ('A', 'B')), -- Winner of overall match (best of X)
ADD COLUMN IF NOT EXISTS team_a_id UUID REFERENCES teams(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS team_b_id UUID REFERENCES teams(id) ON DELETE SET NULL;

-- Add indexes for tournament games
CREATE INDEX IF NOT EXISTS idx_games_tournament ON games(tournament_id) WHERE tournament_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_games_team_a ON games(team_a_id) WHERE team_a_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_games_team_b ON games(team_b_id) WHERE team_b_id IS NOT NULL;

-- ============================================================================
-- EXTEND PLAYERS TABLE FOR TEAM MANAGEMENT
-- ============================================================================

-- Add team manager role support (admin_role already exists from previous migration)
-- Just ensure the CHECK constraint allows 'team_manager'
DO $$
BEGIN
  -- Drop existing constraint if it exists
  ALTER TABLE players DROP CONSTRAINT IF EXISTS players_admin_role_check;

  -- Add new constraint with team_manager included
  ALTER TABLE players ADD CONSTRAINT players_admin_role_check
    CHECK (admin_role IN ('super_admin', 'location_admin', 'scorekeeper', 'team_manager'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- TEAM STATISTICS VIEW
-- ============================================================================

-- View for aggregated team statistics
CREATE OR REPLACE VIEW team_statistics AS
SELECT
  t.id AS team_id,
  t.name AS team_name,
  COUNT(DISTINCT tm.player_id) FILTER (WHERE tm.is_active = TRUE) AS active_members,
  COUNT(DISTINCT tt.tournament_id) AS tournaments_entered,
  SUM(CASE WHEN g.team_a_id = t.id AND g.match_winner = 'A' THEN 1
           WHEN g.team_b_id = t.id AND g.match_winner = 'B' THEN 1
           ELSE 0 END) AS total_match_wins,
  SUM(CASE WHEN (g.team_a_id = t.id OR g.team_b_id = t.id) AND g.match_winner IS NOT NULL THEN 1
           ELSE 0 END) AS total_matches_played,
  CASE
    WHEN SUM(CASE WHEN (g.team_a_id = t.id OR g.team_b_id = t.id) AND g.match_winner IS NOT NULL THEN 1 ELSE 0 END) > 0
    THEN ROUND(
      (SUM(CASE WHEN g.team_a_id = t.id AND g.match_winner = 'A' THEN 1
                WHEN g.team_b_id = t.id AND g.match_winner = 'B' THEN 1
                ELSE 0 END)::NUMERIC /
       SUM(CASE WHEN (g.team_a_id = t.id OR g.team_b_id = t.id) AND g.match_winner IS NOT NULL THEN 1 ELSE 0 END)::NUMERIC) * 100, 1
    )
    ELSE 0
  END AS win_percentage
FROM teams t
LEFT JOIN team_members tm ON t.id = tm.team_id
LEFT JOIN tournament_teams tt ON t.id = tt.team_id
LEFT JOIN games g ON (g.team_a_id = t.id OR g.team_b_id = t.id) AND g.tournament_id IS NOT NULL
GROUP BY t.id, t.name;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_teams ENABLE ROW LEVEL SECURITY;

-- Teams: Everyone can view active teams
CREATE POLICY "Anyone can view active teams"
  ON teams FOR SELECT
  USING (is_active = TRUE);

-- Teams: Authenticated users can create teams
CREATE POLICY "Authenticated users can create teams"
  ON teams FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Teams: Team managers can update their teams
CREATE POLICY "Team managers can update their teams"
  ON teams FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT team_id FROM team_members
      WHERE player_id = auth.uid() AND role = 'manager' AND is_active = TRUE
    )
  );

-- Team Members: Everyone can view active members
CREATE POLICY "Anyone can view team members"
  ON team_members FOR SELECT
  USING (TRUE);

-- Team Members: Managers can manage their team roster
CREATE POLICY "Team managers can manage roster"
  ON team_members FOR ALL
  TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE player_id = auth.uid() AND role = 'manager' AND is_active = TRUE
    )
  );

-- Tournaments: Everyone can view tournaments
CREATE POLICY "Anyone can view tournaments"
  ON tournaments FOR SELECT
  USING (TRUE);

-- Tournaments: Super admins can manage tournaments
CREATE POLICY "Super admins can manage tournaments"
  ON tournaments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE id = auth.uid() AND admin_role = 'super_admin'
    )
  );

-- Tournament Teams: Everyone can view
CREATE POLICY "Anyone can view tournament teams"
  ON tournament_teams FOR SELECT
  USING (TRUE);

-- Tournament Teams: Team managers can register their teams
CREATE POLICY "Team managers can register teams"
  ON tournament_teams FOR INSERT
  TO authenticated
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE player_id = auth.uid() AND role = 'manager' AND is_active = TRUE
    )
  );

-- Tournament Teams: Admins can manage all registrations
CREATE POLICY "Admins can manage tournament teams"
  ON tournament_teams FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update team statistics
CREATE OR REPLACE FUNCTION update_team_stats(p_team_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE teams
  SET
    wins = (
      SELECT COUNT(*) FROM games
      WHERE (team_a_id = p_team_id AND match_winner = 'A')
         OR (team_b_id = p_team_id AND match_winner = 'B')
    ),
    losses = (
      SELECT COUNT(*) FROM games
      WHERE ((team_a_id = p_team_id AND match_winner = 'B')
         OR (team_b_id = p_team_id AND match_winner = 'A'))
         AND match_winner IS NOT NULL
    ),
    tournaments_played = (
      SELECT COUNT(DISTINCT tournament_id)
      FROM tournament_teams
      WHERE team_id = p_team_id
    ),
    updated_at = NOW()
  WHERE id = p_team_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update team stats when games are completed
CREATE OR REPLACE FUNCTION trigger_update_team_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.match_winner IS NOT NULL THEN
    IF NEW.team_a_id IS NOT NULL THEN
      PERFORM update_team_stats(NEW.team_a_id);
    END IF;
    IF NEW.team_b_id IS NOT NULL THEN
      PERFORM update_team_stats(NEW.team_b_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_team_stats_on_game_complete
  AFTER INSERT OR UPDATE OF match_winner ON games
  FOR EACH ROW
  WHEN (NEW.team_a_id IS NOT NULL OR NEW.team_b_id IS NOT NULL)
  EXECUTE FUNCTION trigger_update_team_stats();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE teams IS 'Persistent team entities with rosters and statistics';
COMMENT ON TABLE team_members IS 'Team roster with manager/member roles';
COMMENT ON TABLE tournaments IS 'Competitive tournaments with various formats';
COMMENT ON TABLE tournament_teams IS 'Teams registered for specific tournaments';
COMMENT ON COLUMN games.tournament_id IS 'Links game to tournament (NULL for pickup games)';
COMMENT ON COLUMN games.set_scores IS 'JSON array of set scores for best-of-X matches';
COMMENT ON COLUMN games.match_winner IS 'Overall match winner (different from set winner)';
