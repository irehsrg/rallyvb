-- Add player groups feature to allow 2-4 players to be kept together on the same team
-- This is useful for friends, couples, or regular partners who want to play together

-- Create player_groups table
CREATE TABLE IF NOT EXISTS player_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL, -- e.g. "John & Jane", "Monday Night Crew"
  created_by UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create player_group_members table (junction table)
CREATE TABLE IF NOT EXISTS player_group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES player_groups(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, player_id) -- A player can only be in a group once
);

-- Create session_group_requests table to track which groups want to play together in a session
CREATE TABLE IF NOT EXISTS session_group_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES player_groups(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, group_id) -- A group can only request once per session
);

-- Add RLS policies

-- player_groups policies
ALTER TABLE player_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view groups" ON player_groups;
CREATE POLICY "anyone_can_view_groups"
  ON player_groups
  FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can create groups" ON player_groups;
CREATE POLICY "authenticated_users_can_create_groups"
  ON player_groups
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Group creators can update their groups" ON player_groups;
CREATE POLICY "group_creators_can_update_groups"
  ON player_groups
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Group creators can delete their groups" ON player_groups;
CREATE POLICY "group_creators_can_delete_groups"
  ON player_groups
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- player_group_members policies
ALTER TABLE player_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view group members" ON player_group_members;
CREATE POLICY "anyone_can_view_group_members"
  ON player_group_members
  FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Group creators can add members" ON player_group_members;
CREATE POLICY "group_creators_can_add_members"
  ON player_group_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM player_groups
      WHERE id = group_id AND created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Group creators can remove members" ON player_group_members;
CREATE POLICY "group_creators_can_remove_members"
  ON player_group_members
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM player_groups
      WHERE id = group_id AND created_by = auth.uid()
    )
  );

-- session_group_requests policies
ALTER TABLE session_group_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view group requests" ON session_group_requests;
CREATE POLICY "anyone_can_view_group_requests"
  ON session_group_requests
  FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Group creators can create requests" ON session_group_requests;
CREATE POLICY "group_creators_can_create_requests"
  ON session_group_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM player_groups
      WHERE id = group_id AND created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Group creators can update requests" ON session_group_requests;
CREATE POLICY "group_creators_can_update_requests"
  ON session_group_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM player_groups
      WHERE id = group_id AND created_by = auth.uid()
    )
  );

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_player_group_members_group_id ON player_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_player_group_members_player_id ON player_group_members(player_id);
CREATE INDEX IF NOT EXISTS idx_session_group_requests_session_id ON session_group_requests(session_id);
CREATE INDEX IF NOT EXISTS idx_session_group_requests_group_id ON session_group_requests(group_id);

-- Add comments for documentation
COMMENT ON TABLE player_groups IS 'Groups of 2-4 players who want to play together on the same team';
COMMENT ON TABLE player_group_members IS 'Junction table linking players to groups';
COMMENT ON TABLE session_group_requests IS 'Tracks which groups want to play together in specific sessions';
