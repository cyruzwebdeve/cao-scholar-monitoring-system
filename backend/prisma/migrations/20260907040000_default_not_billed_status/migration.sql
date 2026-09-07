ALTER TABLE "scholar_requirements"
  ALTER COLUMN "billing_status" SET DEFAULT 'Not billed yet';

UPDATE "scholar_requirements" AS requirement
SET "billing_status" = 'Not billed yet'
WHERE requirement."billing_status" = 'Pending'
  AND NOT EXISTS (
    SELECT 1
    FROM "payroll_claims" AS claim
    WHERE claim."applicant_id" = requirement."applicant_id"
      AND claim."academic_period_id" = requirement."billing_period_id"
  );
