-- Migration: Update update_user_by_admin RPC to handle force-logout + audit log
-- Replaces the old RPC with a version that, when password is changed:
--   1. Updates the encrypted password (existing behaviour)
--   2. Stamps password_reset_at on profiles (detected by AuthContext polling)
--   3. Deletes all auth.sessions + refresh_tokens (invalidates refresh tokens)
--   4. Writes an entry to admin_audit_logs

CREATE OR REPLACE FUNCTION public.update_user_by_admin(
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
  caller_role      TEXT;
  caller_name      TEXT;
  t_user_name      TEXT;
  t_user_role      TEXT;
BEGIN
  -- 1. Verify the calling user is ADMIN
  SELECT role INTO caller_role
  FROM public.user_roles
  WHERE user_id = auth.uid();

  IF caller_role IS DISTINCT FROM 'ADMIN' THEN
    RAISE EXCEPTION 'Access denied: only ADMIN can update user credentials';
  END IF;

  -- 2. Update auth.users email (mark as confirmed immediately)
  IF new_email IS NOT NULL AND trim(new_email) != '' THEN
    UPDATE auth.users
    SET
      email              = trim(new_email),
      email_confirmed_at = NOW(),
      raw_user_meta_data = raw_user_meta_data || jsonb_build_object('email', trim(new_email))
    WHERE id = target_user_id;

    UPDATE public.profiles
    SET email = trim(new_email)
    WHERE user_id = target_user_id;
  END IF;

  -- 3. Update password + force-logout all sessions
  IF new_password IS NOT NULL AND trim(new_password) != '' THEN

    -- 3a. Hash and store new password
    UPDATE auth.users
    SET encrypted_password = crypt(trim(new_password), gen_salt('bf'))
    WHERE id = target_user_id;

    -- 3b. Stamp password_reset_at — AuthContext polls this every 30 s
    --     and signs the user out if the stamp is newer than their session start
    UPDATE public.profiles
    SET password_reset_at = NOW()
    WHERE user_id = target_user_id;

    -- 3c. Delete all active sessions and refresh tokens so old JWTs
    --     cannot be refreshed on any device
    DELETE FROM auth.sessions       WHERE user_id = target_user_id;
    DELETE FROM auth.refresh_tokens WHERE user_id = target_user_id;

    -- 3d. Gather names/role for the audit log
    SELECT full_name INTO caller_name
    FROM public.profiles WHERE user_id = auth.uid();

    SELECT full_name INTO t_user_name
    FROM public.profiles WHERE user_id = target_user_id;

    SELECT role INTO t_user_role
    FROM public.user_roles WHERE user_id = target_user_id;

    -- 3e. Write audit log entry
    INSERT INTO public.admin_audit_logs (
      target_user_id, target_user_name, target_user_role,
      admin_id,       admin_name,       action
    ) VALUES (
      target_user_id, t_user_name, t_user_role,
      auth.uid(),     caller_name, 'Password Reset – All Sessions Terminated'
    );
  END IF;

  -- 4. Update display name in profiles
  IF new_full_name IS NOT NULL AND trim(new_full_name) != '' THEN
    UPDATE public.profiles
    SET full_name = trim(new_full_name)
    WHERE user_id = target_user_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_user_by_admin(UUID, TEXT, TEXT, TEXT) TO authenticated;
