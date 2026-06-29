-- Migration: Force Logout on Admin Password Reset
-- Adds password_reset_at to profiles for immediate client-side session detection
-- Adds admin_audit_logs table for audit trail of administrative password changes

-- 1. Add password_reset_at column to profiles
--    Updated by the Edge Function whenever an admin resets a user's password.
--    AuthContext polls this value; if it's newer than the client session start time,
--    the user is immediately signed out with the security message.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS password_reset_at TIMESTAMPTZ NULL;

-- 2. Create admin_audit_logs table
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_name  TEXT,
  target_user_role  TEXT,
  admin_id          UUID        NOT NULL REFERENCES auth.users(id),
  admin_name        TEXT,
  action            TEXT        NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Enable RLS on admin_audit_logs
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- 4. Only ADMINs can read audit logs
CREATE POLICY "Admins can view audit logs"
  ON public.admin_audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'ADMIN'
    )
  );

-- 5. Helper SQL function to delete all auth sessions for a user.
--    Called from the Edge Function (via supabaseAdmin.rpc) to immediately
--    invalidate all refresh tokens so the user cannot obtain new access tokens.
--    SECURITY DEFINER grants access to the auth schema.
CREATE OR REPLACE FUNCTION public.admin_delete_user_sessions(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  -- Verify the calling user is ADMIN (defence-in-depth; Edge Function also checks)
  SELECT role INTO caller_role
  FROM public.user_roles
  WHERE user_id = auth.uid();

  IF caller_role IS DISTINCT FROM 'ADMIN' THEN
    RAISE EXCEPTION 'Access denied: only ADMIN can delete user sessions';
  END IF;

  DELETE FROM auth.sessions WHERE user_id = target_user_id;
  DELETE FROM auth.refresh_tokens WHERE user_id = target_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_user_sessions(UUID) TO authenticated;
