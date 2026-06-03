-- Create the lead closures revenue view
CREATE OR REPLACE VIEW public.lead_closures_revenue AS
SELECT 
  lc.id AS closure_id,
  lc.lead_id,
  l.assigned_to,
  l.lead_generated_by,
  l.team_lead_id,
  lc.created_at,
  -- Collected revenue (Upfront + paid slots)
  (
    COALESCE(lc.upfront_amount, 0) +
    (CASE WHEN lc.slot1 = true THEN COALESCE(lc.slot1_amount, 0) ELSE 0 END) +
    (CASE WHEN lc.slot2 = true THEN COALESCE(lc.slot2_amount, 0) ELSE 0 END) +
    COALESCE((
      SELECT SUM((elem->>'amount')::NUMERIC)
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(lc.additional_slots) = 'array' THEN lc.additional_slots ELSE '[]'::jsonb END) AS elem
      WHERE (elem->>'paid')::BOOLEAN = true
    ), 0)
  ) AS collected_revenue,
  
  -- Pending slots (active but unpaid slots)
  (
    (CASE WHEN lc.slot1 = false OR lc.slot1 IS NULL THEN COALESCE(lc.slot1_amount, 0) ELSE 0 END) +
    (CASE WHEN lc.slot2 = false OR lc.slot2 IS NULL THEN COALESCE(lc.slot2_amount, 0) ELSE 0 END) +
    COALESCE((
      SELECT SUM((elem->>'amount')::NUMERIC)
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(lc.additional_slots) = 'array' THEN lc.additional_slots ELSE '[]'::jsonb END) AS elem
      WHERE (elem->>'paid')::BOOLEAN = false OR (elem->>'paid') IS NULL
    ), 0)
  ) AS pending_revenue,
  
  -- Upfront amount
  COALESCE(lc.upfront_amount, 0) AS upfront_amount
FROM public.lead_closures lc
JOIN public.leads l ON lc.lead_id = l.unique_id;

-- Grant permissions
GRANT SELECT ON public.lead_closures_revenue TO authenticated;

