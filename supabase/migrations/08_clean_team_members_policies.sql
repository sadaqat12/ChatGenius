-- First, drop ALL existing policies on team_members
DROP POLICY IF EXISTS "Debug allow all select" ON team_members;
DROP POLICY IF EXISTS "Enable read access for team members" ON team_members;
DROP POLICY IF EXISTS "Service role can manage team members" ON team_members;
DROP POLICY IF EXISTS "team_members_delete_policy" ON team_members;
DROP POLICY IF EXISTS "team_members_insert_policy" ON team_members;
DROP POLICY IF EXISTS "team_members_select_policy" ON team_members;
DROP POLICY IF EXISTS "team_members_update_policy" ON team_members;
DROP POLICY IF EXISTS "Users can view members of their teams" ON team_members;
DROP POLICY IF EXISTS "team_members_select" ON team_members;

-- Enable RLS
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Grant access to roles
GRANT ALL ON team_members TO authenticated;
GRANT ALL ON team_members TO service_role;

-- Service role policy (highest priority)
CREATE POLICY "service_role_all"
  ON team_members FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Basic read policy for authenticated users
-- Users can see team members if:
-- 1. They are the member themselves
-- 2. They are a member of the same team
CREATE POLICY "authenticated_read"
  ON team_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    team_id IN (
      SELECT tm.team_id 
      FROM team_members tm 
      WHERE tm.user_id = auth.uid()
    )
  );

-- Insert policy for authenticated users
-- Users can insert if:
-- 1. They are inserting themselves
-- 2. They are an admin of the team
CREATE POLICY "authenticated_insert"
  ON team_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR
    team_id IN (
      SELECT tm.team_id 
      FROM team_members tm 
      WHERE tm.user_id = auth.uid()
      AND tm.role = 'admin'
    )
  );

-- Update policy for authenticated users
-- Only team admins can update members
CREATE POLICY "authenticated_update"
  ON team_members FOR UPDATE
  TO authenticated
  USING (
    team_id IN (
      SELECT tm.team_id 
      FROM team_members tm 
      WHERE tm.user_id = auth.uid()
      AND tm.role = 'admin'
    )
  );

-- Delete policy for authenticated users
-- Users can delete if:
-- 1. They are deleting themselves
-- 2. They are an admin of the team
CREATE POLICY "authenticated_delete"
  ON team_members FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    team_id IN (
      SELECT tm.team_id 
      FROM team_members tm 
      WHERE tm.user_id = auth.uid()
      AND tm.role = 'admin'
    )
  ); 