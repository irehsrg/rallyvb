-- Comprehensive fix for guest user RLS issues
-- This drops conflicting policies and creates the right ones

-- First, let's see what INSERT policies exist on players table
-- You can run this separately to debug:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'players' AND cmd = 'INSERT';

-- Drop any existing INSERT policies that might conflict
DROP POLICY IF EXISTS "Users can create their own player profile" ON players;
DROP POLICY IF EXISTS "Allow authenticated users to insert players" ON players;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON players;

-- Create a new comprehensive policy for authenticated users to self-register
CREATE POLICY "authenticated_users_can_self_register"
  ON players
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Also ensure public/anon users cannot insert
-- (This is usually the default but let's be explicit)
DROP POLICY IF EXISTS "Prevent anonymous inserts" ON players;
CREATE POLICY "prevent_anonymous_inserts"
  ON players
  FOR INSERT
  TO anon
  WITH CHECK (false);

-- Make sure RLS is enabled
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Verify the policies (run this after to confirm):
-- SELECT policyname, roles, cmd, with_check
-- FROM pg_policies
-- WHERE tablename = 'players' AND cmd = 'INSERT';
