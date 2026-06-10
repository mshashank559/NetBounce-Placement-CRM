-- Add assigned_at column to leads table if it doesn't exist
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE;

-- Create trigger function to update assigned_at whenever assigned_to changes
CREATE OR REPLACE FUNCTION update_lead_assigned_at()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) AND NEW.assigned_to IS NOT NULL THEN
    NEW.assigned_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it already exists to avoid errors on reapplying
DROP TRIGGER IF EXISTS trigger_update_lead_assigned_at ON leads;

-- Create trigger to run before update on leads table
CREATE TRIGGER trigger_update_lead_assigned_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_assigned_at();

-- Backfill assigned_at for already assigned leads using updated_at as a fallback
UPDATE leads 
SET assigned_at = updated_at 
WHERE assigned_to IS NOT NULL AND assigned_at IS NULL;
