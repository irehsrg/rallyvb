-- Add season scheduling fields to tournaments table
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS season_weeks INTEGER;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS games_per_week INTEGER DEFAULT 1;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS schedule_generated BOOLEAN DEFAULT FALSE;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS playoffs_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS auto_seed_playoffs BOOLEAN DEFAULT TRUE;

-- Add time scheduling fields to tournaments
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS game_duration_minutes INTEGER DEFAULT 45;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS first_game_time TIME DEFAULT '18:00';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS last_game_time TIME;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS courts_available INTEGER DEFAULT 2;

-- Add week_number and time to games for season scheduling
ALTER TABLE games ADD COLUMN IF NOT EXISTS week_number INTEGER;
ALTER TABLE games ADD COLUMN IF NOT EXISTS scheduled_date DATE;
ALTER TABLE games ADD COLUMN IF NOT EXISTS scheduled_time TIME;

-- Index for efficient schedule queries
CREATE INDEX IF NOT EXISTS idx_games_tournament_week ON games(tournament_id, week_number);
CREATE INDEX IF NOT EXISTS idx_games_scheduled_date ON games(scheduled_date);

-- Comment for documentation
COMMENT ON COLUMN tournaments.season_weeks IS 'Duration of regular season in weeks';
COMMENT ON COLUMN tournaments.games_per_week IS 'Number of games per team per week';
COMMENT ON COLUMN tournaments.schedule_generated IS 'Whether the season schedule has been generated';
COMMENT ON COLUMN tournaments.playoffs_enabled IS 'Whether to have playoffs after regular season';
COMMENT ON COLUMN tournaments.auto_seed_playoffs IS 'Use season standings for playoff seeding';
COMMENT ON COLUMN tournaments.game_duration_minutes IS 'Duration of each game in minutes';
COMMENT ON COLUMN tournaments.first_game_time IS 'Start time for first game of the day';
COMMENT ON COLUMN tournaments.courts_available IS 'Number of courts for simultaneous games';
COMMENT ON COLUMN games.week_number IS 'Week number in the season schedule';
COMMENT ON COLUMN games.scheduled_date IS 'Scheduled date for the game';
COMMENT ON COLUMN games.scheduled_time IS 'Scheduled time for the game';
