ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS section_access JSONB;

ALTER TABLE scholar_requirements
  ADD COLUMN IF NOT EXISTS billing_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS billing_notes TEXT;
