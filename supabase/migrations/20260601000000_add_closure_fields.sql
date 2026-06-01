-- Add new mandatory payment and slot date fields to lead_closures
ALTER TABLE public.lead_closures ADD COLUMN IF NOT EXISTS amount NUMERIC;
ALTER TABLE public.lead_closures ADD COLUMN IF NOT EXISTS percentage NUMERIC;
ALTER TABLE public.lead_closures ADD COLUMN IF NOT EXISTS slot1_due_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.lead_closures ADD COLUMN IF NOT EXISTS next_slot_due_date DATE;

-- Comments explaining columns
COMMENT ON COLUMN public.lead_closures.amount IS 'Mandatory closed status amount';
COMMENT ON COLUMN public.lead_closures.percentage IS 'Mandatory closed status percentage';
COMMENT ON COLUMN public.lead_closures.slot1_due_date IS 'Slot 1 payment due date (defaults to closure date)';
COMMENT ON COLUMN public.lead_closures.next_slot_due_date IS 'Next Slot payment due date (calendar selected)';
