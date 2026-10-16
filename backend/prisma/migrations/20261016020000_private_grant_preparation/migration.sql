ALTER TABLE scholar_requirements
 ADD COLUMN tuition_fee_assistance NUMERIC(10,2),
 ADD COLUMN grant_prepared_at TIMESTAMP(6),
 ADD COLUMN grant_prepared_by INTEGER REFERENCES admins(id) ON DELETE RESTRICT,
 ADD CONSTRAINT private_grant_preparation_valid CHECK (
  (tuition_fee_assistance IS NULL AND grant_prepared_at IS NULL AND grant_prepared_by IS NULL)
  OR (tuition_fee_assistance IS NOT NULL AND tuition_fee_assistance BETWEEN 0 AND 5000 AND grant_prepared_at IS NOT NULL AND grant_prepared_by IS NOT NULL)
 );
-- Legacy tables continue to store official list membership, not payment release.
-- Old list records intentionally keep NULL breakdowns: no historical amounts invented.
ALTER TABLE payroll_claims
 ADD COLUMN tuition_fee_assistance NUMERIC(10,2),
 ADD COLUMN allowance NUMERIC(10,2),
 ADD CONSTRAINT private_list_breakdown_valid CHECK (
  (tuition_fee_assistance IS NULL AND allowance IS NULL)
  OR (tuition_fee_assistance IS NOT NULL AND allowance IS NOT NULL AND tuition_fee_assistance BETWEEN 0 AND 5000 AND allowance >= 0 AND claim_amount = 5000 AND tuition_fee_assistance + allowance = claim_amount)
 );
