-- Drop existing policies
DROP POLICY IF EXISTS "authenticated_dm_channels_select" ON direct_message_channels;
DROP POLICY IF EXISTS "authenticated_dm_channels_insert" ON direct_message_channels;
DROP POLICY IF EXISTS "Users can view their DM channels" ON direct_message_channels;
DROP POLICY IF EXISTS "Users can create DM channels" ON direct_message_channels;
DROP POLICY IF EXISTS "authenticated_dm_participants_select" ON direct_message_participants;
DROP POLICY IF EXISTS "authenticated_dm_participants_insert" ON direct_message_participants;
DROP POLICY IF EXISTS "Users can view participants in their DM channels" ON direct_message_participants;
DROP POLICY IF EXISTS "Users can add participants to DM channels they're in" ON direct_message_participants;
DROP POLICY IF EXISTS "Users can view messages in their DM channels" ON direct_messages;
DROP POLICY IF EXISTS "Users can send messages to their DM channels" ON direct_messages;
DROP POLICY IF EXISTS "authenticated_dm_messages_select" ON direct_messages;
DROP POLICY IF EXISTS "authenticated_dm_messages_insert" ON direct_messages;

-- Make sure RLS is enabled
ALTER TABLE direct_message_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_message_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT ALL ON direct_message_channels TO authenticated;
GRANT ALL ON direct_message_participants TO authenticated;
GRANT ALL ON direct_messages TO authenticated;

-- Create a simple policy for direct_message_channels
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

-- Create non-recursive policies for participants
CREATE POLICY "authenticated_dm_participants_select"
  ON direct_message_participants FOR SELECT
  TO authenticated
  USING (
    -- Users can only see participants in their channels
    channel_id IN (
      SELECT channel_id
      FROM direct_message_participants
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "authenticated_dm_participants_insert"
  ON direct_message_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Users can only add participants to their channels
    channel_id IN (
      SELECT channel_id
      FROM direct_message_participants
      WHERE user_id = auth.uid()
    )
    OR
    -- Or they are adding themselves
    user_id = auth.uid()
  );

-- Create policies for direct messages
CREATE POLICY "authenticated_dm_messages_select"
  ON direct_messages FOR SELECT
  TO authenticated
  USING (
    -- Users can see messages in their channels
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
    -- Users can send messages if they are the sender and a participant
    sender_id = auth.uid() AND
    channel_id IN (
      SELECT channel_id
      FROM direct_message_participants
      WHERE user_id = auth.uid()
    )
  ); 