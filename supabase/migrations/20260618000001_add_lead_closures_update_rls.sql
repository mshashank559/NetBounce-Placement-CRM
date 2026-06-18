-- Drop existing update policy if it exists
DROP POLICY IF EXISTS "Sales can update closures" ON public.lead_closures;

-- Create policy to allow authenticated users with appropriate roles to update closures
CREATE POLICY "Sales can update closures" ON public.lead_closures
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'ADMIN')
    OR public.has_role(auth.uid(), 'SALES_TM')
    OR public.has_role(auth.uid(), 'SALES_TL')
  );
