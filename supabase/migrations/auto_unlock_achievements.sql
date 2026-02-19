-- Auto-unlock achievements based on player stats
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- 1. Ensure unique constraint on (player_id, achievement_type)
CREATE UNIQUE INDEX IF NOT EXISTS achievements_player_type_unique
  ON achievements (player_id, achievement_type);

-- 2. Function to check and unlock achievements for a given player
CREATE OR REPLACE FUNCTION check_and_unlock_achievements(p_player_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  p players%ROWTYPE;
BEGIN
  SELECT * INTO p FROM players WHERE id = p_player_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- first_game: played at least 1 game
  IF p.games_played >= 1 THEN
    INSERT INTO achievements (player_id, achievement_type, unlocked_at)
    VALUES (p_player_id, 'first_game', now())
    ON CONFLICT (player_id, achievement_type) DO NOTHING;
  END IF;

  -- games_10: played 10 games
  IF p.games_played >= 10 THEN
    INSERT INTO achievements (player_id, achievement_type, unlocked_at)
    VALUES (p_player_id, 'games_10', now())
    ON CONFLICT (player_id, achievement_type) DO NOTHING;
  END IF;

  -- games_50: played 50 games
  IF p.games_played >= 50 THEN
    INSERT INTO achievements (player_id, achievement_type, unlocked_at)
    VALUES (p_player_id, 'games_50', now())
    ON CONFLICT (player_id, achievement_type) DO NOTHING;
  END IF;

  -- games_100: played 100 games
  IF p.games_played >= 100 THEN
    INSERT INTO achievements (player_id, achievement_type, unlocked_at)
    VALUES (p_player_id, 'games_100', now())
    ON CONFLICT (player_id, achievement_type) DO NOTHING;
  END IF;

  -- win_streak_5: won 5 in a row (current or best)
  IF COALESCE(p.win_streak, 0) >= 5 OR COALESCE(p.best_win_streak, 0) >= 5 THEN
    INSERT INTO achievements (player_id, achievement_type, unlocked_at)
    VALUES (p_player_id, 'win_streak_5', now())
    ON CONFLICT (player_id, achievement_type) DO NOTHING;
  END IF;

  -- win_streak_10: won 10 in a row (current or best)
  IF COALESCE(p.win_streak, 0) >= 10 OR COALESCE(p.best_win_streak, 0) >= 10 THEN
    INSERT INTO achievements (player_id, achievement_type, unlocked_at)
    VALUES (p_player_id, 'win_streak_10', now())
    ON CONFLICT (player_id, achievement_type) DO NOTHING;
  END IF;

  -- rating_1600: reached 1600 rating
  IF COALESCE(p.highest_rating, 0) >= 1600 THEN
    INSERT INTO achievements (player_id, achievement_type, unlocked_at)
    VALUES (p_player_id, 'rating_1600', now())
    ON CONFLICT (player_id, achievement_type) DO NOTHING;
  END IF;

  -- rating_1800: reached 1800 rating
  IF COALESCE(p.highest_rating, 0) >= 1800 THEN
    INSERT INTO achievements (player_id, achievement_type, unlocked_at)
    VALUES (p_player_id, 'rating_1800', now())
    ON CONFLICT (player_id, achievement_type) DO NOTHING;
  END IF;
END;
$$;

-- 3. Trigger function that fires after player stats update
CREATE OR REPLACE FUNCTION trigger_check_achievements()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only run when relevant stats columns actually changed
  IF NEW.games_played IS DISTINCT FROM OLD.games_played
     OR NEW.win_streak IS DISTINCT FROM OLD.win_streak
     OR NEW.best_win_streak IS DISTINCT FROM OLD.best_win_streak
     OR NEW.rating IS DISTINCT FROM OLD.rating
     OR NEW.highest_rating IS DISTINCT FROM OLD.highest_rating
  THEN
    PERFORM check_and_unlock_achievements(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Create the trigger (drop first if it already exists)
DROP TRIGGER IF EXISTS trg_check_achievements ON players;
CREATE TRIGGER trg_check_achievements
  AFTER UPDATE ON players
  FOR EACH ROW
  EXECUTE FUNCTION trigger_check_achievements();

-- 5. Backfill: unlock achievements for all existing players with games
DO $$
DECLARE
  pid uuid;
BEGIN
  FOR pid IN SELECT id FROM players WHERE games_played > 0
  LOOP
    PERFORM check_and_unlock_achievements(pid);
  END LOOP;
END;
$$;
