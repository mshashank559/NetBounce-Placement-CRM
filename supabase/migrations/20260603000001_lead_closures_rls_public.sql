-- Drop the existing SELECT policy on lead_closures that restricts access by team
DROP POLICY IF EXISTS "Users can view relevant closures" ON public.lead_closures;

-- Create a new SELECT policy allowing all authenticated users to view closures
CREATE POLICY "Authenticated can view closures" ON public.lead_closures
  FOR SELECT TO authenticated
  USING (true);
