-- Create a secure function to fetch leads with single-evaluation role checks (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_leads_v2()
RETURNS TABLE (
  unique_id UUID,
  date TIMESTAMPTZ,
  name TEXT,
  email TEXT,
  phone TEXT,
  university TEXT,
  technology TEXT,
  linkedin_url TEXT,
  time_for_call TEXT,
  timezone TEXT,
  lead_category public.lead_category,
  lead_type public.lead_type,
  referee_name TEXT,
  lead_source TEXT,
  resume_url TEXT,
  comment TEXT,
  concern BOOLEAN,
  lead_status public.lead_status,
  lead_generated_by UUID,
  assigned_to UUID,
  highlight_color TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  visa_status TEXT,
  assigned_at TIMESTAMPTZ,
  next_followup TIMESTAMPTZ,
  team_lead_id UUID,
  display_id TEXT
) 
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
    SELECT 
      l.unique_id, l.date, l.name, l.email, l.phone, l.university, l.technology, 
      l.linkedin_url, l.time_for_call, l.timezone, l.lead_category, l.lead_type, 
      l.referee_name, l.lead_source, l.resume_url, l.comment, l.concern, 
      l.lead_status, l.lead_generated_by, l.assigned_to, l.highlight_color, 
      l.created_at, l.updated_at, l.visa_status, l.assigned_at, l.next_followup,
      l.team_lead_id, l.display_id
    FROM public.leads l;
  ELSIF current_user_role = 'LEAD_GEN' THEN
    RETURN QUERY 
    SELECT 
      l.unique_id, l.date, l.name, l.email, l.phone, l.university, l.technology, 
      l.linkedin_url, l.time_for_call, l.timezone, l.lead_category, l.lead_type, 
      l.referee_name, l.lead_source, l.resume_url, l.comment, l.concern, 
      l.lead_status, l.lead_generated_by, l.assigned_to, l.highlight_color, 
      l.created_at, l.updated_at, l.visa_status, l.assigned_at, l.next_followup,
      l.team_lead_id, l.display_id
    FROM public.leads l 
    WHERE l.lead_generated_by = current_user_id;
  ELSIF current_user_role = 'SALES_TM' THEN
    RETURN QUERY 
    SELECT 
      l.unique_id, l.date, l.name, l.email, l.phone, l.university, l.technology, 
      l.linkedin_url, l.time_for_call, l.timezone, l.lead_category, l.lead_type, 
      l.referee_name, l.lead_source, l.resume_url, l.comment, l.concern, 
      l.lead_status, l.lead_generated_by, l.assigned_to, l.highlight_color, 
      l.created_at, l.updated_at, l.visa_status, l.assigned_at, l.next_followup,
      l.team_lead_id, l.display_id
    FROM public.leads l 
    WHERE l.assigned_to = current_user_id OR l.lead_generated_by = current_user_id;
  ELSE
    RETURN;
  END IF;
END;
$$;
