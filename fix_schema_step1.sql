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

-- Verify users view permissions
GRANT SELECT ON public.users TO authenticated, anon;

-- Create RLS policies for the users view if not exists
DROP POLICY IF EXISTS "Users can view all profiles" ON users;
CREATE POLICY "Users can view all profiles"
  ON users FOR SELECT
  TO authenticated
  USING (true); 