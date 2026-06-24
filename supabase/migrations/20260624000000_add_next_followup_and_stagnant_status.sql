-- 1. Add 'Stagnant' to public.lead_status enum
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'Stagnant';

-- 2. Add next_followup_date to public.leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS next_followup_date DATE;

-- 3. Create security definer function to scan and auto-mark stagnant leads
CREATE OR REPLACE FUNCTION public.update_stagnant_leads()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r RECORD;
  system_user_id UUID;
BEGIN
  -- Retrieve a valid admin user ID to act as system editor
  SELECT user_id INTO system_user_id 
  FROM public.user_roles 
  WHERE role = 'ADMIN' 
  LIMIT 1;

  -- Fallback: Use the first available user profile if no Admin exists
  IF system_user_id IS NULL THEN
    SELECT user_id INTO system_user_id 
    FROM public.profiles 
    LIMIT 1;
  END IF;

  -- Iterate through active leads whose next follow-up date has passed
  FOR r IN 
    SELECT unique_id, lead_status, assigned_to, name 
    FROM public.leads 
    WHERE next_followup_date < CURRENT_DATE 
      AND lead_status NOT IN ('Closed', 'Non Interested', 'Stagnant')
  LOOP
    -- Update lead status to Stagnant
    UPDATE public.leads 
    SET lead_status = 'Stagnant' 
    WHERE unique_id = r.unique_id;

    -- Log this automatic change to lead history
    INSERT INTO public.lead_history_logs (lead_id, changed_by, action_type, old_value, new_value, comments)
    VALUES (
      r.unique_id, 
      COALESCE(auth.uid(), system_user_id, r.assigned_to), 
      'STATUS_CHANGE', 
      r.lead_status, 
      'Stagnant', 
      'Automatically marked Stagnant due to missed follow-up.'
    );

    -- Dispatch notification to the assigned salesperson
    IF r.assigned_to IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, lead_id)
      VALUES (
        r.assigned_to, 
        '⚠️ Lead Stagnant', 
        'Lead "' || r.name || '" has been marked Stagnant due to missed follow-up.', 
        'stagnant', 
        r.unique_id
      );
    END IF;
  END LOOP;
END;
$$;

-- 4. Grant execution permissions on function
GRANT EXECUTE ON FUNCTION public.update_stagnant_leads() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_stagnant_leads() TO anon;
GRANT EXECUTE ON FUNCTION public.update_stagnant_leads() TO service_role;
