-- Drop existing policies
DROP POLICY IF EXISTS "Users can view teams they are members of" ON teams;
DROP POLICY IF EXISTS "team_members_select_policy" ON team_members;
DROP POLICY IF EXISTS "Users can view team members" ON team_members;

-- Enable RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Grant access to authenticated users
GRANT ALL ON teams TO authenticated;
GRANT ALL ON team_members TO authenticated;

-- Create a policy for viewing team members that only checks the user's own ID
CREATE POLICY "team_members_select"
  ON team_members FOR SELECT
  USING (user_id = auth.uid());

-- Create a policy for viewing teams based on direct membership
CREATE POLICY "teams_select"
  ON teams FOR SELECT
  USING (
    id IN (
      SELECT team_id
      FROM team_members
      WHERE user_id = auth.uid()
    )
  );

-- Create a policy for creating teams
CREATE POLICY "teams_insert"
  ON teams FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Create a policy for updating teams (admin only)
CREATE POLICY "teams_update"
  ON teams FOR UPDATE
  USING (
    id IN (
      SELECT team_id
      FROM team_members
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Create a policy for team member creation
CREATE POLICY "team_members_insert"
  ON team_members FOR INSERT
  WITH CHECK (
    -- Either creating own membership
    user_id = auth.uid()
    -- Or admin of the team
    OR team_id IN (
      SELECT team_id
      FROM team_members
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Create a policy for team member deletion
CREATE POLICY "team_members_delete"
  ON team_members FOR DELETE
  USING (
    -- Either deleting own membership
    user_id = auth.uid()
    -- Or admin of the team
    OR team_id IN (
      SELECT team_id
      FROM team_members
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Create a policy for team member updates
CREATE POLICY "team_members_update"
  ON team_members FOR UPDATE
  USING (
    team_id IN (
      SELECT team_id
      FROM team_members
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  ); 