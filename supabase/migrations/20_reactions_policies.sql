-- Enable RLS
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_message_reactions ENABLE ROW LEVEL SECURITY;

-- Grant access to authenticated users
GRANT ALL ON reactions TO authenticated;
GRANT ALL ON direct_message_reactions TO authenticated;

-- Policies for channel reactions
CREATE POLICY "Users can see reactions on messages in their channels"
ON reactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM channel_members cm
    WHERE cm.channel_id = (
      SELECT channel_id FROM messages WHERE id = reactions.message_id
    )
    AND cm.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM channels c
    WHERE c.id = (
      SELECT channel_id FROM messages WHERE id = reactions.message_id
    )
    AND c.is_private = false
  )
);

CREATE POLICY "Users can add reactions to messages in their channels"
ON reactions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM channel_members cm
    WHERE cm.channel_id = (
      SELECT channel_id FROM messages WHERE id = reactions.message_id
    )
    AND cm.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM channels c
    WHERE c.id = (
      SELECT channel_id FROM messages WHERE id = reactions.message_id
    )
    AND c.is_private = false
  )
);

CREATE POLICY "Users can delete their own reactions"
ON reactions FOR DELETE
USING (user_id = auth.uid());

-- Policies for direct message reactions
CREATE POLICY "Users can see reactions on their direct messages"
ON direct_message_reactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM direct_message_participants dmp
    WHERE dmp.channel_id = (
      SELECT channel_id FROM direct_messages WHERE id = direct_message_reactions.message_id
    )
    AND dmp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can add reactions to their direct messages"
ON direct_message_reactions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM direct_message_participants dmp
    WHERE dmp.channel_id = (
      SELECT channel_id FROM direct_messages WHERE id = direct_message_reactions.message_id
    )
    AND dmp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own direct message reactions"
ON direct_message_reactions FOR DELETE
USING (user_id = auth.uid()); 