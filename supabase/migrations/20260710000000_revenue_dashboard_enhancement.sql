-- 1. Create the secure RPC function to get lead closures with server-side masking
CREATE OR REPLACE FUNCTION public.get_revenue_closures_v2(view_type TEXT)
RETURNS TABLE (
  id UUID,
  lead_id UUID,
  plan public.plan_type,
  interview_plan BOOLEAN,
  upfront_amount NUMERIC,
  slot1 BOOLEAN,
  slot1_amount NUMERIC,
  slot1_due_date DATE,
  slot2 BOOLEAN,
  slot2_amount NUMERIC,
  next_slot_due_date DATE,
  payment_mode public.payment_mode,
  additional_slots JSONB,
  created_at TIMESTAMPTZ,
  -- Lead fields
  candidate_name TEXT,
  lead_source TEXT,
  assigned_to UUID,
  sales_person_name TEXT,
  team_lead_id UUID,
  lead_generated_by UUID
) 
LANGUAGE plpgsql
SECURITY DEFINER -- Bypasses RLS to query all records, performing logic-based masking
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  current_user_role TEXT;
  is_admin_or_accounts BOOLEAN;
BEGIN
  -- Retrieve active user role as text for safer comparisons
  SELECT role::text INTO current_user_role 
  FROM public.user_roles 
  WHERE user_id = current_user_id 
  LIMIT 1;

  is_admin_or_accounts := (current_user_role = 'ADMIN' OR current_user_role = 'ACCOUNTANT');

  RETURN QUERY
  SELECT 
    lc.id,
    lc.lead_id,
    
    -- Plan details masking (Masked if Restricted View & NOT Admin/Accountant/Owner/TL)
    CASE 
      WHEN view_type = 'restricted_view' 
           AND NOT is_admin_or_accounts
           AND l.assigned_to != current_user_id 
           AND l.lead_generated_by != current_user_id 
           AND (l.team_lead_id IS NULL OR l.team_lead_id != current_user_id)
      THEN NULL -- Masked
      ELSE lc.plan
    END AS plan,

    lc.interview_plan,

    -- Upfront amount masking
    CASE 
      WHEN view_type = 'restricted_view' 
           AND NOT is_admin_or_accounts
           AND l.assigned_to != current_user_id 
           AND l.lead_generated_by != current_user_id 
           AND (l.team_lead_id IS NULL OR l.team_lead_id != current_user_id)
      THEN 0 -- Masked
      ELSE lc.upfront_amount
    END AS upfront_amount,

    lc.slot1,

    -- Slot 1 amount masking
    CASE 
      WHEN view_type = 'restricted_view' 
           AND NOT is_admin_or_accounts
           AND l.assigned_to != current_user_id 
           AND l.lead_generated_by != current_user_id 
           AND (l.team_lead_id IS NULL OR l.team_lead_id != current_user_id)
      THEN 0 -- Masked
      ELSE COALESCE(lc.slot1_amount, 0)
    END AS slot1_amount,

    lc.slot1_due_date,
    lc.slot2,

    -- Slot 2 amount masking
    CASE 
      WHEN view_type = 'restricted_view' 
           AND NOT is_admin_or_accounts
           AND l.assigned_to != current_user_id 
           AND l.lead_generated_by != current_user_id 
           AND (l.team_lead_id IS NULL OR l.team_lead_id != current_user_id)
      THEN 0 -- Masked
      ELSE COALESCE(lc.slot2_amount, 0)
    END AS slot2_amount,

    lc.next_slot_due_date,
    lc.payment_mode,

    -- Additional slots masking
    CASE 
      WHEN view_type = 'restricted_view' 
           AND NOT is_admin_or_accounts
           AND l.assigned_to != current_user_id 
           AND l.lead_generated_by != current_user_id 
           AND (l.team_lead_id IS NULL OR l.team_lead_id != current_user_id)
      THEN '[]'::jsonb -- Masked
      ELSE COALESCE(lc.additional_slots, '[]'::jsonb)
    END AS additional_slots,

    lc.created_at,
    l.name AS candidate_name,
    l.lead_source,
    l.assigned_to,
    p.full_name AS sales_person_name,
    l.team_lead_id,
    l.lead_generated_by
  FROM public.lead_closures lc
  JOIN public.leads l ON lc.lead_id = l.unique_id
  LEFT JOIN public.profiles p ON l.assigned_to = p.user_id
  LEFT JOIN public.profiles p_sub ON l.assigned_to = p_sub.user_id
  WHERE 
    -- 1. My View: Only personal records
    (view_type = 'my_view' AND (l.assigned_to = current_user_id OR l.lead_generated_by = current_user_id))
    OR
    -- 2. Team View: My team + personal records (only for TL or Admin/Accountant)
    (view_type = 'team_view' AND (
      is_admin_or_accounts
      OR (
        (current_user_role = 'SALES_TL' OR current_user_role = 'LEAD_TL') 
        AND (l.team_lead_id = current_user_id OR l.assigned_to = current_user_id OR p.reports_to = current_user_id)
      )
    ))
    OR
    -- 3. Restricted View (Global View): Everyone, but values are dynamically masked
    (view_type = 'restricted_view');
END;
$$;

-- 2. Enable broad SELECT visibility on lead_closures so the RPC/metadata can query it 
DROP POLICY IF EXISTS "Users can view relevant closures" ON public.lead_closures;
CREATE POLICY "Users can view relevant closures" ON public.lead_closures 
  FOR SELECT TO authenticated USING (true);

-- 3. Update policy for modifying closures to restrict to owners and Admin/Accountants
DROP POLICY IF EXISTS "Sales can update closures" ON public.lead_closures;
CREATE POLICY "Sales can update closures" ON public.lead_closures
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'ADMIN')
    OR public.has_role(auth.uid(), 'ACCOUNTANT')
    OR EXISTS (
      SELECT 1 FROM public.leads 
      WHERE unique_id = lead_closures.lead_id 
        AND (assigned_to = auth.uid() OR lead_generated_by = auth.uid())
    )
  );

-- 4. Create delete policy to restrict deletion to owners and Admin/Accountants
DROP POLICY IF EXISTS "Sales can delete closures" ON public.lead_closures;
CREATE POLICY "Sales can delete closures" ON public.lead_closures
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'ADMIN')
    OR public.has_role(auth.uid(), 'ACCOUNTANT')
    OR EXISTS (
      SELECT 1 FROM public.leads 
      WHERE unique_id = lead_closures.lead_id 
        AND (assigned_to = auth.uid() OR lead_generated_by = auth.uid())
    )
  );
