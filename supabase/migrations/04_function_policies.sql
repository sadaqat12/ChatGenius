-- Grant permissions to the service role
GRANT ALL ON teams TO service_role;
GRANT ALL ON channels TO service_role;
GRANT ALL ON team_members TO service_role;
GRANT ALL ON channel_members TO service_role;

-- Allow the function to bypass RLS
ALTER FUNCTION create_team_with_channel SECURITY DEFINER;

-- Create policy for service role
CREATE POLICY "Service role can manage teams"
  ON teams FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage channels"
  ON channels FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage team members"
  ON team_members FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage channel members"
  ON channel_members FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true); 