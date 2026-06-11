-- Update the generate_nbc_id trigger function to prevent sequence desync
CREATE OR REPLACE FUNCTION public.generate_nbc_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  custom_num INT;
BEGIN
  -- If the client provided a custom display_id, synchronize the sequence to it
  IF NEW.display_id IS NOT NULL AND NEW.display_id ~ '^NBC[0-9]+$' THEN
    custom_num := CAST(SUBSTRING(NEW.display_id FROM 4) AS INTEGER);
    -- Set the sequence value to this custom_num so subsequent auto-inserts continue from here
    PERFORM setval('public.nbc_id_seq', custom_num, true);
  ELSE
    -- Otherwise, automatically assign the next value from the sequence
    NEW.display_id := 'NBC' || LPAD(nextval('public.nbc_id_seq')::text, 3, '0');
  END IF;
  
  RETURN NEW;
END;
$$;
