-- Add generated_by_name column to preserve creator name permanently even if user account is deleted
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS generated_by_name TEXT;

-- Backfill existing leads with creator full name from profiles
UPDATE public.leads l
SET generated_by_name = p.full_name
FROM public.profiles p
WHERE l.lead_generated_by = p.user_id
  AND (l.generated_by_name IS NULL OR l.generated_by_name = '');
