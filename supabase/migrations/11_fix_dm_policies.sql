-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their DM channels" ON direct_message_channels;
DROP POLICY IF EXISTS "Users can create DM channels" ON direct_message_channels;
DROP POLICY IF EXISTS "Users can view participants in their DM channels" ON direct_message_participants;
DROP POLICY IF EXISTS "Users can add participants to DM channels they're in" ON direct_message_participants;
DROP POLICY IF EXISTS "Users can view messages in their DM channels" ON direct_messages;
DROP POLICY IF EXISTS "Users can send messages to their DM channels" ON direct_messages;
DROP POLICY IF EXISTS "Users can view reactions in their DM channels" ON direct_message_reactions;
DROP POLICY IF EXISTS "Users can add reactions to messages in their DM channels" ON direct_message_reactions;
DROP POLICY IF EXISTS "Users can remove their own reactions" ON direct_message_reactions;

-- Enable RLS
ALTER TABLE direct_message_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_message_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_message_reactions ENABLE ROW LEVEL SECURITY;

-- Grant access to roles
GRANT ALL ON direct_message_channels TO authenticated;
GRANT ALL ON direct_message_participants TO authenticated;
GRANT ALL ON direct_messages TO authenticated;
GRANT ALL ON direct_message_reactions TO authenticated;
GRANT ALL ON direct_message_channels TO service_role;
GRANT ALL ON direct_message_participants TO service_role;
GRANT ALL ON direct_messages TO service_role;
GRANT ALL ON direct_message_reactions TO service_role;

-- Service role policies
CREATE POLICY "service_role_dm_channels"
  ON direct_message_channels FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_dm_participants"
  ON direct_message_participants FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_dm_messages"
  ON direct_messages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_dm_reactions"
  ON direct_message_reactions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- DM channel policies for authenticated users
CREATE POLICY "authenticated_dm_channels_select"
  ON direct_message_channels FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT channel_id
      FROM direct_message_participants
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "authenticated_dm_channels_insert"
  ON direct_message_channels FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- DM participant policies for authenticated users
CREATE POLICY "authenticated_dm_participants_select"
  ON direct_message_participants FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "authenticated_dm_participants_insert"
  ON direct_message_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Can only add themselves or if they're already a participant
    user_id = auth.uid() OR
    channel_id IN (
      SELECT channel_id
      FROM direct_message_participants
      WHERE user_id = auth.uid()
    )
  );

-- DM message policies for authenticated users
CREATE POLICY "authenticated_dm_messages_select"
  ON direct_messages FOR SELECT
  TO authenticated
  USING (
    channel_id IN (
      SELECT channel_id
      FROM direct_message_participants
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "authenticated_dm_messages_insert"
  ON direct_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    channel_id IN (
      SELECT channel_id
      FROM direct_message_participants
      WHERE user_id = auth.uid()
    )
  );

-- DM reaction policies for authenticated users
CREATE POLICY "authenticated_dm_reactions_select"
  ON direct_message_reactions FOR SELECT
  TO authenticated
  USING (
    message_id IN (
      SELECT dm.id
      FROM direct_messages dm
      JOIN direct_message_participants dmp ON dmp.channel_id = dm.channel_id
      WHERE dmp.user_id = auth.uid()
    )
  );

CREATE POLICY "authenticated_dm_reactions_insert"
  ON direct_message_reactions FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    message_id IN (
      SELECT dm.id
      FROM direct_messages dm
      JOIN direct_message_participants dmp ON dmp.channel_id = dm.channel_id
      WHERE dmp.user_id = auth.uid()
    )
  );

CREATE POLICY "authenticated_dm_reactions_delete"
  ON direct_message_reactions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid()); 