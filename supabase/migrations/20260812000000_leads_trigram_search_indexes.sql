-- Enable pg_trgm extension for fast text pattern and substring searches
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN trigram indexes on key searchable columns
CREATE INDEX IF NOT EXISTS idx_leads_name_trgm ON public.leads USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_display_id_trgm ON public.leads USING gin (display_id gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_phone_trgm ON public.leads USING gin (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_email_trgm ON public.leads USING gin (email gin_trgm_ops);
