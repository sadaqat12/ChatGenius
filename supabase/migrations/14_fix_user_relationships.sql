-- Create a public schema reference to auth.users
CREATE OR REPLACE FUNCTION public.create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (user_id, name)
    VALUES (NEW.id, NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing foreign key constraints if they exist
ALTER TABLE IF EXISTS messages 
  DROP CONSTRAINT IF EXISTS messages_user_id_fkey;

ALTER TABLE IF EXISTS direct_message_participants 
  DROP CONSTRAINT IF EXISTS direct_message_participants_user_id_fkey;

-- Add foreign key constraints with proper references
ALTER TABLE messages
  ADD CONSTRAINT messages_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE direct_message_participants
  ADD CONSTRAINT direct_message_participants_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update the query permissions for PostgREST
GRANT USAGE ON SCHEMA auth TO postgres, anon, authenticated, service_role;
GRANT SELECT ON auth.users TO postgres, anon, authenticated, service_role;

-- Create a view to expose necessary user data
CREATE OR REPLACE VIEW public.users AS
SELECT 
  au.id,
  au.email,
  up.name,
  up.avatar_url
FROM auth.users au
LEFT JOIN public.user_profiles up ON up.user_id = au.id;

-- Grant access to the view
GRANT SELECT ON public.users TO postgres, anon, authenticated, service_role; 