-- Add additional_slots JSONB column to lead_closures table to support dynamic payment slots
ALTER TABLE public.lead_closures ADD COLUMN IF NOT EXISTS additional_slots JSONB DEFAULT '[]'::jsonb;
