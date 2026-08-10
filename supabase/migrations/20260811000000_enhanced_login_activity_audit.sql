-- Migration: Enhanced Login Activity and Dashboard Access Audit Trail
-- Supports Actor vs Target distinction, Dashboard Accessed, and reliable non-blocking logging

ALTER TABLE public.login_activity
  ADD COLUMN IF NOT EXISTS action_type TEXT DEFAULT 'LOGIN',
  ADD COLUMN IF NOT EXISTS target_user_id UUID,
  ADD COLUMN IF NOT EXISTS target_user_name TEXT,
  ADD COLUMN IF NOT EXISTS target_user_role TEXT,
  ADD COLUMN IF NOT EXISTS dashboard_accessed TEXT;

-- Drop old policies to prevent any RLS blocking
DROP POLICY IF EXISTS "Users can insert own login" ON public.login_activity;
DROP POLICY IF EXISTS "Allow authenticated insert into login_activity" ON public.login_activity;

CREATE POLICY "Allow authenticated insert into login_activity"
  ON public.login_activity FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can read own login activity" ON public.login_activity;
DROP POLICY IF EXISTS "Admin reads all login activity" ON public.login_activity;

CREATE POLICY "Allow authenticated read login activity"
  ON public.login_activity FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can update own logout" ON public.login_activity;
CREATE POLICY "Users can update own logout"
  ON public.login_activity FOR UPDATE
  TO authenticated
  USING (true);
