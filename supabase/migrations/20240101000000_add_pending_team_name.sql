-- Add pending_team_name column to user_profiles
ALTER TABLE user_profiles
ADD COLUMN pending_team_name TEXT;

-- Update the create_team_with_channel function to handle null team names
CREATE OR REPLACE FUNCTION create_team_with_channel(team_name TEXT, user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_team_id UUID;
  new_channel_id UUID;
BEGIN
  -- Create the team
  INSERT INTO teams (name)
  VALUES (team_name)
  RETURNING id INTO new_team_id;

  -- Add the user as a team member with owner role
  INSERT INTO team_members (team_id, user_id, role)
  VALUES (new_team_id, user_id, 'owner');

  -- Create the general channel
  INSERT INTO channels (team_id, name, type)
  VALUES (new_team_id, 'general', 'public')
  RETURNING id INTO new_channel_id;

  -- Add the user to the channel
  INSERT INTO channel_members (channel_id, user_id)
  VALUES (new_channel_id, user_id);

  RETURN new_team_id;
END;
$$; 