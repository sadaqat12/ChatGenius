-- Drop existing policies
DROP POLICY IF EXISTS "Users can view team members" ON team_members;
DROP POLICY IF EXISTS "Allow team member creation through create_team_with_channel function" ON team_members;
DROP POLICY IF EXISTS "Allow team member creation by team admins" ON team_members;

-- Enable RLS
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Grant access to authenticated users
GRANT ALL ON team_members TO authenticated;

-- Create policies
CREATE POLICY "Users can view team members"
  ON team_members FOR SELECT
  USING (
    -- User can view team members if they are a member of the team
    team_id IN (
      SELECT tm.team_id 
      FROM team_members tm 
      WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow team member creation through create_team_with_channel function"
  ON team_members FOR INSERT
  WITH CHECK (
    -- Allow creation through the function (which runs with elevated privileges)
    -- or if the user is an admin of the team
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role = 'admin'
    )
  );

CREATE POLICY "Allow team member deletion by team admins"
  ON team_members FOR DELETE
  USING (
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