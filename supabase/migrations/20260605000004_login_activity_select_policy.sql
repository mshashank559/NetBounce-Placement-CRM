-- Migration: Allow users to read their own login activity records
-- This enables non-admin users to successfully get the ID of their newly created login row.

CREATE POLICY "Users can read own login activity"
  ON public.login_activity FOR SELECT
  USING (user_id = auth.uid());
