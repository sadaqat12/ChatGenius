-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view teams they are members of" ON teams;
DROP POLICY IF EXISTS "Authenticated users can create teams" ON teams;
DROP POLICY IF EXISTS "Team admins can update their teams" ON teams;
DROP POLICY IF EXISTS "Users can view team members" ON team_members;
DROP POLICY IF EXISTS "Allow team member creation through create_team_with_channel function" ON team_members;
DROP POLICY IF EXISTS "Users can view channels they have access to" ON channels;
DROP POLICY IF EXISTS "Team members can create channels" ON channels;
DROP POLICY IF EXISTS "Users can view channel members" ON channel_members;
DROP POLICY IF EXISTS "Allow channel member creation through create_team_with_channel function" ON channel_members;
DROP POLICY IF EXISTS "Users can create their own profile" ON user_profiles;

-- Create or replace the create_team_with_channel function
CREATE OR REPLACE FUNCTION create_team_with_channel(team_name TEXT, user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  team_id UUID;
  channel_id UUID;
  user_exists BOOLEAN;
BEGIN
  -- First verify the user exists
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE id = user_id
  ) INTO user_exists;

  IF NOT user_exists THEN
    RAISE EXCEPTION 'User does not exist: %', user_id;
  END IF;

  -- Create team
  INSERT INTO teams (name, created_by)
  VALUES (team_name, user_id)
  RETURNING id INTO team_id;

  IF team_id IS NULL THEN
    RAISE EXCEPTION 'Failed to create team';
  END IF;

  -- Add creator as team member with admin role
  BEGIN
    INSERT INTO team_members (team_id, user_id, role)
    VALUES (team_id, user_id, 'admin');
  EXCEPTION WHEN OTHERS THEN
    -- If team member creation fails, delete the team and re-raise
    DELETE FROM teams WHERE id = team_id;
    RAISE EXCEPTION 'Failed to create team member: %', SQLERRM;
  END;

  -- Create general channel
  BEGIN
    INSERT INTO channels (name, team_id, created_by)
    VALUES ('general', team_id, user_id)
    RETURNING id INTO channel_id;

    IF channel_id IS NULL THEN
      -- If channel creation fails, delete team and team member
      DELETE FROM team_members WHERE team_id = team_id;
      DELETE FROM teams WHERE id = team_id;
      RAISE EXCEPTION 'Failed to create channel';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If channel creation fails, delete team and team member
    DELETE FROM team_members WHERE team_id = team_id;
    DELETE FROM teams WHERE id = team_id;
    RAISE EXCEPTION 'Failed to create channel: %', SQLERRM;
  END;

  -- Add creator as channel member
  BEGIN
    INSERT INTO channel_members (channel_id, user_id)
    VALUES (channel_id, user_id);
  EXCEPTION WHEN OTHERS THEN
    -- If channel member creation fails, delete everything
    DELETE FROM channels WHERE id = channel_id;
    DELETE FROM team_members WHERE team_id = team_id;
    DELETE FROM teams WHERE id = team_id;
    RAISE EXCEPTION 'Failed to create channel member: %', SQLERRM;
  END;

  RETURN team_id;
END;
$$;

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
  USING (
    -- User can view team members if they are a member of the team
    team_id IN (
      SELECT tm.team_id 
      FROM team_members tm 
      WHERE tm.user_id = auth.uid()
    )
  );

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

-- User profiles policies
CREATE POLICY "Users can create their own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id); 