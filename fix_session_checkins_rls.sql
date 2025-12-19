-- Fix RLS policies for session_checkins to allow guest check-ins

-- Drop potentially conflicting policies
DROP POLICY IF EXISTS "Anyone can check into sessions" ON session_checkins;
DROP POLICY IF EXISTS "Players can check themselves in" ON session_checkins;
DROP POLICY IF EXISTS "Authenticated users can check in" ON session_checkins;

-- Allow authenticated users to check themselves in
CREATE POLICY "authenticated_users_can_checkin"
  ON session_checkins
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = player_id);

-- Allow anyone to view check-ins (needed for displaying the list)
DROP POLICY IF EXISTS "Anyone can view checkins" ON session_checkins;
CREATE POLICY "anyone_can_view_checkins"
  ON session_checkins
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Allow users to delete their own check-ins (for checkout)
DROP POLICY IF EXISTS "Users can delete their own checkins" ON session_checkins;
CREATE POLICY "users_can_delete_own_checkins"
  ON session_checkins
  FOR DELETE
  TO authenticated
  USING (auth.uid() = player_id);

-- Ensure RLS is enabled
ALTER TABLE session_checkins ENABLE ROW LEVEL SECURITY;

-- Verify policies (run this after to confirm):
-- SELECT policyname, roles, cmd, with_check, qual
-- FROM pg_policies
-- WHERE tablename = 'session_checkins';
