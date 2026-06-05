-- Migration: Admin RPC to update user email, password, and full_name
-- Uses SECURITY DEFINER so it runs with elevated privileges server-side
-- Only callable by users with ADMIN role

CREATE OR REPLACE FUNCTION update_user_by_admin(
  target_user_id  UUID,
  new_email       TEXT    DEFAULT NULL,
  new_password    TEXT    DEFAULT NULL,
  new_full_name   TEXT    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  -- 1. Verify the calling user is ADMIN
  SELECT role INTO caller_role
  FROM user_roles
  WHERE user_id = auth.uid();

  IF caller_role IS DISTINCT FROM 'ADMIN' THEN
    RAISE EXCEPTION 'Access denied: only ADMIN can update user credentials';
  END IF;

  -- 2. Update auth.users email (and mark as confirmed immediately)
  IF new_email IS NOT NULL AND trim(new_email) != '' THEN
    UPDATE auth.users
    SET
      email                = trim(new_email),
      email_confirmed_at   = NOW(),
      raw_user_meta_data   = raw_user_meta_data || jsonb_build_object('email', trim(new_email))
    WHERE id = target_user_id;

    -- Mirror email in profiles table so all UI references update automatically
    UPDATE profiles
    SET email = trim(new_email)
    WHERE user_id = target_user_id;
  END IF;

  -- 3. Update password (hashed via pgcrypto — available by default in Supabase)
  IF new_password IS NOT NULL AND trim(new_password) != '' THEN
    UPDATE auth.users
    SET encrypted_password = crypt(trim(new_password), gen_salt('bf'))
    WHERE id = target_user_id;
  END IF;

  -- 4. Update display name in profiles
  IF new_full_name IS NOT NULL AND trim(new_full_name) != '' THEN
    UPDATE profiles
    SET full_name = trim(new_full_name)
    WHERE user_id = target_user_id;
  END IF;
END;
$$;

-- Grant execute only to authenticated users (the function itself enforces ADMIN check internally)
GRANT EXECUTE ON FUNCTION update_user_by_admin(UUID, TEXT, TEXT, TEXT) TO authenticated;
