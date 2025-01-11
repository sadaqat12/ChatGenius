-- First, drop the incorrect foreign key constraints
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_user_id_fkey;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_channel_id_fkey;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_parent_id_fkey;

ALTER TABLE message_reactions DROP CONSTRAINT IF EXISTS message_reactions_message_id_fkey;
ALTER TABLE message_reactions DROP CONSTRAINT IF EXISTS message_reactions_user_id_fkey;

ALTER TABLE direct_messages DROP CONSTRAINT IF EXISTS direct_messages_sender_id_fkey;
ALTER TABLE direct_messages DROP CONSTRAINT IF EXISTS direct_messages_channel_id_fkey;

ALTER TABLE direct_message_reactions DROP CONSTRAINT IF EXISTS direct_message_reactions_message_id_fkey;
ALTER TABLE direct_message_reactions DROP CONSTRAINT IF EXISTS direct_message_reactions_user_id_fkey;

-- Now add the correct foreign key constraints
ALTER TABLE messages
  ADD CONSTRAINT messages_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT messages_channel_id_fkey 
  FOREIGN KEY (channel_id) 
  REFERENCES channels(id) ON DELETE CASCADE,
  ADD CONSTRAINT messages_parent_id_fkey 
  FOREIGN KEY (parent_id) 
  REFERENCES messages(id) ON DELETE CASCADE;

ALTER TABLE message_reactions
  ADD CONSTRAINT message_reactions_message_id_fkey 
  FOREIGN KEY (message_id) 
  REFERENCES messages(id) ON DELETE CASCADE,
  ADD CONSTRAINT message_reactions_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE direct_messages
  ADD CONSTRAINT direct_messages_sender_id_fkey 
  FOREIGN KEY (sender_id) 
  REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT direct_messages_channel_id_fkey 
  FOREIGN KEY (channel_id) 
  REFERENCES direct_message_channels(id) ON DELETE CASCADE;

ALTER TABLE direct_message_reactions
  ADD CONSTRAINT direct_message_reactions_message_id_fkey 
  FOREIGN KEY (message_id) 
  REFERENCES direct_messages(id) ON DELETE CASCADE,
  ADD CONSTRAINT direct_message_reactions_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) ON DELETE CASCADE;

-- Ensure the users view has the correct permissions
GRANT SELECT ON public.users TO authenticated, anon;

-- Create RLS policies for the users view
ALTER VIEW users SECURITY DEFINER;

CREATE POLICY "Users can view all profiles"
  ON users FOR SELECT
  TO authenticated
  USING (true); 