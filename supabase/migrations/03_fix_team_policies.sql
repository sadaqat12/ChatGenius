-- Drop all existing team member policies
DROP POLICY IF EXISTS "Users can view team members" ON team_members;
DROP POLICY IF EXISTS "Allow team member creation through create_team_with_channel function" ON team_members;
DROP POLICY IF EXISTS "Allow team member creation by team admins" ON team_members;
DROP POLICY IF EXISTS "Allow team member deletion by team admins" ON team_members;

-- Enable RLS
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Grant access to authenticated users
GRANT ALL ON team_members TO authenticated;

-- Create a simpler policy for viewing team members
CREATE POLICY "Users can view team members"
  ON team_members FOR SELECT
  USING (auth.uid() = user_id);

-- Create a policy for inserting team members
CREATE POLICY "Allow team member creation"
  ON team_members FOR INSERT
  WITH CHECK (
    -- Either the user is creating their own membership
    auth.uid() = user_id
    -- Or they are an admin of the team
    OR EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role = 'admin'
    )
  );

-- Create a policy for deleting team members
CREATE POLICY "Allow team member deletion"
  ON team_members FOR DELETE
  USING (
    -- Either the user is deleting their own membership
    auth.uid() = user_id
    -- Or they are an admin of the team
    OR EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role = 'admin'
    )
  );

-- Create a policy for updating team members
CREATE POLICY "Allow team member updates"
  ON team_members FOR UPDATE
  USING (
    -- Only team admins can update members
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role = 'admin'
    )
  );

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_role ON team_members(role); 