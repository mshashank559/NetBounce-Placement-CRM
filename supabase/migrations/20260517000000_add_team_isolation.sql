
-- Add team_lead_id to leads to track which TL owns the lead even if assigned to a TM
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS team_lead_id UUID REFERENCES auth.users(id);

-- Add reports_to to profiles to establish hierarchy
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reports_to UUID REFERENCES auth.users(id);

-- Update RLS for leads to restrict Sales TL visibility
DROP POLICY IF EXISTS "Users can view relevant leads" ON public.leads;
CREATE POLICY "Users can view relevant leads" ON public.leads FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'ADMIN')
    OR public.has_role(auth.uid(), 'PROCESS_ANALYST')
    OR public.has_role(auth.uid(), 'LEAD_TL')
    OR (public.has_role(auth.uid(), 'SALES_TL') AND (team_lead_id = auth.uid() OR assigned_to = auth.uid()))
    OR (public.has_role(auth.uid(), 'LEAD_GEN') AND lead_generated_by = auth.uid())
    OR (public.has_role(auth.uid(), 'SALES_TM') AND (assigned_to = auth.uid() OR lead_generated_by = auth.uid()))
  );

-- Update RLS for call_logs
DROP POLICY IF EXISTS "Users can view own call logs" ON public.call_logs;
CREATE POLICY "Users can view relevant call logs" ON public.call_logs FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id 
    OR public.has_role(auth.uid(), 'ADMIN') 
    OR (public.has_role(auth.uid(), 'SALES_TL') AND EXISTS (
        SELECT 1 FROM public.leads WHERE unique_id = call_logs.lead_id AND (team_lead_id = auth.uid() OR assigned_to = auth.uid())
    ))
  );

-- Update RLS for lead_closures
DROP POLICY IF EXISTS "Authenticated can view closures" ON public.lead_closures;
CREATE POLICY "Users can view relevant closures" ON public.lead_closures FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'ADMIN')
    OR (public.has_role(auth.uid(), 'SALES_TL') AND EXISTS (
        SELECT 1 FROM public.leads WHERE unique_id = lead_closures.lead_id AND (team_lead_id = auth.uid() OR assigned_to = auth.uid())
    ))
    OR EXISTS (
        SELECT 1 FROM public.leads WHERE unique_id = lead_closures.lead_id AND (assigned_to = auth.uid() OR lead_generated_by = auth.uid())
    )
  );

-- Backfill existing leads: if assigned_to is a SALES_TL, set it as team_lead_id
UPDATE public.leads 
SET team_lead_id = assigned_to 
WHERE team_lead_id IS NULL 
AND assigned_to IS NOT NULL 
AND public.has_role(assigned_to, 'SALES_TL');
