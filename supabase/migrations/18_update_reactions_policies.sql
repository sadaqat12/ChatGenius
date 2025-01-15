-- Drop existing policies
DROP POLICY IF EXISTS "authenticated_reactions_select" ON reactions;
DROP POLICY IF EXISTS "authenticated_reactions_insert" ON reactions;
DROP POLICY IF EXISTS "authenticated_reactions_delete" ON reactions;
DROP POLICY IF EXISTS "authenticated_dm_reactions_select" ON direct_message_reactions;
DROP POLICY IF EXISTS "authenticated_dm_reactions_insert" ON direct_message_reactions;
DROP POLICY IF EXISTS "authenticated_dm_reactions_delete" ON direct_message_reactions;

-- Create updated policies for channel reactions
CREATE POLICY "authenticated_reactions_select"
  ON reactions FOR SELECT
  TO authenticated
  USING (
    -- Users can see reactions on messages in channels they're in
    message_id IN (
      SELECT id FROM messages
      WHERE channel_id IN (
        SELECT channel_id FROM channel_members
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "authenticated_reactions_insert"
  ON reactions FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Users can add reactions to messages in channels they're in
    user_id = auth.uid() AND
    message_id IN (
      SELECT id FROM messages
      WHERE channel_id IN (
        SELECT channel_id FROM channel_members
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "authenticated_reactions_delete"
  ON reactions FOR DELETE
  TO authenticated
  USING (
    -- Users can only delete their own reactions
    user_id = auth.uid()
  );

-- Create updated policies for direct message reactions
CREATE POLICY "authenticated_dm_reactions_select"
  ON direct_message_reactions FOR SELECT
  TO authenticated
  USING (
    -- Users can see reactions on messages in their DM channels
    message_id IN (
      SELECT id FROM direct_messages
      WHERE channel_id IN (
        SELECT channel_id FROM direct_message_participants
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "authenticated_dm_reactions_insert"
  ON direct_message_reactions FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Users can add reactions to messages in their DM channels
    user_id = auth.uid() AND
    message_id IN (
      SELECT id FROM direct_messages
      WHERE channel_id IN (
        SELECT channel_id FROM direct_message_participants
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "authenticated_dm_reactions_delete"
  ON direct_message_reactions FOR DELETE
  TO authenticated
  USING (
    -- Users can only delete their own reactions
    user_id = auth.uid()
  ); 