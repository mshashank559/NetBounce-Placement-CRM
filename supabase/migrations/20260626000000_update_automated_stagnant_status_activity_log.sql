-- Drop the foreign key constraint on changed_by so that we can use the system UUID
ALTER TABLE public.lead_history_logs
DROP CONSTRAINT IF EXISTS lead_history_logs_changed_by_fkey;

-- Create or replace public.update_stagnant_leads function to log stagnant changes as "System"
CREATE OR REPLACE FUNCTION public.update_stagnant_leads()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r RECORD;
BEGIN
  -- Iterate through active leads whose next follow-up date has passed
  FOR r IN 
    SELECT unique_id, lead_status, assigned_to, name, next_followup_date 
    FROM public.leads 
    WHERE next_followup_date < CURRENT_DATE 
      AND lead_status NOT IN ('Closed', 'Non Interested', 'Stagnant')
  LOOP
    -- Update lead status to Stagnant
    UPDATE public.leads 
    SET lead_status = 'Stagnant' 
    WHERE unique_id = r.unique_id;

    -- Log this automatic change to lead history
    -- We use '00000000-0000-0000-0000-000000000000' as the system identifier.
    -- Since it does not correspond to any user profile, the UI (LeadDetailDialog and LeadHistorySidebar)
    -- will display 'System' as the author.
    INSERT INTO public.lead_history_logs (lead_id, changed_by, action_type, old_value, new_value, comments)
    VALUES (
      r.unique_id, 
      '00000000-0000-0000-0000-000000000000', 
      'STATUS_CHANGE', 
      r.lead_status, 
      'Stagnant', 
      'System Notification: Since no follow-up was recorded for ' || r.name || ' on the scheduled follow-up date (' || to_char(r.next_followup_date, 'FMDD Month YYYY') || '), this lead has been automatically marked as Stagnant. Kindly complete the follow-up to remove the Stagnant status.'
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

-- Grant execution permissions on function
GRANT EXECUTE ON FUNCTION public.update_stagnant_leads() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_stagnant_leads() TO anon;
GRANT EXECUTE ON FUNCTION public.update_stagnant_leads() TO service_role;

-- Clean up all historical automatic stagnant log entries to use System and the new template format
UPDATE public.lead_history_logs l
SET 
  changed_by = '00000000-0000-0000-0000-000000000000',
  comments = 'System Notification: Since no follow-up was recorded for ' || leads.name || ' on the scheduled follow-up date (' || COALESCE(to_char(leads.next_followup_date, 'FMDD Month YYYY'), 'N/A') || '), this lead has been automatically marked as Stagnant. Kindly complete the follow-up to remove the Stagnant status.'
FROM public.leads leads
WHERE l.lead_id = leads.unique_id
  AND l.new_value = 'Stagnant'
  AND l.comments = 'Automatically marked Stagnant due to missed follow-up.';

