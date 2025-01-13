-- Add status column to user_profiles
ALTER TABLE user_profiles
ADD COLUMN status text NOT NULL DEFAULT 'online';

-- Add status_updated_at column to track when status was last updated
ALTER TABLE user_profiles
ADD COLUMN status_updated_at timestamp with time zone DEFAULT timezone('utc'::text, now());

-- Create an index on status for faster queries
CREATE INDEX user_profiles_status_idx ON user_profiles(status);

-- Update RLS policies to allow users to update their own status
CREATE POLICY "Users can update their own status"
  ON user_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id); 