-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view team members" ON team_members;
DROP POLICY IF EXISTS "Allow team member creation through create_team_with_channel function" ON team_members;
DROP POLICY IF EXISTS "Allow team member creation by team admins" ON team_members;
DROP POLICY IF EXISTS "Allow team member deletion by team admins" ON team_members;
DROP POLICY IF EXISTS "Allow team member updates" ON team_members;
DROP POLICY IF EXISTS "team_members_select_policy" ON team_members;
DROP POLICY IF EXISTS "team_members_insert_policy" ON team_members;
DROP POLICY IF EXISTS "team_members_delete_policy" ON team_members;
DROP POLICY IF EXISTS "team_members_update_policy" ON team_members;

-- Enable RLS
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Grant access to authenticated users
GRANT ALL ON team_members TO authenticated;

-- Simple select policy - users can see their own memberships
CREATE POLICY "team_members_select"
  ON team_members FOR SELECT
  USING (user_id = auth.uid());

-- Simple insert policy - users can only insert themselves or service role handles it
CREATE POLICY "team_members_insert"
  ON team_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Simple delete policy - users can only delete themselves
CREATE POLICY "team_members_delete"
  ON team_members FOR DELETE
  USING (user_id = auth.uid());

-- Simple update policy - users can only update their own records
CREATE POLICY "team_members_update"
  ON team_members FOR UPDATE
  USING (user_id = auth.uid());

-- Grant service role full access
GRANT ALL ON team_members TO service_role;

-- Create policy for service role
CREATE POLICY "service_role_all_access"
  ON team_members FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true); 