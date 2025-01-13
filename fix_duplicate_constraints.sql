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

-- Drop duplicate columns and incorrect constraints
ALTER TABLE message_reactions DROP COLUMN IF EXISTS message_id;
ALTER TABLE message_reactions DROP COLUMN IF EXISTS user_id;
ALTER TABLE team_members DROP COLUMN IF EXISTS team_id;
ALTER TABLE team_members DROP COLUMN IF EXISTS user_id;
ALTER TABLE channel_members DROP COLUMN IF EXISTS channel_id;
ALTER TABLE channel_members DROP COLUMN IF EXISTS user_id;
ALTER TABLE direct_message_participants DROP COLUMN IF EXISTS channel_id;
ALTER TABLE direct_message_participants DROP COLUMN IF EXISTS user_id;
ALTER TABLE direct_message_reactions DROP COLUMN IF EXISTS message_id;
ALTER TABLE direct_message_reactions DROP COLUMN IF EXISTS user_id;

-- Drop incorrect foreign key constraints from channels
ALTER TABLE channels DROP CONSTRAINT IF EXISTS channels_id_fkey;
ALTER TABLE channels DROP CONSTRAINT IF EXISTS channels_team_id_fkey;
ALTER TABLE channels DROP CONSTRAINT IF EXISTS channels_created_by_fkey;

-- Add correct foreign key constraints
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

-- Create RLS policies for the users view if not exists
DROP POLICY IF EXISTS "Users can view all profiles" ON users;
CREATE POLICY "Users can view all profiles"
  ON users FOR SELECT
  TO authenticated
  USING (true); 