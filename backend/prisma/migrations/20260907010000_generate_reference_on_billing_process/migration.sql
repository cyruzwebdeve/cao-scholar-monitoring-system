-- A billing reference identifies the billing batch created by Process Billing.
-- It is intentionally absent before processing and may be shared by scholars
-- included in the same billing batch.
DROP INDEX IF EXISTS "scholar_requirements_billing_reference_key";

ALTER TABLE "scholar_requirements"
  ALTER COLUMN "billing_reference" DROP DEFAULT,
  ALTER COLUMN "billing_reference" DROP NOT NULL;

UPDATE "scholar_requirements" AS requirement
SET "billing_reference" = batch."batch_number"
FROM "payroll_claims" AS claim
JOIN "payroll_batches" AS batch ON batch."id" = claim."payroll_batch_id"
WHERE claim."applicant_id" = requirement."applicant_id"
  AND batch."billing_period_id" = requirement."billing_period_id"
  AND (batch."batch_number" LIKE 'BILL-%' OR LOWER(batch."status") = 'billed');

UPDATE "scholar_requirements" AS requirement
SET "billing_reference" = NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM "payroll_claims" AS claim
  JOIN "payroll_batches" AS batch ON batch."id" = claim."payroll_batch_id"
  WHERE claim."applicant_id" = requirement."applicant_id"
    AND batch."billing_period_id" = requirement."billing_period_id"
    AND (batch."batch_number" LIKE 'BILL-%' OR LOWER(batch."status") = 'billed')
);

CREATE INDEX IF NOT EXISTS "scholar_requirements_billing_reference_idx"
  ON "scholar_requirements"("billing_reference");
