ALTER TABLE "scholar_requirements"
  ADD COLUMN IF NOT EXISTS "billing_reference" VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "billing_school_year" VARCHAR(9),
  ADD COLUMN IF NOT EXISTS "billing_semester" VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "billing_status" VARCHAR(30) NOT NULL DEFAULT 'Pending';

UPDATE "scholar_requirements" AS requirement
SET
  "billing_reference" = COALESCE(requirement."billing_reference", 'BILL-' || LPAD(requirement."id"::text, 8, '0')),
  "billing_school_year" = COALESCE(requirement."billing_school_year", period."school_year"),
  "billing_semester" = COALESCE(requirement."billing_semester", period."semester")
FROM "academic_periods" AS period
WHERE period."id" = requirement."billing_period_id";

UPDATE "scholar_requirements"
SET "billing_reference" = 'BILL-' || LPAD("id"::text, 8, '0')
WHERE "billing_reference" IS NULL;

ALTER TABLE "scholar_requirements"
  ALTER COLUMN "billing_reference" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "scholar_requirements_billing_reference_key"
  ON "scholar_requirements"("billing_reference");
