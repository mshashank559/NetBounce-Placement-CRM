-- 1. Ensure the nbc_id_seq sequence exists
CREATE SEQUENCE IF NOT EXISTS public.nbc_id_seq START WITH 1 INCREMENT BY 1;

-- 2. Clean up and rename duplicate display_id values in the database (keeping the oldest one unchanged)
DO $$
DECLARE
  r RECORD;
  new_id TEXT;
BEGIN
  FOR r IN 
    WITH ranked_leads AS (
      SELECT 
        unique_id, 
        display_id, 
        created_at,
        ROW_NUMBER() OVER (PARTITION BY display_id ORDER BY created_at ASC) as rn
      FROM public.leads
      WHERE display_id IS NOT NULL AND display_id ~ '^NBC[0-9]+$'
    )
    SELECT unique_id, display_id FROM ranked_leads WHERE rn > 1
  LOOP
    new_id := 'NBC' || LPAD(nextval('public.nbc_id_seq')::text, 3, '0');
    -- Keep looping if the generated ID already exists (should not happen if sequence is synced, but as a safeguard)
    WHILE EXISTS (SELECT 1 FROM public.leads WHERE display_id = new_id) LOOP
      new_id := 'NBC' || LPAD(nextval('public.nbc_id_seq')::text, 3, '0');
    END LOOP;
    
    UPDATE public.leads SET display_id = new_id WHERE unique_id = r.unique_id;
  END LOOP;
END;
$$;

-- 3. Synchronize sequence with the maximum display_id number currently in the database
SELECT setval('public.nbc_id_seq', COALESCE(
  (SELECT MAX(CAST(SUBSTRING(display_id FROM 4) AS INTEGER)) 
   FROM public.leads 
   WHERE display_id ~ '^NBC[0-9]+$'), 
  0
));

-- 4. Update the generate_nbc_id trigger function to only assign a new ID if display_id is NULL
CREATE OR REPLACE FUNCTION public.generate_nbc_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.display_id IS NULL THEN
    NEW.display_id := 'NBC' || LPAD(nextval('public.nbc_id_seq')::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Re-create the BEFORE INSERT trigger to auto-assign NBC ID
DROP TRIGGER IF EXISTS set_nbc_id ON public.leads;
CREATE TRIGGER set_nbc_id
  BEFORE INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_nbc_id();

-- 6. Enforce a database-level UNIQUE constraint on the display_id column
-- First drop any existing constraints/indexes to avoid conflicts, then add the constraint
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_display_id_key;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_display_id_unique;
ALTER TABLE public.leads ADD CONSTRAINT leads_display_id_unique UNIQUE (display_id);
