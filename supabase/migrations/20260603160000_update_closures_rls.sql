-- Drop existing select policy for lead_closures
DROP POLICY IF EXISTS "Users can view relevant closures" ON public.lead_closures;

-- Create updated select policy that permits all authenticated users to view closures for leads they have access to view
CREATE POLICY "Users can view relevant closures" ON public.lead_closures 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.leads WHERE unique_id = lead_closures.lead_id
  )
);
