-- ============================================================
-- Admin Dashboard Stats RPC
-- Returns aggregated KPI stats in a single lightweight JSON call.
-- This replaces downloading thousands of raw rows to the client.
-- ============================================================

-- Drop if exists for idempotency
DROP FUNCTION IF EXISTS public.get_admin_dashboard_stats();

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_leads   BIGINT;
  v_pipeline      BIGINT;
  v_closures      BIGINT;
  v_revenue       NUMERIC;
  result          JSON;
BEGIN
  -- Total leads in the system
  SELECT COUNT(*) INTO v_total_leads
  FROM public.leads;

  -- Pipeline = leads NOT in a terminal state
  SELECT COUNT(*) INTO v_pipeline
  FROM public.leads
  WHERE lead_status NOT IN ('Closed', 'Non Interested');

  -- Closures count from lead_closures table
  SELECT COUNT(*) INTO v_closures
  FROM public.lead_closures;

  -- Revenue: sum of slot1_amount + slot2_amount + additional_slots paid amounts
  SELECT COALESCE(SUM(
    CASE WHEN slot1 = TRUE THEN COALESCE(slot1_amount, 0) ELSE 0 END
    + CASE WHEN slot2 = TRUE THEN COALESCE(slot2_amount, 0) ELSE 0 END
  ), 0) INTO v_revenue
  FROM public.lead_closures;

  -- Build and return the JSON result
  SELECT json_build_object(
    'totalLeads',   v_total_leads,
    'pipeline',     v_pipeline,
    'closures',     v_closures,
    'revenue',      v_revenue
  ) INTO result;

  RETURN result;
END;
$$;

-- Grant execute permission to authenticated users only
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats() TO authenticated;

-- ============================================================
-- Performance Indexes for Admin Dashboard queries
-- ============================================================

-- Speed up filtering by created_at (used in date range filters)
CREATE INDEX IF NOT EXISTS idx_leads_created_at
  ON public.leads (created_at DESC);

-- Speed up status-based counts (Pipeline, Closures KPIs)
CREATE INDEX IF NOT EXISTS idx_leads_lead_status
  ON public.leads (lead_status);

-- Speed up lead generation queries per user
CREATE INDEX IF NOT EXISTS idx_leads_lead_generated_by
  ON public.leads (lead_generated_by);

-- Speed up assignment queries per user
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to
  ON public.leads (assigned_to);

-- Speed up closure lookups
CREATE INDEX IF NOT EXISTS idx_lead_closures_created_at
  ON public.lead_closures (created_at DESC);

-- Speed up closure-to-lead joins
CREATE INDEX IF NOT EXISTS idx_lead_closures_lead_id
  ON public.lead_closures (lead_id);
