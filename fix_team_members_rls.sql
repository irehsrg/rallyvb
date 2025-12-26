-- Fix infinite recursion in team_members RLS policy
-- Run this in Supabase SQL Editor

-- Drop the problematic policies
DROP POLICY IF EXISTS "Team managers can manage roster" ON team_members;
DROP POLICY IF EXISTS "Anyone can view team members" ON team_members;

-- Create a security definer function to check if user is a team manager
-- This bypasses RLS to avoid infinite recursion
CREATE OR REPLACE FUNCTION is_team_manager(p_team_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id
      AND player_id = auth.uid()
      AND role = 'manager'
      AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if user is team creator
CREATE OR REPLACE FUNCTION is_team_creator(p_team_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM teams
    WHERE id = p_team_id
      AND created_by = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate policies using the functions

-- Anyone can view team members
CREATE POLICY "Anyone can view team members"
  ON team_members FOR SELECT
  USING (TRUE);

-- Team managers and creators can insert members
CREATE POLICY "Team managers can add members"
  ON team_members FOR INSERT
  TO authenticated
  WITH CHECK (
    is_team_manager(team_id) OR is_team_creator(team_id)
  );

-- Team managers and creators can update members
CREATE POLICY "Team managers can update members"
  ON team_members FOR UPDATE
  TO authenticated
  USING (
    is_team_manager(team_id) OR is_team_creator(team_id)
  );

-- Team managers and creators can delete members
CREATE POLICY "Team managers can delete members"
  ON team_members FOR DELETE
  TO authenticated
  USING (
    is_team_manager(team_id) OR is_team_creator(team_id)
  );

-- Also fix the teams update policy if it has similar issues
DROP POLICY IF EXISTS "Team managers can update their teams" ON teams;

CREATE POLICY "Team managers can update their teams"
  ON teams FOR UPDATE
  TO authenticated
  USING (
    is_team_manager(id) OR created_by = auth.uid()
  );
