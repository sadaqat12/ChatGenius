-- Drop existing policies
DROP POLICY IF EXISTS "Users can view channels they have access to" ON channels;
DROP POLICY IF EXISTS "Team members can create channels" ON channels;
DROP POLICY IF EXISTS "Users can view messages in channels they have access to" ON messages;
DROP POLICY IF EXISTS "Users can insert messages in channels they have access to" ON messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;
DROP POLICY IF EXISTS "Users can view channel members" ON channel_members;
DROP POLICY IF EXISTS "Allow channel member creation through create_team_with_channel function" ON channel_members;

-- Enable RLS
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;

-- Grant access to roles
GRANT ALL ON channels TO authenticated;
GRANT ALL ON messages TO authenticated;
GRANT ALL ON channel_members TO authenticated;
GRANT ALL ON channels TO service_role;
GRANT ALL ON messages TO service_role;
GRANT ALL ON channel_members TO service_role;

-- Service role policies
CREATE POLICY "service_role_channels"
  ON channels FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_messages"
  ON messages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_channel_members"
  ON channel_members FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Channel policies for authenticated users
CREATE POLICY "authenticated_channels_select"
  ON channels FOR SELECT
  TO authenticated
  USING (
    team_id IN (
      SELECT team_id
      FROM team_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "authenticated_channels_insert"
  ON channels FOR INSERT
  TO authenticated
  WITH CHECK (
    team_id IN (
      SELECT team_id
      FROM team_members
      WHERE user_id = auth.uid()
    )
  );

-- Channel member policies for authenticated users
CREATE POLICY "authenticated_channel_members_select"
  ON channel_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "authenticated_channel_members_insert"
  ON channel_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Message policies for authenticated users
CREATE POLICY "authenticated_messages_select"
  ON messages FOR SELECT
  TO authenticated
  USING (
    channel_id IN (
      SELECT c.id
      FROM channels c
      JOIN team_members tm ON tm.team_id = c.team_id
      WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY "authenticated_messages_insert"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    channel_id IN (
      SELECT c.id
      FROM channels c
      JOIN team_members tm ON tm.team_id = c.team_id
      WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY "authenticated_messages_update"
  ON messages FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "authenticated_messages_delete"
  ON messages FOR DELETE
  TO authenticated
  USING (user_id = auth.uid()); 