-- First, drop all existing policies on team_members
DROP POLICY IF EXISTS "Users can view team members" ON team_members;
DROP POLICY IF EXISTS "Allow team member creation through create_team_with_channel function" ON team_members;
DROP POLICY IF EXISTS "Allow team member creation by team admins" ON team_members;
DROP POLICY IF EXISTS "Allow team member deletion by team admins" ON team_members;
DROP POLICY IF EXISTS "Allow team member updates" ON team_members;

-- Enable RLS
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Grant access to authenticated users
GRANT ALL ON team_members TO authenticated;

-- Create a simple policy for viewing team members
-- This policy allows users to see team members if they are a member of that team
CREATE POLICY "team_members_select_policy"
  ON team_members FOR SELECT
  USING (
    -- User can see team members if they are a member of the same team
    user_id = auth.uid() OR
    team_id IN (
      SELECT team_id 
      FROM team_members 
      WHERE user_id = auth.uid()
    )
  );

-- Create a simple policy for inserting team members
CREATE POLICY "team_members_insert_policy"
  ON team_members FOR INSERT
  WITH CHECK (
    -- User can only insert themselves as a member
    user_id = auth.uid() OR
    -- Or they are an admin of the team
    EXISTS (
      SELECT 1 
      FROM team_members 
      WHERE team_id = team_members.team_id 
      AND user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Create a simple policy for deleting team members
CREATE POLICY "team_members_delete_policy"
  ON team_members FOR DELETE
  USING (
    -- Users can delete their own membership
    user_id = auth.uid() OR
    -- Or they are an admin of the team
    EXISTS (
      SELECT 1 
      FROM team_members 
      WHERE team_id = team_members.team_id 
      AND user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Create a simple policy for updating team members
CREATE POLICY "team_members_update_policy"
  ON team_members FOR UPDATE
  USING (
    -- Only team admins can update members
    EXISTS (
      SELECT 1 
      FROM team_members 
      WHERE team_id = team_members.team_id 
      AND user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Ensure indexes exist for performance
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_role ON team_members(role); 