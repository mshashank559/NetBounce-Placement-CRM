-- Enable RLS on performas (if not already enabled)
ALTER TABLE public.performas ENABLE ROW LEVEL SECURITY;

-- Drop any existing RLS policies for performas to avoid conflicts
DROP POLICY IF EXISTS "Accountants and Admins can insert performas" ON public.performas;
DROP POLICY IF EXISTS "Accountants and Admins can update performas" ON public.performas;
DROP POLICY IF EXISTS "Users can view performas" ON public.performas;
DROP POLICY IF EXISTS "Users can view relevant performas" ON public.performas;
DROP POLICY IF EXISTS "Admins can delete performas" ON public.performas;

-- Create policies

-- 1. Selection: Admins, Accountants, Process Analysts, and relevant Sales/Lead roles can view
CREATE POLICY "Users can view relevant performas" ON public.performas
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'ADMIN')
    OR public.has_role(auth.uid(), 'PROCESS_ANALYST')
    OR public.has_role(auth.uid(), 'ACCOUNTANT')
    OR public.has_role(auth.uid(), 'LEAD_TL')
    OR public.has_role(auth.uid(), 'LEAD_GEN')
    OR (public.has_role(auth.uid(), 'SALES_TL') AND EXISTS (
      SELECT 1 FROM public.leads WHERE unique_id = performas.lead_id AND (team_lead_id = auth.uid() OR assigned_to = auth.uid())
    ))
    OR EXISTS (
      SELECT 1 FROM public.leads WHERE unique_id = performas.lead_id AND (assigned_to = auth.uid() OR lead_generated_by = auth.uid())
    )
  );

-- 2. Insertion: Accountants and Admins can insert
CREATE POLICY "Accountants and Admins can insert performas" ON public.performas
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'ACCOUNTANT')
    OR public.has_role(auth.uid(), 'ADMIN')
  );

-- 3. Updation: Accountants and Admins can update
CREATE POLICY "Accountants and Admins can update performas" ON public.performas
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'ACCOUNTANT')
    OR public.has_role(auth.uid(), 'ADMIN')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'ACCOUNTANT')
    OR public.has_role(auth.uid(), 'ADMIN')
  );

-- 4. Deletion: Only Admins can delete
CREATE POLICY "Admins can delete performas" ON public.performas
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'ADMIN')
  );
