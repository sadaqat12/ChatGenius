-- Drop existing profile policies
DROP POLICY IF EXISTS "Users can create their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Allow anonymous users to create profiles" ON user_profiles;

-- Create new policies that allow upsert
CREATE POLICY "Users can manage their own profile"
  ON user_profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow profile creation during signup"
  ON user_profiles FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Grant necessary permissions
GRANT ALL ON user_profiles TO authenticated;
GRANT INSERT ON user_profiles TO anon; 