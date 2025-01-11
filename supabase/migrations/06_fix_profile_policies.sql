-- First, drop existing policies
DROP POLICY IF EXISTS "Users can manage their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Allow profile creation during signup" ON user_profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Allow anonymous users to create profiles" ON user_profiles;

-- Create a single policy that allows both authenticated and anonymous users to create/update profiles
CREATE POLICY "Allow profile management"
  ON user_profiles
  FOR ALL
  USING (true)  -- This allows reading all profiles
  WITH CHECK (
    -- For inserts/updates, either:
    -- 1. The user is authenticated and managing their own profile
    -- 2. The user is anonymous (during signup)
    (auth.uid() IS NULL) OR (auth.uid() = user_id)
  );

-- Grant permissions
GRANT ALL ON user_profiles TO authenticated;
GRANT ALL ON user_profiles TO anon; 