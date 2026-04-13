
-- Add Stripe to payment_mode enum
ALTER TYPE public.payment_mode ADD VALUE IF NOT EXISTS 'Stripe';

-- Add display_id column for NBC### format
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS display_id text UNIQUE;

-- Create sequence for NBC IDs
CREATE SEQUENCE IF NOT EXISTS public.nbc_id_seq START WITH 1 INCREMENT BY 1;

-- Create function to generate NBC display ID
CREATE OR REPLACE FUNCTION public.generate_nbc_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.display_id := 'NBC' || LPAD(nextval('public.nbc_id_seq')::text, 3, '0');
  RETURN NEW;
END;
$$;

-- Create trigger to auto-assign NBC ID on insert
DROP TRIGGER IF EXISTS set_nbc_id ON public.leads;
CREATE TRIGGER set_nbc_id
  BEFORE INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_nbc_id();

-- Backfill existing leads with NBC IDs
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT unique_id FROM public.leads WHERE display_id IS NULL ORDER BY created_at ASC
  LOOP
    UPDATE public.leads SET display_id = 'NBC' || LPAD(nextval('public.nbc_id_seq')::text, 3, '0') WHERE unique_id = r.unique_id;
  END LOOP;
END;
$$;
