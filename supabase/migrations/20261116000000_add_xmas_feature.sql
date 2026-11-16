-- ==============================================================================
-- Migration: Add Xmas Plan, Xmas Lead Status, and Marketing Start Tracking
-- ==============================================================================

-- 1. Add 'Xmas' to lead_status ENUM if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'Xmas' 
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lead_status')
  ) THEN
    ALTER TYPE public.lead_status ADD VALUE 'Xmas';
  END IF;
END $$;

-- 2. Add 'Xmas' to plan_type ENUM if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'Xmas' 
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'plan_type')
  ) THEN
    ALTER TYPE public.plan_type ADD VALUE 'Xmas';
  END IF;
END $$;

-- 3. Add marketing columns to leads table for timer tracking
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS marketing_start BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_started_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS xmas_expired_notified BOOLEAN DEFAULT false;

-- 4. Create index on leads(lead_status) and leads(marketing_started_at) for fast KPI counting
CREATE INDEX IF NOT EXISTS idx_leads_marketing_started_at ON public.leads(marketing_started_at);
