-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "authenticated_dm_participants_select" ON direct_message_participants;
DROP POLICY IF EXISTS "authenticated_dm_participants_insert" ON direct_message_participants;
DROP POLICY IF EXISTS "authenticated_dm_channels_select" ON direct_message_channels;
DROP POLICY IF EXISTS "authenticated_dm_channels_insert" ON direct_message_channels;

-- Create new non-recursive policies for channels
CREATE POLICY "authenticated_dm_channels_select"
  ON direct_message_channels FOR SELECT
  TO authenticated
  USING (
    -- Users can see channels they're in
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

-- Create new non-recursive policies for participants
CREATE POLICY "authenticated_dm_participants_select"
  ON direct_message_participants FOR SELECT
  TO authenticated
  USING (
    -- Users can see participants in their channels
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
    -- Users can add participants to channels they're in
    channel_id IN (
      SELECT channel_id
      FROM direct_message_participants
      WHERE user_id = auth.uid()
    )
    OR
    -- Or they are adding themselves
    user_id = auth.uid()
  );

-- Update the direct messages policy to be non-recursive
DROP POLICY IF EXISTS "authenticated_dm_messages_select" ON direct_messages;
DROP POLICY IF EXISTS "authenticated_dm_messages_insert" ON direct_messages;

CREATE POLICY "authenticated_dm_messages_select"
  ON direct_messages FOR SELECT
  TO authenticated
  USING (
    -- Users can see messages in channels they're in
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
    -- Users can only send messages as themselves in channels they're in
    sender_id = auth.uid() AND
    channel_id IN (
      SELECT channel_id
      FROM direct_message_participants
      WHERE user_id = auth.uid()
    )
  ); 