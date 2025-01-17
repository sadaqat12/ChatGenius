-- Enable the vector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create table for message embeddings
CREATE TABLE IF NOT EXISTS message_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL,
    team_id UUID NOT NULL,
    embedding vector(1536), -- Using 1536 dimensions for OpenAI embeddings
    content TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_message
        FOREIGN KEY (message_id)
        REFERENCES messages(id)
        ON DELETE CASCADE,
    
    CONSTRAINT fk_team
        FOREIGN KEY (team_id)
        REFERENCES teams(id)
        ON DELETE CASCADE
);

-- Create an index for team_id for filtering if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_message_embeddings_team_id') THEN
        CREATE INDEX idx_message_embeddings_team_id ON message_embeddings(team_id);
    END IF;
END $$;

-- Create a vector cosine similarity operator index if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_message_embeddings_embedding') THEN
        CREATE INDEX idx_message_embeddings_embedding ON message_embeddings
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100); -- Number of lists can be tuned based on data size
    END IF;
END $$;

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS update_message_embeddings_updated_at ON message_embeddings;
CREATE TRIGGER update_message_embeddings_updated_at
    BEFORE UPDATE ON message_embeddings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies (first drop if they exist)
ALTER TABLE message_embeddings ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Team members can read embeddings" ON message_embeddings;
    DROP POLICY IF EXISTS "Team members can insert embeddings" ON message_embeddings;
    DROP POLICY IF EXISTS "Team members can update embeddings" ON message_embeddings;
    
    -- Create policies
    CREATE POLICY "Team members can read embeddings"
        ON message_embeddings
        FOR SELECT
        USING (
            team_id IN (
                SELECT team_id 
                FROM team_members 
                WHERE user_id = auth.uid()
            )
        );

    CREATE POLICY "Team members can insert embeddings"
        ON message_embeddings
        FOR INSERT
        WITH CHECK (
            team_id IN (
                SELECT team_id 
                FROM team_members 
                WHERE user_id = auth.uid()
            )
        );

    CREATE POLICY "Team members can update embeddings"
        ON message_embeddings
        FOR UPDATE
        USING (
            team_id IN (
                SELECT team_id 
                FROM team_members 
                WHERE user_id = auth.uid()
            )
        )
        WITH CHECK (
            team_id IN (
                SELECT team_id 
                FROM team_members 
                WHERE user_id = auth.uid()
            )
        );
END $$;

-- Helper functions (using OR REPLACE so they're already idempotent)
CREATE OR REPLACE FUNCTION find_similar_messages(
    query_embedding vector(1536),
    team_id_filter UUID,
    similarity_threshold FLOAT DEFAULT 0.7,
    max_results INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    message_id UUID,
    content TEXT,
    metadata JSONB,
    similarity FLOAT
) LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        me.id,
        me.message_id,
        me.content,
        me.metadata,
        1 - (me.embedding <=> query_embedding) as similarity
    FROM message_embeddings me
    WHERE me.team_id = team_id_filter
        AND 1 - (me.embedding <=> query_embedding) > similarity_threshold
    ORDER BY me.embedding <=> query_embedding
    LIMIT max_results;
END;
$$;

CREATE OR REPLACE FUNCTION get_rag_context(
    query_embedding vector(1536),
    team_id_filter UUID,
    max_tokens INT DEFAULT 3000,
    similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
    context TEXT,
    message_ids UUID[],
    total_messages INT
) LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    context_text TEXT := '';
    message_id_array UUID[] := ARRAY[]::UUID[];
    message_count INT := 0;
    current_length INT := 0;
    target_length INT := max_tokens * 4; -- Approximate characters from tokens
    msg_record RECORD;
BEGIN
    FOR msg_record IN (
        SELECT
            me.message_id,
            me.content,
            1 - (me.embedding <=> query_embedding) as similarity
        FROM message_embeddings me
        WHERE me.team_id = team_id_filter
            AND 1 - (me.embedding <=> query_embedding) > similarity_threshold
        ORDER BY me.embedding <=> query_embedding
    ) LOOP
        -- Stop if we've exceeded target length
        IF current_length + length(msg_record.content) > target_length THEN
            EXIT;
        END IF;
        
        -- Add message to context
        IF context_text = '' THEN
            context_text := msg_record.content;
        ELSE
            context_text := context_text || E'\n---\n' || msg_record.content;
        END IF;
        
        -- Update tracking variables
        message_id_array := array_append(message_id_array, msg_record.message_id);
        current_length := current_length + length(msg_record.content);
        message_count := message_count + 1;
    END LOOP;

    RETURN QUERY SELECT
        context_text,
        message_id_array,
        message_count;
END;
$$;

CREATE OR REPLACE FUNCTION search_messages_by_text(
    query_text TEXT,
    team_id_filter UUID,
    embedding_vector vector(1536),
    max_results INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    message_id UUID,
    content TEXT,
    metadata JSONB,
    similarity FLOAT,
    text_match_rank FLOAT
) LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH vector_matches AS (
        SELECT
            me.id,
            me.message_id,
            me.content,
            me.metadata,
            1 - (me.embedding <=> embedding_vector) as similarity,
            ts_rank_cd(
                to_tsvector('english', me.content),
                plainto_tsquery('english', query_text)
            ) as text_rank
        FROM message_embeddings me
        WHERE me.team_id = team_id_filter
            AND (
                -- Match either by vector similarity or text search
                me.embedding <=> embedding_vector < 0.3
                OR me.content ILIKE '%' || query_text || '%'
            )
    )
    SELECT *
    FROM vector_matches
    ORDER BY 
        -- Combine vector similarity and text matching scores
        (similarity * 0.7 + COALESCE(text_rank, 0) * 0.3) DESC
    LIMIT max_results;
END;
$$;

-- Add GiST index for text search if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_message_embeddings_content_gin') THEN
        CREATE INDEX idx_message_embeddings_content_gin ON message_embeddings
        USING gin(to_tsvector('english', content));
    END IF;
END $$; 