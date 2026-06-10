-- 1. Ensure the nbc_id_seq sequence exists
CREATE SEQUENCE IF NOT EXISTS public.nbc_id_seq START WITH 1 INCREMENT BY 1;

-- 2. Temporarily disable the UNIQUE constraint to allow re-ordering without collisions
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_display_id_key;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_display_id_unique;

-- 3. Clean up and rename duplicate display_id values from the recent batch chronologically starting from NBC301
DO $$
DECLARE
  r RECORD;
  counter INTEGER := 301;
  new_id TEXT;
BEGIN
  -- Re-assign IDs for all leads created on or after Bindu's creation time (2026-06-10 20:59:00 UTC) in chronological order.
  -- This ensures Bindu gets NBC301, Lakhan Patel gets NBC302, Chakrinee gets NBC303, Ketan gets NBC304, and Shreyansh gets NBC305.
  FOR r IN 
    SELECT unique_id 
    FROM public.leads 
    WHERE created_at >= '2026-06-10 20:59:00+00' 
    ORDER BY created_at ASC
  LOOP
    new_id := 'NBC' || LPAD(counter::text, 3, '0');
    UPDATE public.leads SET display_id = new_id WHERE unique_id = r.unique_id;
    counter := counter + 1;
  END LOOP;

  -- 4. Synchronize sequence with the maximum display_id number currently in the database
  PERFORM setval('public.nbc_id_seq', COALESCE(
    (SELECT MAX(CAST(SUBSTRING(display_id FROM 4) AS INTEGER)) 
     FROM public.leads 
     WHERE display_id ~ '^NBC[0-9]+$'), 
    0
  ));
END;
$$;

-- 5. Update the generate_nbc_id trigger function to only assign a new ID if display_id is NULL
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

-- 6. Re-create the BEFORE INSERT trigger to auto-assign NBC ID
DROP TRIGGER IF EXISTS set_nbc_id ON public.leads;
CREATE TRIGGER set_nbc_id
  BEFORE INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_nbc_id();

-- 7. Enforce a database-level UNIQUE constraint on the display_id column
ALTER TABLE public.leads ADD CONSTRAINT leads_display_id_unique UNIQUE (display_id);
