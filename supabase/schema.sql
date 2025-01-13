-- Create tables
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  is_private BOOLEAN DEFAULT false,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content TEXT NOT NULL,
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  parent_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  file JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE message_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(message_id, user_id, emoji)
);

CREATE TABLE team_members (
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE channel_members (
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE direct_message_channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE direct_message_participants (
  channel_id UUID NOT NULL REFERENCES direct_message_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE direct_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content TEXT NOT NULL,
  channel_id UUID NOT NULL REFERENCES direct_message_channels(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  file JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE direct_message_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES direct_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(message_id, user_id, emoji)
);

-- Create user profiles table
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(user_id)
);

-- Create functions
CREATE OR REPLACE FUNCTION create_team_with_channel(team_name TEXT, user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  team_id UUID;
  channel_id UUID;
BEGIN
  -- Create team
  INSERT INTO teams (name, created_by)
  VALUES (team_name, user_id)
  RETURNING id INTO team_id;

  -- Add creator as team member with admin role
  INSERT INTO team_members (team_id, user_id, role)
  VALUES (team_id, user_id, 'admin');

  -- Create general channel
  INSERT INTO channels (name, team_id, created_by)
  VALUES ('general', team_id, user_id)
  RETURNING id INTO channel_id;

  -- Add creator as channel member
  INSERT INTO channel_members (channel_id, user_id)
  VALUES (channel_id, user_id);

  RETURN team_id;
END;
$$;

-- Create triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_channels_updated_at
  BEFORE UPDATE ON channels
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_direct_messages_updated_at
  BEFORE UPDATE ON direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Create RLS policies
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_message_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_message_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Teams policies
CREATE POLICY "Users can view teams they are members of"
  ON teams FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM team_members
    WHERE team_members.team_id = teams.id
    AND team_members.user_id = auth.uid()
  ));

CREATE POLICY "Authenticated users can create teams"
  ON teams FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Team admins can update their teams"
  ON teams FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM team_members
    WHERE team_members.team_id = teams.id
    AND team_members.user_id = auth.uid()
    AND team_members.role = 'admin'
  ));

-- Team members policies
CREATE POLICY "Users can view team members"
  ON team_members FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.team_id = team_members.team_id
    AND tm.user_id = auth.uid()
  ));

CREATE POLICY "Allow team member creation through create_team_with_channel function"
  ON team_members FOR INSERT
  WITH CHECK (true);

-- Channels policies
CREATE POLICY "Users can view channels they have access to"
  ON channels FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM team_members
    WHERE team_members.team_id = channels.team_id
    AND team_members.user_id = auth.uid()
    AND (
      NOT channels.is_private
      OR EXISTS (
        SELECT 1 FROM channel_members
        WHERE channel_members.channel_id = channels.id
        AND channel_members.user_id = auth.uid()
      )
    )
  ));

CREATE POLICY "Team members can create channels"
  ON channels FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM team_members
    WHERE team_members.team_id = channels.team_id
    AND team_members.user_id = auth.uid()
  ));

-- Messages policies
CREATE POLICY "Users can view messages in channels they have access to"
  ON messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM channels
    JOIN team_members ON team_members.team_id = channels.team_id
    WHERE channels.id = messages.channel_id
    AND team_members.user_id = auth.uid()
    AND (
      NOT channels.is_private
      OR EXISTS (
        SELECT 1 FROM channel_members
        WHERE channel_members.channel_id = channels.id
        AND channel_members.user_id = auth.uid()
      )
    )
  ));

CREATE POLICY "Users can insert messages in channels they have access to"
  ON messages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM channels
    JOIN team_members ON team_members.team_id = channels.team_id
    WHERE channels.id = messages.channel_id
    AND team_members.user_id = auth.uid()
    AND (
      NOT channels.is_private
      OR EXISTS (
        SELECT 1 FROM channel_members
        WHERE channel_members.channel_id = channels.id
        AND channel_members.user_id = auth.uid()
      )
    )
  ));

CREATE POLICY "Users can update their own messages"
  ON messages FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own messages"
  ON messages FOR DELETE
  USING (user_id = auth.uid());

-- Message reactions policies
CREATE POLICY "Users can view reactions on messages they can see"
  ON message_reactions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM messages
    JOIN channels ON channels.id = messages.channel_id
    JOIN team_members ON team_members.team_id = channels.team_id
    WHERE messages.id = message_reactions.message_id
    AND team_members.user_id = auth.uid()
    AND (
      NOT channels.is_private
      OR EXISTS (
        SELECT 1 FROM channel_members
        WHERE channel_members.channel_id = channels.id
        AND channel_members.user_id = auth.uid()
      )
    )
  ));

CREATE POLICY "Users can add reactions to messages they can see"
  ON message_reactions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM messages
      JOIN channels ON channels.id = messages.channel_id
      JOIN team_members ON team_members.team_id = channels.team_id
      WHERE messages.id = message_reactions.message_id
      AND team_members.user_id = auth.uid()
      AND (
        NOT channels.is_private
        OR EXISTS (
          SELECT 1 FROM channel_members
          WHERE channel_members.channel_id = channels.id
          AND channel_members.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can remove their own reactions"
  ON message_reactions FOR DELETE
  USING (user_id = auth.uid());

-- Direct messages policies
CREATE POLICY "Users can view their direct message channels"
  ON direct_message_channels FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM direct_message_participants
    WHERE direct_message_participants.channel_id = direct_message_channels.id
    AND direct_message_participants.user_id = auth.uid()
  ));

CREATE POLICY "Users can view direct messages in their channels"
  ON direct_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM direct_message_participants
    WHERE direct_message_participants.channel_id = direct_messages.channel_id
    AND direct_message_participants.user_id = auth.uid()
  ));

CREATE POLICY "Users can send direct messages in their channels"
  ON direct_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM direct_message_participants
      WHERE direct_message_participants.channel_id = direct_messages.channel_id
      AND direct_message_participants.user_id = auth.uid()
    )
  );

-- User profiles policies
CREATE POLICY "Users can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create their own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (user_id = auth.uid());

-- Channel members policies
CREATE POLICY "Users can view channel members"
  ON channel_members FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM team_members
    JOIN channels ON channels.team_id = team_members.team_id
    WHERE channels.id = channel_members.channel_id
    AND team_members.user_id = auth.uid()
  ));

CREATE POLICY "Allow channel member creation through create_team_with_channel function"
  ON channel_members FOR INSERT
  WITH CHECK (true);

-- Create indexes
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_channel_members_channel_id ON channel_members(channel_id);
CREATE INDEX idx_channel_members_user_id ON channel_members(user_id);
CREATE INDEX idx_messages_channel_id ON messages(channel_id);
CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_parent_id ON messages(parent_id);
CREATE INDEX idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX idx_message_reactions_user_id ON message_reactions(user_id);
CREATE INDEX idx_direct_messages_channel_id ON direct_messages(channel_id);
CREATE INDEX idx_direct_messages_sender_id ON direct_messages(sender_id);
CREATE INDEX idx_direct_message_reactions_message_id ON direct_message_reactions(message_id);
CREATE INDEX idx_direct_message_reactions_user_id ON direct_message_reactions(user_id); 