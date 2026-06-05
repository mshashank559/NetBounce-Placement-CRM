-- Migration: Denormalize user info into login_activity so the Admin panel
-- never depends on a separate profile lookup (fixes empty Member/Role for non-admin users)

ALTER TABLE public.login_activity
  ADD COLUMN IF NOT EXISTS user_name  TEXT,
  ADD COLUMN IF NOT EXISTS user_email TEXT,
  ADD COLUMN IF NOT EXISTS user_role  TEXT;
