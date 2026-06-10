-- Create trigger function to clean up unassigned notifications when a lead gets assigned
CREATE OR REPLACE FUNCTION public.cleanup_unassigned_lead_notifications()
RETURNS TRIGGER AS $$
BEGIN
  -- If the lead got assigned to someone (assigned_to is not null)
  IF NEW.assigned_to IS NOT NULL THEN
    DELETE FROM public.notifications
    WHERE lead_id = NEW.unique_id AND type = 'lead_unassigned';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop trigger if it already exists
DROP TRIGGER IF EXISTS trigger_cleanup_unassigned_notifications ON public.leads;

-- Create trigger to run after update of assigned_to on leads table
CREATE TRIGGER trigger_cleanup_unassigned_notifications
  AFTER UPDATE OF assigned_to ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_unassigned_lead_notifications();
