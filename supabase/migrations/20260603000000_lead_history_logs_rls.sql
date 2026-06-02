-- Enable RLS on lead_history_logs (if not already enabled)
ALTER TABLE public.lead_history_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow authenticated read to lead_history_logs" ON public.lead_history_logs;
DROP POLICY IF EXISTS "Allow authenticated insert to lead_history_logs" ON public.lead_history_logs;

-- Create policies for lead_history_logs

-- 1. Select policy: Allow authenticated users to view logs
CREATE POLICY "Allow authenticated read to lead_history_logs" 
ON public.lead_history_logs 
FOR SELECT 
TO authenticated 
USING (true);

-- 2. Insert policy: Allow authenticated users to insert logs under their own ID
CREATE POLICY "Allow authenticated insert to lead_history_logs" 
ON public.lead_history_logs 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = changed_by);
