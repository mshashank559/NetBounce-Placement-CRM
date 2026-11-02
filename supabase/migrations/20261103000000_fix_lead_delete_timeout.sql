-- Migration: Fix Lead Deletion Timeout and Missing Foreign Key Indexes
-- Date: 2026-11-03

-- 1. Create missing indexes on all foreign key columns referencing leads(unique_id)
-- When a lead is deleted, Postgres must inspect child tables for CASCADE deletion.
-- Without indexes on lead_id, Postgres performs sequential table scans on massive tables,
-- which exceeds the query statement timeout (cancelling statement due to statement timeout).

CREATE INDEX IF NOT EXISTS idx_concerns_lead_id ON public.concerns(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_history_logs_lead_id ON public.lead_history_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_performas_lead_id ON public.performas(lead_id);
CREATE INDEX IF NOT EXISTS idx_payment_ledgers_lead_id ON public.payment_ledgers(lead_id);
CREATE INDEX IF NOT EXISTS idx_notifications_lead_id ON public.notifications(lead_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_lead_id ON public.call_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_followups_lead_id ON public.followups(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_closures_lead_id ON public.lead_closures(lead_id);

-- Also index compound (created_at DESC, unique_id DESC) on leads for fast pagination
CREATE INDEX IF NOT EXISTS idx_leads_created_at_unique_id ON public.leads(created_at DESC, unique_id DESC);

-- 2. Optimize the DELETE RLS policy on public.leads
-- Avoid using slow scalar functions row-by-row; check role directly via EXISTS
DROP POLICY IF EXISTS "Admins can do anything with leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can delete leads" ON public.leads;
DROP POLICY IF EXISTS "Users can manage leads" ON public.leads;

-- Re-create ADMIN ALL policy with fast direct EXISTS
CREATE POLICY "Admins can do anything with leads" ON public.leads
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'ADMIN'
    )
  );

-- 3. Provide an atomic, fast RPC function to delete a lead with high performance
-- This function runs as SECURITY DEFINER with search_path = public,
-- verifies the caller is an ADMIN, and deletes related rows in order before deleting the lead itself.
CREATE OR REPLACE FUNCTION public.delete_lead_by_admin(target_lead_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id UUID := auth.uid();
  is_admin BOOLEAN;
  deleted_lead_name TEXT;
BEGIN
  -- Verify the caller is an ADMIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = caller_id AND role = 'ADMIN'
  ) INTO is_admin;

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Access denied. Only administrators can delete leads.';
  END IF;

  -- Verify lead exists and fetch name
  SELECT name INTO deleted_lead_name
  FROM public.leads
  WHERE unique_id = target_lead_id;

  IF deleted_lead_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Lead not found or already deleted');
  END IF;

  -- Explicitly clean up related records quickly
  DELETE FROM public.notifications WHERE lead_id = target_lead_id;
  DELETE FROM public.lead_history_logs WHERE lead_id = target_lead_id;
  DELETE FROM public.concerns WHERE lead_id = target_lead_id;
  DELETE FROM public.call_logs WHERE lead_id = target_lead_id;
  DELETE FROM public.followups WHERE lead_id = target_lead_id;
  DELETE FROM public.performas WHERE lead_id = target_lead_id;
  DELETE FROM public.payment_ledgers WHERE lead_id = target_lead_id;
  DELETE FROM public.lead_closures WHERE lead_id = target_lead_id;

  -- Delete the lead
  DELETE FROM public.leads WHERE unique_id = target_lead_id;

  RETURN jsonb_build_object('success', true, 'lead_name', deleted_lead_name);
END;
$$;

-- Grant execute privileges
GRANT EXECUTE ON FUNCTION public.delete_lead_by_admin(UUID) TO authenticated;

