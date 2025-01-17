-- Migration: Initial Schema
-- Created at: 2024-03-19

-- Drop existing tables if they exist
DROP TABLE IF EXISTS direct_message_reactions CASCADE;
DROP TABLE IF EXISTS direct_messages CASCADE;
DROP TABLE IF EXISTS direct_message_participants CASCADE;
DROP TABLE IF EXISTS direct_message_channels CASCADE;
DROP TABLE IF EXISTS chat_threads CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS channel_members CASCADE;
DROP TABLE IF EXISTS channels CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS reactions CASCADE;
DROP TABLE IF EXISTS team_invites CASCADE;
DROP TABLE IF EXISTS team_members CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS tweets CASCADE;

-- Create sequences
CREATE SEQUENCE IF NOT EXISTS chat_messages_id_seq;
CREATE SEQUENCE IF NOT EXISTS chat_threads_id_seq;
CREATE SEQUENCE IF NOT EXISTS tweets_id_seq;

-- Create tables in order of dependencies
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_by UUID NOT NULL REFERENCES auth.users(id),
    description TEXT,
    name TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    description TEXT,
    is_private BOOLEAN DEFAULT false,
    name TEXT NOT NULL,
    team_id UUID NOT NULL REFERENCES teams(id)
);

CREATE TABLE channel_members (
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    channel_id UUID NOT NULL REFERENCES channels(id)
);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID NOT NULL REFERENCES channels(id),
    content TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    parent_id UUID REFERENCES messages(id),
    file JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    topic TEXT NOT NULL,
    extension TEXT NOT NULL,
    payload JSONB,
    event TEXT,
    private BOOLEAN DEFAULT false
);

CREATE TABLE reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    message_id UUID NOT NULL REFERENCES messages(id),
    message_type TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    emoji TEXT NOT NULL
);

CREATE TABLE team_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    status TEXT NOT NULL,
    email TEXT NOT NULL
);

