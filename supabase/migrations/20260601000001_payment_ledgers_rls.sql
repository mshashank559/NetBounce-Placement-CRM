-- Enable RLS on payment_ledgers (if not already enabled)
ALTER TABLE public.payment_ledgers ENABLE ROW LEVEL SECURITY;

-- Drop any existing RLS policies for payment_ledgers to avoid conflicts
DROP POLICY IF EXISTS "Accountants and Admins can insert payment ledgers" ON public.payment_ledgers;
DROP POLICY IF EXISTS "Accountants and Admins can update payment ledgers" ON public.payment_ledgers;
DROP POLICY IF EXISTS "Users can view payment ledgers" ON public.payment_ledgers;
DROP POLICY IF EXISTS "Users can view relevant payment ledgers" ON public.payment_ledgers;
DROP POLICY IF EXISTS "Admins can delete payment ledgers" ON public.payment_ledgers;

-- Create policies

-- 1. Selection: Admins, Accountants, Process Analysts, and relevant Sales TL/TMs can view
CREATE POLICY "Users can view relevant payment ledgers" ON public.payment_ledgers
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'ADMIN')
    OR public.has_role(auth.uid(), 'PROCESS_ANALYST')
    OR public.has_role(auth.uid(), 'ACCOUNTANT')
    -- Sales Team Leads can view ledgers for leads in their team
    OR (public.has_role(auth.uid(), 'SALES_TL') AND EXISTS (
      SELECT 1 FROM public.leads WHERE unique_id = payment_ledgers.lead_id AND (team_lead_id = auth.uid() OR assigned_to = auth.uid())
    ))
    -- Sales TMs can view ledgers for their own assigned leads
    OR EXISTS (
      SELECT 1 FROM public.leads WHERE unique_id = payment_ledgers.lead_id AND assigned_to = auth.uid()
    )
  );

-- 2. Insertion: Accountants and Admins can insert
CREATE POLICY "Accountants and Admins can insert payment ledgers" ON public.payment_ledgers
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'ACCOUNTANT')
    OR public.has_role(auth.uid(), 'ADMIN')
  );

-- 3. Updation: Accountants and Admins can update
CREATE POLICY "Accountants and Admins can update payment ledgers" ON public.payment_ledgers
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
CREATE POLICY "Admins can delete payment ledgers" ON public.payment_ledgers
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'ADMIN')
  );
