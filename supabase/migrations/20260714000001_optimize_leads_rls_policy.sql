-- Drop the old slow SELECT policy that uses public.has_role()
DROP POLICY IF EXISTS "Users can view relevant leads" ON public.leads;

-- Create the optimized SELECT policy using a single inline EXISTS subquery
-- This avoids row-by-row function switching overhead and makes queries extremely fast.
CREATE POLICY "Users can view relevant leads" ON public.leads FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
        AND (
          ur.role IN ('ADMIN', 'PROCESS_ANALYST', 'LEAD_TL', 'SALES_TL', 'ACCOUNTANT')
          OR (ur.role = 'LEAD_GEN' AND leads.lead_generated_by = auth.uid())
          OR (ur.role = 'SALES_TM' AND (leads.assigned_to = auth.uid() OR leads.lead_generated_by = auth.uid()))
        )
    )
  );
