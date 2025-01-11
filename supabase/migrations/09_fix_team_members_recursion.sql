-- Drop ALL possible existing policies
DROP POLICY IF EXISTS "authenticated_read" ON team_members;
DROP POLICY IF EXISTS "authenticated_insert" ON team_members;
DROP POLICY IF EXISTS "authenticated_update" ON team_members;
DROP POLICY IF EXISTS "authenticated_delete" ON team_members;
DROP POLICY IF EXISTS "service_role_all" ON team_members;
DROP POLICY IF EXISTS "team_members_select_policy" ON team_members;
DROP POLICY IF EXISTS "team_members_insert_policy" ON team_members;
DROP POLICY IF EXISTS "team_members_update_policy" ON team_members;
DROP POLICY IF EXISTS "team_members_delete_policy" ON team_members;
DROP POLICY IF EXISTS "Debug allow all select" ON team_members;
DROP POLICY IF EXISTS "Enable read access for team members" ON team_members;
DROP POLICY IF EXISTS "Service role can manage team members" ON team_members;
DROP POLICY IF EXISTS "Users can view members of their teams" ON team_members;
DROP POLICY IF EXISTS "team_members_select" ON team_members;
DROP POLICY IF EXISTS "Users can view team members" ON team_members;
DROP POLICY IF EXISTS "Allow team member creation" ON team_members;
DROP POLICY IF EXISTS "Allow team member deletion" ON team_members;
DROP POLICY IF EXISTS "Allow team member updates" ON team_members;
DROP POLICY IF EXISTS "Allow team member creation through create_team_with_channel function" ON team_members;

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
-- Users can ONLY see their own memberships
CREATE POLICY "authenticated_read"
  ON team_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Insert policy for authenticated users
-- Users can ONLY insert themselves
-- Service role handles other insertions
CREATE POLICY "authenticated_insert"
  ON team_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Update policy for authenticated users
-- Users can ONLY update their own records
CREATE POLICY "authenticated_update"
  ON team_members FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Delete policy for authenticated users
-- Users can ONLY delete their own records
CREATE POLICY "authenticated_delete"
  ON team_members FOR DELETE
  TO authenticated
  USING (user_id = auth.uid()); 