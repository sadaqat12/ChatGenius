-- Drop existing policies
DROP POLICY IF EXISTS "authenticated_dm_participants_insert" ON direct_message_participants;
DROP POLICY IF EXISTS "authenticated_dm_channels_insert" ON direct_message_channels;

-- Create new policies that allow users to create DM channels
CREATE POLICY "authenticated_dm_channels_insert"
ON direct_message_channels FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "authenticated_dm_participants_insert"
ON direct_message_participants FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow users to add themselves to a channel
  user_id = auth.uid()
  OR
  -- Or allow users to add others to channels they're in
  EXISTS (
    SELECT 1
    FROM direct_message_participants
    WHERE channel_id = direct_message_participants.channel_id
    AND user_id = auth.uid()
  )
); 