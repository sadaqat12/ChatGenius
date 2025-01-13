-- Enable RLS
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- Grant access to authenticated users
GRANT ALL ON direct_messages TO authenticated;
GRANT ALL ON direct_messages TO service_role;

-- Direct message policies for authenticated users
CREATE POLICY "Users can view messages in their DM channels"
  ON direct_messages FOR SELECT
  TO authenticated
  USING (
    channel_id IN (
      SELECT channel_id
      FROM direct_message_participants
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages to their DM channels"
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

-- Service role policies
CREATE POLICY "Service role can do everything"
  ON direct_messages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true); 