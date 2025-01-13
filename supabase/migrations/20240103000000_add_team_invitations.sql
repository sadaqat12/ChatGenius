-- Create team_invitations table
CREATE TABLE team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- Grant access to authenticated users
GRANT ALL ON team_invitations TO authenticated;
GRANT ALL ON team_invitations TO service_role;

-- Create policies for team_invitations

-- Service role can do everything
CREATE POLICY "service_role_all"
  ON team_invitations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Users can view invitations if:
-- 1. They are the invitee (by email)
-- 2. They are a team admin
CREATE POLICY "authenticated_read"
  ON team_invitations FOR SELECT
  TO authenticated
  USING (
    email = auth.jwt()->>'email' OR
    team_id IN (
      SELECT team_id
      FROM team_members
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );

-- Only team admins can create invitations
CREATE POLICY "authenticated_insert"
  ON team_invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    team_id IN (
      SELECT team_id
      FROM team_members
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );

-- Only team admins can update invitations
CREATE POLICY "authenticated_update"
  ON team_invitations FOR UPDATE
  TO authenticated
  USING (
    team_id IN (
      SELECT team_id
      FROM team_members
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );

-- Only team admins can delete invitations
CREATE POLICY "authenticated_delete"
  ON team_invitations FOR DELETE
  TO authenticated
  USING (
    team_id IN (
      SELECT team_id
      FROM team_members
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );

-- Create indexes for performance
CREATE INDEX idx_team_invitations_team_id ON team_invitations(team_id);
CREATE INDEX idx_team_invitations_email ON team_invitations(email);
CREATE INDEX idx_team_invitations_status ON team_invitations(status);

-- Create function to handle invitation acceptance
CREATE OR REPLACE FUNCTION handle_invitation_acceptance()
RETURNS TRIGGER AS $$
BEGIN
  -- If status is changed to 'accepted'
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- Get the user_id from auth.users based on the email
    INSERT INTO team_members (team_id, user_id, role)
    SELECT NEW.team_id, au.id, 'member'
    FROM auth.users au
    WHERE au.email = NEW.email;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for invitation acceptance
CREATE TRIGGER on_invitation_accepted
  AFTER UPDATE ON team_invitations
  FOR EACH ROW
  WHEN (NEW.status = 'accepted' AND OLD.status = 'pending')
  EXECUTE FUNCTION handle_invitation_acceptance(); 