-- Migration: Weekend Access Passes for Sales & BD Roles
-- Allows Admin to grant temporary weekend/extended access to specific users
-- Expirations automatically unlock or lock based on valid_until timestamp

CREATE TABLE IF NOT EXISTS public.weekend_access_passes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by   UUID        REFERENCES auth.users(id),
  granted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until  TIMESTAMPTZ NOT NULL,
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.weekend_access_passes ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view active passes (for session validation)
CREATE POLICY "Authenticated users can view weekend access passes"
  ON public.weekend_access_passes FOR SELECT
  TO authenticated
  USING (true);

-- Allow Admins full control over weekend access passes
CREATE POLICY "Admins can insert weekend access passes"
  ON public.weekend_access_passes FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Admins can update weekend access passes"
  ON public.weekend_access_passes FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Admins can delete weekend access passes"
  ON public.weekend_access_passes FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'));
