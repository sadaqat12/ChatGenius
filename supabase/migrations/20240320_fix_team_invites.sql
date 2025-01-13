-- First, ensure team_id is NOT NULL
ALTER TABLE team_invites 
  ALTER COLUMN team_id SET NOT NULL;

-- Drop existing policies
DROP POLICY IF EXISTS "Team admins can create invites" ON team_invites;
DROP POLICY IF EXISTS "Team admins can delete invites" ON team_invites;
DROP POLICY IF EXISTS "Team admins can update invites" ON team_invites;
DROP POLICY IF EXISTS "Team admins can view invites" ON team_invites;

-- Create new policies that allow both admin and invitee access
CREATE POLICY "view_team_invites" ON team_invites FOR SELECT
TO authenticated
USING (
  -- User can view if they are the invitee
  email = auth.jwt()->>'email'
  OR
  -- Or if they are a team admin
  team_id IN (
    SELECT team_id 
    FROM team_members 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  )
);

CREATE POLICY "create_team_invites" ON team_invites FOR INSERT
TO authenticated
WITH CHECK (
  -- Only team admins can create invites
  team_id IN (
    SELECT team_id 
    FROM team_members 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  )
);

CREATE POLICY "update_team_invites" ON team_invites FOR UPDATE
TO authenticated
USING (
  -- User can update if they are the invitee (for accepting/rejecting)
  email = auth.jwt()->>'email'
  OR
  -- Or if they are a team admin
  team_id IN (
    SELECT team_id 
    FROM team_members 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  )
)
WITH CHECK (
  -- Same conditions for the new row
  email = auth.jwt()->>'email'
  OR
  team_id IN (
    SELECT team_id 
    FROM team_members 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  )
);

CREATE POLICY "delete_team_invites" ON team_invites FOR DELETE
TO authenticated
USING (
  -- Only team admins can delete invites
  team_id IN (
    SELECT team_id 
    FROM team_members 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  )
); 