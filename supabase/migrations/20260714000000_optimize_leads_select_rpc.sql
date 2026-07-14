-- Drop existing function if any to avoid return type signature conflicts
DROP FUNCTION IF EXISTS public.get_leads_v2();

-- Create a secure function to fetch leads with single-evaluation role checks (SECURITY DEFINER)
-- Using RETURNS SETOF public.leads ensures it always matches the database table schema exactly
CREATE OR REPLACE FUNCTION public.get_leads_v2()
RETURNS SETOF public.leads
LANGUAGE plpgsql
SECURITY DEFINER -- Bypasses RLS to query all records, performing authorization checks once
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  current_user_role TEXT;
BEGIN
  -- Get active user role as text
  SELECT role::text INTO current_user_role 
  FROM public.user_roles 
  WHERE user_id = current_user_id 
  LIMIT 1;

  -- Return rows based on role (evaluates criteria once, not per row)
  IF current_user_role = 'ADMIN' OR current_user_role = 'PROCESS_ANALYST' OR current_user_role = 'LEAD_TL' OR current_user_role = 'SALES_TL' THEN
    RETURN QUERY 
    SELECT *
    FROM public.leads;
  ELSIF current_user_role = 'LEAD_GEN' THEN
    RETURN QUERY 
    SELECT *
    FROM public.leads l 
    WHERE l.lead_generated_by = current_user_id;
  ELSIF current_user_role = 'SALES_TM' THEN
    RETURN QUERY 
    SELECT *
    FROM public.leads l 
    WHERE l.assigned_to = current_user_id OR l.lead_generated_by = current_user_id;
  ELSE
    RETURN;
  END IF;
END;
$$;
