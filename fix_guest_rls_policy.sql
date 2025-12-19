-- Fix RLS policy to allow guest users to create their own player profile
-- This allows any authenticated user to insert their own player record

-- Drop the policy if it exists
DROP POLICY IF EXISTS "Users can create their own player profile" ON players;

-- Create the policy
CREATE POLICY "Users can create their own player profile"
  ON players FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Verify RLS is enabled on players table
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
