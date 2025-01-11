-- First drop ALL RLS policies
DROP POLICY IF EXISTS "Users can view reactions on messages they can see" ON message_reactions;
DROP POLICY IF EXISTS "Users can add reactions to messages they can see" ON message_reactions;
DROP POLICY IF EXISTS "Users can remove their own reactions" ON message_reactions;
DROP POLICY IF EXISTS "Team members can view team" ON team_members;
DROP POLICY IF EXISTS "Users can join teams" ON team_members;
DROP POLICY IF EXISTS "Users can leave teams" ON team_members;
DROP POLICY IF EXISTS "Channel members can view channel" ON channel_members;
DROP POLICY IF EXISTS "Users can join channels" ON channel_members;
DROP POLICY IF EXISTS "Users can leave channels" ON channel_members;
DROP POLICY IF EXISTS "Users can view their DM participants" ON direct_message_participants;
DROP POLICY IF EXISTS "Users can leave DM channels" ON direct_message_participants;
DROP POLICY IF EXISTS "Users can view their DM reactions" ON direct_message_reactions;
DROP POLICY IF EXISTS "Users can remove their DM reactions" ON direct_message_reactions;

-- Drop and recreate foreign key constraints
ALTER TABLE message_reactions 
  DROP CONSTRAINT IF EXISTS message_reactions_message_id_fkey,
  DROP CONSTRAINT IF EXISTS message_reactions_user_id_fkey,
  ADD CONSTRAINT message_reactions_message_id_fkey 
    FOREIGN KEY (message_id) 
    REFERENCES messages(id) ON DELETE CASCADE,
  ADD CONSTRAINT message_reactions_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE team_members 
  DROP CONSTRAINT IF EXISTS team_members_team_id_fkey,
  DROP CONSTRAINT IF EXISTS team_members_user_id_fkey,
  ADD CONSTRAINT team_members_team_id_fkey 
    FOREIGN KEY (team_id) 
    REFERENCES teams(id) ON DELETE CASCADE,
  ADD CONSTRAINT team_members_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE channel_members 
  DROP CONSTRAINT IF EXISTS channel_members_channel_id_fkey,
  DROP CONSTRAINT IF EXISTS channel_members_user_id_fkey,
  ADD CONSTRAINT channel_members_channel_id_fkey 
    FOREIGN KEY (channel_id) 
    REFERENCES channels(id) ON DELETE CASCADE,
  ADD CONSTRAINT channel_members_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE direct_message_participants 
  DROP CONSTRAINT IF EXISTS direct_message_participants_channel_id_fkey,
  DROP CONSTRAINT IF EXISTS direct_message_participants_user_id_fkey,
  ADD CONSTRAINT direct_message_participants_channel_id_fkey 
    FOREIGN KEY (channel_id) 
    REFERENCES direct_message_channels(id) ON DELETE CASCADE,
  ADD CONSTRAINT direct_message_participants_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE direct_message_reactions 
  DROP CONSTRAINT IF EXISTS direct_message_reactions_message_id_fkey,
  DROP CONSTRAINT IF EXISTS direct_message_reactions_user_id_fkey,
  ADD CONSTRAINT direct_message_reactions_message_id_fkey 
    FOREIGN KEY (message_id) 
    REFERENCES direct_messages(id) ON DELETE CASCADE,
  ADD CONSTRAINT direct_message_reactions_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop incorrect foreign key constraints from channels
ALTER TABLE channels DROP CONSTRAINT IF EXISTS channels_id_fkey;
ALTER TABLE channels DROP CONSTRAINT IF EXISTS channels_team_id_fkey;
ALTER TABLE channels DROP CONSTRAINT IF EXISTS channels_created_by_fkey;

-- Add correct foreign key constraints for channels
ALTER TABLE channels
  ADD CONSTRAINT channels_team_id_fkey 
    FOREIGN KEY (team_id) 
    REFERENCES teams(id) ON DELETE CASCADE,
  ADD CONSTRAINT channels_created_by_fkey 
    FOREIGN KEY (created_by) 
    REFERENCES auth.users(id) ON DELETE CASCADE;

-- Recreate ALL RLS policies
CREATE POLICY "Users can view reactions on messages they can see"
  ON message_reactions FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM messages m
    WHERE m.id = message_reactions.message_id
  ));

CREATE POLICY "Users can add reactions to messages they can see"
  ON message_reactions FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM messages m
    WHERE m.id = message_reactions.message_id
  ));

CREATE POLICY "Users can remove their own reactions"
  ON message_reactions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Team members can view team"
  ON team_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can join teams"
  ON team_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can leave teams"
  ON team_members FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Channel members can view channel"
  ON channel_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can join channels"
  ON channel_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can leave channels"
  ON channel_members FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can view their DM participants"
  ON direct_message_participants FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can leave DM channels"
  ON direct_message_participants FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can view their DM reactions"
  ON direct_message_reactions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can remove their DM reactions"
  ON direct_message_reactions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Verify users view permissions
GRANT SELECT ON public.users TO authenticated, anon; 