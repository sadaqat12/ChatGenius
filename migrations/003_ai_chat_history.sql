-- Create AI chat history table
CREATE TABLE ai_chat_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Add indexes for efficient querying
  CONSTRAINT ai_chat_history_user_team_idx UNIQUE (user_id, team_id, created_at)
);

-- Add RLS policies
ALTER TABLE ai_chat_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own chat history"
  ON ai_chat_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chat history"
  ON ai_chat_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chat history"
  ON ai_chat_history
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add function to get chat history
CREATE OR REPLACE FUNCTION get_user_chat_history(
  p_user_id UUID,
  p_team_id UUID,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  role TEXT,
  content TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT ch.id, ch.role, ch.content, ch.created_at
  FROM ai_chat_history ch
  WHERE ch.user_id = p_user_id
    AND ch.team_id = p_team_id
  ORDER BY ch.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 