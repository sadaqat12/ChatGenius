-- Allow anonymous users to create profiles during signup
CREATE POLICY "Allow anonymous users to create profiles"
  ON user_profiles FOR INSERT
  TO anon
  WITH CHECK (true);

-- Grant insert permission to anonymous users
GRANT INSERT ON user_profiles TO anon; 