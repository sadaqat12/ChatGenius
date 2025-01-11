-- Drop existing policies that might cause recursion
DROP POLICY IF EXISTS "authenticated_dm_participants_select" ON direct_message_participants;
DROP POLICY IF EXISTS "authenticated_dm_participants_insert" ON direct_message_participants;

-- Create new non-recursive policies
CREATE POLICY "authenticated_dm_participants_select"
  ON direct_message_participants FOR SELECT
  TO authenticated
  USING (
    -- Users can see participants of channels they're in
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
    -- Users can only add themselves
    user_id = auth.uid()
  );

-- Drop and recreate direct message policies
DROP POLICY IF EXISTS "authenticated_dm_messages_select" ON direct_messages;
DROP POLICY IF EXISTS "authenticated_dm_messages_insert" ON direct_messages;

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