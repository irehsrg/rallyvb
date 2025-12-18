-- Add admin_role column to players table for tiered admin permissions
-- Roles: 'super_admin' (full control), 'location_admin' (manage sessions/games), 'scorekeeper' (record scores only)

ALTER TABLE players
ADD COLUMN IF NOT EXISTS admin_role TEXT CHECK (admin_role IN ('super_admin', 'location_admin', 'scorekeeper'));

-- Update existing admins to super_admin (you'll need to manually adjust this in your database)
-- This is commented out - run manually with your actual user ID
-- UPDATE players SET admin_role = 'super_admin' WHERE is_admin = true AND email = 'your-email@example.com';

-- Create index for faster role lookups
CREATE INDEX IF NOT EXISTS idx_players_admin_role ON players(admin_role) WHERE admin_role IS NOT NULL;

COMMENT ON COLUMN players.admin_role IS 'Admin permission level: super_admin (all permissions), location_admin (manage sessions/games), scorekeeper (record scores only)';
