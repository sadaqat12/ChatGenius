-- Drop existing policies
DROP POLICY IF EXISTS "Users can see reactions on messages in their channels" ON reactions;
DROP POLICY IF EXISTS "Users can add reactions to messages in their channels" ON reactions;
DROP POLICY IF EXISTS "Users can delete their own reactions" ON reactions;
DROP POLICY IF EXISTS "Users can see reactions on their direct messages" ON direct_message_reactions;
DROP POLICY IF EXISTS "Users can add reactions to their direct messages" ON direct_message_reactions;
DROP POLICY IF EXISTS "Users can delete their own direct message reactions" ON direct_message_reactions;

-- Enable RLS
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_message_reactions ENABLE ROW LEVEL SECURITY;

-- Grant access to authenticated users
GRANT ALL ON reactions TO authenticated;
GRANT ALL ON direct_message_reactions TO authenticated;

-- Simpler policies for channel reactions
CREATE POLICY "Enable read access for authenticated users"
ON reactions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable insert access for authenticated users"
ON reactions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable delete access for users based on user_id"
ON reactions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Simpler policies for direct message reactions
CREATE POLICY "Enable read access for authenticated users"
ON direct_message_reactions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable insert access for authenticated users"
ON direct_message_reactions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable delete access for users based on user_id"
ON direct_message_reactions FOR DELETE
TO authenticated
USING (auth.uid() = user_id); 