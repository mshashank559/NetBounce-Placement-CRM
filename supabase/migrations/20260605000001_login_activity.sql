-- Create login_activity table to track user login/logout events
CREATE TABLE IF NOT EXISTS public.login_activity (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_in_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  logged_out_at TIMESTAMPTZ NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: Only admins can read all rows; users can insert/update their own
ALTER TABLE public.login_activity ENABLE ROW LEVEL SECURITY;

-- Admin can read everything
CREATE POLICY "Admin reads all login activity"
  ON public.login_activity FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Any authenticated user can insert their own login record
CREATE POLICY "Users can insert own login"
  ON public.login_activity FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Any authenticated user can update their own logout record
CREATE POLICY "Users can update own logout"
  ON public.login_activity FOR UPDATE
  USING (user_id = auth.uid());
