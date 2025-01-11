-- Grant necessary permissions for auth
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT SELECT ON auth.users TO anon, authenticated;

-- Ensure auth schema is in search path
ALTER DATABASE postgres SET search_path TO public, auth;

-- Grant permissions on the users view
GRANT SELECT ON public.users TO anon, authenticated;

-- Enable RLS on necessary tables
ALTER TABLE auth.users FORCE ROW LEVEL SECURITY;

-- Create policies for auth tables
CREATE POLICY "Public users are viewable by everyone."
    ON auth.users FOR SELECT
    TO authenticated, anon
    USING (true);

-- Ensure proper permissions for user profiles
GRANT SELECT ON public.user_profiles TO anon, authenticated;
GRANT INSERT, UPDATE ON public.user_profiles TO authenticated;

-- Enable RLS on user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for user_profiles
CREATE POLICY "Users can view all profiles"
    ON public.user_profiles FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Users can update own profile"
    ON public.user_profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
    ON public.user_profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id); 