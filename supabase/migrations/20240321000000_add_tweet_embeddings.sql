-- Enable pgvector extension
create extension if not exists vector;

-- Create tweets table with embeddings
create table if not exists tweets (
    id bigint primary key,
    content text not null,
    author text not null,
    created_at timestamp with time zone not null,
    embedding vector(1536) not null
);

-- Create a function to match similar tweets
create or replace function match_tweets(
    query_embedding vector(1536),
    match_threshold float,
    match_count int
)
returns table (
    id bigint,
    content text,
    author text,
    created_at timestamp with time zone,
    similarity float
)
language sql stable
as $$
    select
        id,
        content,
        author,
        created_at,
        1 - (tweets.embedding <=> query_embedding) as similarity
    from tweets
    where 1 - (tweets.embedding <=> query_embedding) > match_threshold
    order by similarity desc
    limit match_count;
$$; 