-- Create the get_revenue_stats secure RPC function
CREATE OR REPLACE FUNCTION public.get_revenue_stats(
  p_month_filter TEXT DEFAULT NULL, -- 'YYYY-MM' or 'MM' or NULL
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_year_filter INT DEFAULT NULL,
  p_view_mode TEXT DEFAULT 'team',
  p_assigned_to UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_result JSON;
  v_total_revenue NUMERIC := 0;
  v_upfront_collected NUMERIC := 0;
  v_pending_slots NUMERIC := 0;
  v_sales_revenue NUMERIC := 0;
  v_lead_gen_revenue NUMERIC := 0;
  v_monthly_data JSON;
  v_filter_user_ids UUID[] := '{}';
  v_sales_team_ids UUID[] := '{}';
  v_lead_gen_team_ids UUID[] := '{}';
  v_is_filtered_users BOOLEAN := false;
BEGIN
  -- Get the authenticated user ID
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get the user's role
  SELECT role INTO v_role
  FROM public.user_roles
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'User role not found';
  END IF;

  -- 1. Determine user filters based on view mode and inputs
  IF p_assigned_to IS NOT NULL THEN
    v_filter_user_ids := ARRAY[p_assigned_to];
    v_is_filtered_users := true;
  ELSIF p_view_mode = 'personal' THEN
    v_filter_user_ids := ARRAY[v_user_id];
    v_is_filtered_users := true;
  ELSIF p_view_mode = 'team' THEN
    IF v_role = 'SALES_TL' THEN
      SELECT COALESCE(array_agg(user_id), '{}'::UUID[])
      INTO v_filter_user_ids
      FROM public.profiles
      WHERE reports_to = v_user_id OR user_id = v_user_id;
      v_is_filtered_users := true;
    ELSIF v_role = 'SALES_TM' THEN
      v_filter_user_ids := ARRAY[v_user_id];
      v_is_filtered_users := true;
    END IF;
  ELSIF p_view_mode = 'global' THEN
    IF v_role NOT IN ('ADMIN', 'PROCESS_ANALYST') THEN
      -- Restrict to team if not admin/analyst
      SELECT COALESCE(array_agg(user_id), '{}'::UUID[])
      INTO v_filter_user_ids
      FROM public.profiles
      WHERE reports_to = v_user_id OR user_id = v_user_id;
      v_is_filtered_users := true;
    END IF;
  END IF;

  -- 2. Determine team categories for Admin/Process Analyst
  SELECT COALESCE(array_agg(user_id), '{}'::UUID[])
  INTO v_sales_team_ids
  FROM public.profiles
  WHERE team = 'Sales';

  SELECT COALESCE(array_agg(user_id), '{}'::UUID[])
  INTO v_lead_gen_team_ids
  FROM public.profiles
  WHERE team = 'Lead Gen';

  -- 3. Calculate metrics based on view
  SELECT 
    COALESCE(SUM(collected_revenue), 0),
    COALESCE(SUM(upfront_amount), 0),
    COALESCE(SUM(pending_revenue), 0)
  INTO 
    v_total_revenue,
    v_upfront_collected,
    v_pending_slots
  FROM public.lead_closures_revenue
  WHERE 
    -- Role/user based filtering
    (NOT v_is_filtered_users OR assigned_to = ANY(v_filter_user_ids))
    -- Date range / month filtering
    AND (
      p_month_filter IS NULL 
      OR (length(p_month_filter) = 7 AND to_char(created_at, 'YYYY-MM') = p_month_filter)
      OR (length(p_month_filter) <= 2 AND EXTRACT(MONTH FROM created_at) = p_month_filter::INT)
    )
    AND (p_start_date IS NULL OR created_at::DATE >= p_start_date)
    AND (p_end_date IS NULL OR created_at::DATE <= p_end_date)
    AND (p_year_filter IS NULL OR EXTRACT(YEAR FROM created_at) = p_year_filter);

  -- 4. Calculate Sales and Lead Gen team revenues for Admin
  SELECT COALESCE(SUM(collected_revenue), 0)
  INTO v_sales_revenue
  FROM public.lead_closures_revenue
  WHERE assigned_to = ANY(v_sales_team_ids)
    AND (
      p_month_filter IS NULL 
      OR (length(p_month_filter) = 7 AND to_char(created_at, 'YYYY-MM') = p_month_filter)
      OR (length(p_month_filter) <= 2 AND EXTRACT(MONTH FROM created_at) = p_month_filter::INT)
    )
    AND (p_start_date IS NULL OR created_at::DATE >= p_start_date)
    AND (p_end_date IS NULL OR created_at::DATE <= p_end_date);

  SELECT COALESCE(SUM(collected_revenue), 0)
  INTO v_lead_gen_revenue
  FROM public.lead_closures_revenue
  WHERE lead_generated_by = ANY(v_lead_gen_team_ids)
    AND (
      p_month_filter IS NULL 
      OR (length(p_month_filter) = 7 AND to_char(created_at, 'YYYY-MM') = p_month_filter)
      OR (length(p_month_filter) <= 2 AND EXTRACT(MONTH FROM created_at) = p_month_filter::INT)
    )
    AND (p_start_date IS NULL OR created_at::DATE >= p_start_date)
    AND (p_end_date IS NULL OR created_at::DATE <= p_end_date);

  -- 5. Calculate monthly breakdown for the year filter
  IF p_year_filter IS NOT NULL THEN
    SELECT json_agg(m)
    INTO v_monthly_data
    FROM (
      SELECT 
        to_char(gs.month_date, 'Mon') AS month_name,
        COALESCE(SUM(r.collected_revenue), 0) AS revenue
      FROM (
        SELECT generate_series(
          (p_year_filter || '-01-01')::DATE,
          (p_year_filter || '-12-31')::DATE,
          '1 month'::INTERVAL
        )::DATE AS month_date
      ) gs
      LEFT JOIN public.lead_closures_revenue r 
        ON EXTRACT(MONTH FROM r.created_at) = EXTRACT(MONTH FROM gs.month_date)
        AND EXTRACT(YEAR FROM r.created_at) = p_year_filter
        AND (NOT v_is_filtered_users OR r.assigned_to = ANY(v_filter_user_ids))
      GROUP BY gs.month_date
      ORDER BY gs.month_date
    ) m;
  ELSE
    v_monthly_data := '[]'::JSON;
  END IF;

  -- 6. Combine results
  v_result := json_build_object(
    'total_revenue', v_total_revenue,
    'upfront_collected', v_upfront_collected,
    'pending_slots', v_pending_slots,
    'sales_revenue', v_sales_revenue,
    'lead_gen_revenue', v_lead_gen_revenue,
    'monthly_breakdown', v_monthly_data
  );

  RETURN v_result;
END;
$$;
