-- Create a function to confirm user emails
CREATE OR REPLACE FUNCTION confirm_user_email(user_id uuid, email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  -- Update the user's email_confirmed_at timestamp
  UPDATE auth.users
  SET email_confirmed_at = now(),
      updated_at = now()
  WHERE id = user_id
  AND email = email
  AND email_confirmed_at IS NULL;
END;
$$; 