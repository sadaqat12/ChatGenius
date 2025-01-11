-- Reset search path to include auth schema
ALTER DATABASE postgres SET search_path TO "$user", public, auth, extensions;
ALTER ROLE authenticated SET search_path TO "$user", public, auth, extensions;
ALTER ROLE anon SET search_path TO "$user", public, auth, extensions;
ALTER ROLE service_role SET search_path TO "$user", public, auth, extensions;

-- Reset session search path
SET search_path TO "$user", public, auth, extensions;

-- Grant necessary permissions for auth
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
GRANT SELECT ON auth.users TO anon, authenticated, service_role;

-- Grant permissions for JWT generation
GRANT EXECUTE ON FUNCTION auth.email() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated;

-- Grant permissions on the users view
GRANT SELECT ON public.users TO anon, authenticated;

-- Ensure proper permissions for user profiles
GRANT SELECT ON public.user_profiles TO anon, authenticated;
GRANT INSERT, UPDATE ON public.user_profiles TO authenticated;

-- Enable RLS on user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for user_profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON public.user_profiles;
CREATE POLICY "Users can view all profiles"
    ON public.user_profiles FOR SELECT
    TO authenticated, anon
    USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile"
    ON public.user_profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
CREATE POLICY "Users can insert own profile"
    ON public.user_profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Ensure auth schema is accessible
GRANT USAGE ON SCHEMA auth TO postgres, anon, authenticated, service_role;

-- Grant access to auth functions
GRANT ALL ON ALL FUNCTIONS IN SCHEMA auth TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO postgres, anon, authenticated, service_role; 