CREATE TABLE team_members (
    team_id UUID NOT NULL REFERENCES teams(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    role TEXT NOT NULL DEFAULT 'member'::text,
    user_id UUID NOT NULL REFERENCES auth.users(id)
);

CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pending_team_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    avatar_url TEXT,
    name TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
    status_updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    status TEXT NOT NULL DEFAULT 'online'::text,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE chat_threads (
    id BIGINT PRIMARY KEY DEFAULT nextval('chat_threads_id_seq'),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    title TEXT,
    assistant_type TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE chat_messages (
    id BIGINT PRIMARY KEY DEFAULT nextval('chat_messages_id_seq'),
    content TEXT NOT NULL,
    role TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    thread_id BIGINT NOT NULL REFERENCES chat_threads(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    metadata JSONB
);

CREATE TABLE direct_message_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE direct_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content TEXT NOT NULL,
    channel_id UUID REFERENCES direct_message_channels(id),
    sender_id UUID REFERENCES auth.users(id),
    file JSONB,
    extension TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE direct_message_participants (
    user_id UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    channel_id UUID NOT NULL REFERENCES direct_message_channels(id)
);

CREATE TABLE direct_message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES direct_messages(id),
    user_id UUID REFERENCES auth.users(id),
    emoji TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE tweets (
    id BIGINT PRIMARY KEY DEFAULT nextval('tweets_id_seq'),
    embedding vector,
    content TEXT NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_message_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_message_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Channel members policies
CREATE POLICY "Channel members can view channel" ON channel_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable read access for team members" ON channel_members FOR SELECT TO public USING (true);
CREATE POLICY "Service role can manage channel members" ON channel_members FOR ALL TO service_role USING (true);
CREATE POLICY "Users can join channels" ON channel_members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can leave channels" ON channel_members FOR DELETE TO authenticated USING (true);
CREATE POLICY "authenticated_channel_members_insert" ON channel_members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_channel_members_select" ON channel_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_role_channel_members" ON channel_members FOR ALL TO service_role USING (true);

-- Channels policies
CREATE POLICY "Enable read access for team members" ON channels FOR SELECT TO public USING (true);
CREATE POLICY "Service role can manage channels" ON channels FOR ALL TO service_role USING (true);
CREATE POLICY "Users can view channels in their teams" ON channels FOR SELECT TO public USING (true);
CREATE POLICY "authenticated_channels_insert" ON channels FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_channels_select" ON channels FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_role_channels" ON channels FOR ALL TO service_role USING (true);

-- Chat messages policies
CREATE POLICY "Users can insert their own chat messages" ON chat_messages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can read their own chat messages" ON chat_messages FOR SELECT TO authenticated USING (true);

-- Chat threads policies
CREATE POLICY "Users can insert their own chat threads" ON chat_threads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can read their own chat threads" ON chat_threads FOR SELECT TO authenticated USING (true);

-- Direct message channels policies
CREATE POLICY "authenticated_dm_channels_insert" ON direct_message_channels FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_dm_channels_select" ON direct_message_channels FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_role_dm_channels" ON direct_message_channels FOR ALL TO service_role USING (true);

-- Direct message participants policies
CREATE POLICY "Users can leave DM channels" ON direct_message_participants FOR DELETE TO authenticated USING (true);
CREATE POLICY "Users can view their DM participants" ON direct_message_participants FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_dm_participants_insert" ON direct_message_participants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_dm_participants_select" ON direct_message_participants FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_role_dm_participants" ON direct_message_participants FOR ALL TO service_role USING (true);

-- Direct message reactions policies
CREATE POLICY "Enable delete access for users based on user_id" ON direct_message_reactions FOR DELETE TO authenticated USING (true);
CREATE POLICY "Enable insert access for authenticated users" ON direct_message_reactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable read access for authenticated users" ON direct_message_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_dm_reactions_delete" ON direct_message_reactions FOR DELETE TO authenticated USING (true);
CREATE POLICY "authenticated_dm_reactions_insert" ON direct_message_reactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_dm_reactions_select" ON direct_message_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_role_dm_reactions" ON direct_message_reactions FOR ALL TO service_role USING (true);

-- Direct messages policies
CREATE POLICY "Service role can do everything" ON direct_messages FOR ALL TO service_role USING (true);
CREATE POLICY "authenticated_dm_messages_insert" ON direct_messages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_dm_messages_select" ON direct_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "direct_messages_delete" ON direct_messages FOR DELETE TO authenticated USING (true);
CREATE POLICY "direct_messages_insert" ON direct_messages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "direct_messages_select" ON direct_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "direct_messages_update" ON direct_messages FOR UPDATE TO authenticated USING (true);
CREATE POLICY "service_role_dm_messages" ON direct_messages FOR ALL TO service_role USING (true);

-- Messages policies
CREATE POLICY "Enable read access for channel members" ON messages FOR SELECT TO public USING (true);
CREATE POLICY "Users can view messages in their channels" ON messages FOR SELECT TO public USING (true);
CREATE POLICY "authenticated_messages_delete" ON messages FOR DELETE TO authenticated USING (true);
CREATE POLICY "authenticated_messages_insert" ON messages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_messages_select" ON messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_messages_update" ON messages FOR UPDATE TO authenticated USING (true);
CREATE POLICY "service_role_messages" ON messages FOR ALL TO service_role USING (true);

-- Reactions policies
CREATE POLICY "Enable delete access for users based on user_id" ON reactions FOR DELETE TO authenticated USING (true);
CREATE POLICY "Enable insert access for authenticated users" ON reactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable read access for authenticated users" ON reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable read access for message viewers" ON reactions FOR SELECT TO public USING (true);
CREATE POLICY "authenticated_reactions_delete" ON reactions FOR DELETE TO authenticated USING (true);
CREATE POLICY "authenticated_reactions_insert" ON reactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_reactions_select" ON reactions FOR SELECT TO authenticated USING (true);

-- Team invites policies
CREATE POLICY "create_team_invites" ON team_invites FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "delete_team_invites" ON team_invites FOR DELETE TO authenticated USING (true);
CREATE POLICY "update_team_invites" ON team_invites FOR UPDATE TO authenticated USING (true);
CREATE POLICY "view_team_invites" ON team_invites FOR SELECT TO authenticated USING (true);

-- Team members policies
CREATE POLICY "Enable read access for team members" ON team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team members can view team" ON team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can join teams" ON team_members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can leave teams" ON team_members FOR DELETE TO authenticated USING (true);
CREATE POLICY "authenticated_delete" ON team_members FOR DELETE TO authenticated USING (true);
CREATE POLICY "authenticated_insert" ON team_members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_read" ON team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_update" ON team_members FOR UPDATE TO authenticated USING (true);
CREATE POLICY "service_role_all" ON team_members FOR ALL TO service_role USING (true);

-- Teams policies
CREATE POLICY "Service role can manage teams" ON teams FOR ALL TO service_role USING (true);
CREATE POLICY "teams_insert" ON teams FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "teams_select" ON teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "teams_update" ON teams FOR UPDATE TO public USING (true);

-- User profiles policies
CREATE POLICY "Allow profile management" ON user_profiles FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Enable read access for authenticated users" ON user_profiles FOR SELECT TO public USING (true);
CREATE POLICY "Enable read access for user profiles" ON user_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can update their own profile" ON user_profiles FOR UPDATE TO public USING (true);
CREATE POLICY "Users can update their own status" ON user_profiles FOR UPDATE TO public USING (true);
CREATE POLICY "Users can view all profiles" ON user_profiles FOR SELECT TO anon USING (true); 