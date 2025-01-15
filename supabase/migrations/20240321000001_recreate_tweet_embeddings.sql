-- Drop existing table and function
drop table if exists tweets;
drop function if exists match_tweets;

-- Enable the pgvector extension
create extension if not exists vector;

-- Create the tweets table with vector support
create table if not exists tweets (
    id bigserial primary key,  -- Auto-incrementing ID
    content text not null,     -- Tweet content
    embedding vector(1536) not null  -- OpenAI embedding vector
);

-- Create an index for faster similarity searches
create index on tweets 
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- Function to search for similar tweets
create or replace function match_tweets (
  query_embedding vector(1536),
  match_threshold float default 0.7,
  match_count int default 5
)
returns table (
  id bigint,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    tweets.id,
    tweets.content,
    1 - (tweets.embedding <=> query_embedding) as similarity
  from tweets
  where 1 - (tweets.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
end;
$$; 