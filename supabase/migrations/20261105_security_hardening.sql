-- Security hardening: stop players from editing their own privileged columns
-- Addresses GitHub issue #1 (SEC-001 / SEC-003).
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query).
--
-- Before this migration the "Users can update own profile" policy allowed ANY
-- authenticated user (including throwaway guest accounts) to run
--   update players set is_admin = true, admin_role = 'super_admin' where id = auth.uid()
-- and every other admin policy keys off players.is_admin.

-- 1. Helper functions (SECURITY DEFINER so they work regardless of RLS)
CREATE OR REPLACE FUNCTION current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM players WHERE id = auth.uid()),
    false
  );
$$;

CREATE OR REPLACE FUNCTION current_user_is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin AND admin_role = 'super_admin' FROM players WHERE id = auth.uid()),
    false
  );
$$;

REVOKE ALL ON FUNCTION current_user_is_admin() FROM public;
REVOKE ALL ON FUNCTION current_user_is_super_admin() FROM public;
GRANT EXECUTE ON FUNCTION current_user_is_admin() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION current_user_is_super_admin() TO authenticated, anon, service_role;

-- 2. Players UPDATE policies: own row, or any row if admin
DROP POLICY IF EXISTS "Users can update own profile" ON players;
DROP POLICY IF EXISTS "Admins can update players" ON players;

CREATE POLICY "Users can update own profile"
  ON players FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update players"
  ON players FOR UPDATE
  USING (current_user_is_admin())
  WITH CHECK (current_user_is_admin());

-- 3. Trigger: privileged columns can only be changed by admins.
--    Role columns (is_admin, admin_role) only by super admins.
--    Requests from the SQL editor / service role (no anon/authenticated JWT) are not restricted.
--    Columns are compared through jsonb so the trigger tolerates columns that do
--    not exist in a given deployment (e.g. ban fields added later).
CREATE OR REPLACE FUNCTION protect_player_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text := COALESCE(auth.jwt() ->> 'role', '');
  caller_is_admin boolean;
  caller_is_super_admin boolean;
  role_cols text[] := ARRAY['is_admin', 'admin_role'];
  stat_cols text[] := ARRAY[
    'rating', 'games_played', 'wins', 'losses', 'win_streak', 'best_win_streak',
    'highest_rating', 'is_banned', 'ban_reason', 'ban_until', 'is_guest',
    'created_at', 'last_played_at'
  ];
  new_j jsonb;
  old_j jsonb;
  col text;
BEGIN
  -- Only enforce for end-user requests coming through PostgREST
  IF jwt_role NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  caller_is_admin := current_user_is_admin();
  caller_is_super_admin := current_user_is_super_admin();

  IF TG_OP = 'INSERT' THEN
    -- Self-registration (signup trigger / guest check-in) always starts unprivileged.
    -- jsonb_populate_record ignores keys that are not real columns.
    IF NOT caller_is_super_admin THEN
      NEW := jsonb_populate_record(NEW, '{"is_admin": false, "admin_role": null}'::jsonb);
    END IF;
    IF NOT caller_is_admin THEN
      NEW := jsonb_populate_record(NEW, '{
        "rating": 1500, "games_played": 0, "wins": 0, "losses": 0,
        "win_streak": 0, "best_win_streak": 0, "highest_rating": null,
        "is_banned": false, "ban_reason": null, "ban_until": null
      }'::jsonb);
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  new_j := to_jsonb(NEW);
  old_j := to_jsonb(OLD);

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Player id cannot be changed'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT caller_is_super_admin THEN
    FOREACH col IN ARRAY role_cols LOOP
      IF (new_j -> col) IS DISTINCT FROM (old_j -> col) THEN
        RAISE EXCEPTION 'Only super admins can change %', col
          USING ERRCODE = 'insufficient_privilege';
      END IF;
    END LOOP;
  END IF;

  IF NOT caller_is_admin THEN
    FOREACH col IN ARRAY stat_cols LOOP
      IF (new_j -> col) IS DISTINCT FROM (old_j -> col) THEN
        RAISE EXCEPTION 'Only admins can change %', col
          USING ERRCODE = 'insufficient_privilege';
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_player_privileged_columns ON players;
CREATE TRIGGER trg_protect_player_privileged_columns
  BEFORE INSERT OR UPDATE ON players
  FOR EACH ROW
  EXECUTE FUNCTION protect_player_privileged_columns();

-- 4. Verification (run as a normal user via the client; both should fail):
--   update players set is_admin = true where id = auth.uid();
--   update players set rating = 9999 where id = auth.uid();
