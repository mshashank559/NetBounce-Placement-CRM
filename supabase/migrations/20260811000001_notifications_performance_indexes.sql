-- Performance indexes for notifications to prevent statement timeouts on large volumes
CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
ON public.notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read 
ON public.notifications(user_id, read);
