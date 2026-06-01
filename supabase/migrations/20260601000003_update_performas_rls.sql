-- 1. Drop existing insert policy on performas
DROP POLICY IF EXISTS "Accountants and Admins can insert performas" ON public.performas;

-- 2. Create updated insert policy including SALES_TL and SALES_TM
CREATE POLICY "Authorized roles can insert performas" ON public.performas
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'ACCOUNTANT')
    OR public.has_role(auth.uid(), 'ADMIN')
    OR public.has_role(auth.uid(), 'SALES_TL')
    OR public.has_role(auth.uid(), 'SALES_TM')
  );

-- 3. Drop existing update policy on performas
DROP POLICY IF EXISTS "Accountants and Admins can update performas" ON public.performas;

-- 4. Create updated update policy including SALES_TL and SALES_TM
CREATE POLICY "Authorized roles can update performas" ON public.performas
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'ACCOUNTANT')
    OR public.has_role(auth.uid(), 'ADMIN')
    OR public.has_role(auth.uid(), 'SALES_TL')
    OR public.has_role(auth.uid(), 'SALES_TM')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'ACCOUNTANT')
    OR public.has_role(auth.uid(), 'ADMIN')
    OR public.has_role(auth.uid(), 'SALES_TL')
    OR public.has_role(auth.uid(), 'SALES_TM')
  );
