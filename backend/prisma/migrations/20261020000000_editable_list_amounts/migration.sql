BEGIN;
-- Null preserves the current Public/Private defaults. Older ignored billing_amount
-- values do not silently become overrides; only an explicit staff edit opts in.
ALTER TABLE scholar_requirements
  ADD COLUMN list_amount_override NUMERIC(10,2),
  ADD CONSTRAINT scholar_list_amount_valid CHECK (list_amount_override IS NULL OR list_amount_override >= 0);
ALTER TABLE scholar_requirements DROP CONSTRAINT private_grant_preparation_valid;
ALTER TABLE scholar_requirements ADD CONSTRAINT private_grant_preparation_valid CHECK (
  (tuition_fee_assistance IS NULL AND grant_prepared_at IS NULL AND grant_prepared_by IS NULL)
  OR (tuition_fee_assistance IS NOT NULL AND tuition_fee_assistance >= 0
      AND tuition_fee_assistance <= COALESCE(list_amount_override, 5000)
      AND grant_prepared_at IS NOT NULL AND grant_prepared_by IS NOT NULL)
);
-- Legacy table names remain official list snapshots, without release/receipt actions.
ALTER TABLE payroll_claims DROP CONSTRAINT private_list_breakdown_valid;
ALTER TABLE payroll_claims ADD CONSTRAINT private_list_breakdown_valid CHECK (
  (tuition_fee_assistance IS NULL AND allowance IS NULL)
  OR (tuition_fee_assistance IS NOT NULL AND allowance IS NOT NULL
      AND tuition_fee_assistance >= 0 AND allowance >= 0 AND claim_amount >= 0
      AND tuition_fee_assistance + allowance = claim_amount)
);
COMMIT;
