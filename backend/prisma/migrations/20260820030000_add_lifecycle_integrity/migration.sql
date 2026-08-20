-- Add period-level claim identity so a scholar can only be billed once per academic period.
ALTER TABLE "payroll_claims"
  ADD COLUMN IF NOT EXISTS "academic_period_id" INTEGER;

WITH ranked_claims AS (
  SELECT
    claim."id",
    batch."billing_period_id",
    ROW_NUMBER() OVER (
      PARTITION BY claim."applicant_id", batch."billing_period_id"
      ORDER BY claim."updated_at" DESC, claim."id" DESC
    ) AS row_number
  FROM "payroll_claims" AS claim
  JOIN "payroll_batches" AS batch ON claim."payroll_batch_id" = batch."id"
  WHERE claim."academic_period_id" IS NULL
)
UPDATE "payroll_claims" AS claim
SET "academic_period_id" = ranked_claims."billing_period_id"
FROM ranked_claims
WHERE claim."id" = ranked_claims."id"
  AND ranked_claims.row_number = 1;

CREATE UNIQUE INDEX IF NOT EXISTS "payroll_claims_applicant_id_academic_period_id_key"
  ON "payroll_claims"("applicant_id", "academic_period_id");

-- Targeted portal notifications are separate from audience-wide announcements.
CREATE TABLE IF NOT EXISTS "scholar_notifications" (
  "id" SERIAL PRIMARY KEY,
  "applicant_id" INTEGER NOT NULL,
  "academic_period_id" INTEGER,
  "payroll_claim_id" INTEGER,
  "notification_type" VARCHAR(50) NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "message" TEXT NOT NULL,
  "reference" VARCHAR(100),
  "amount" DECIMAL(12,2),
  "is_read" BOOLEAN NOT NULL DEFAULT false,
  "read_at" TIMESTAMP(6),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "scholar_notifications_payroll_claim_id_notification_type_key"
  ON "scholar_notifications"("payroll_claim_id", "notification_type");
CREATE INDEX IF NOT EXISTS "scholar_notifications_applicant_id_created_at_idx"
  ON "scholar_notifications"("applicant_id", "created_at");
CREATE INDEX IF NOT EXISTS "scholar_notifications_applicant_id_is_read_idx"
  ON "scholar_notifications"("applicant_id", "is_read");

DO $$ BEGIN
  ALTER TABLE "scholar_notifications"
    ADD CONSTRAINT "scholar_notifications_applicant_id_fkey"
    FOREIGN KEY ("applicant_id") REFERENCES "applicants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "scholar_notifications"
    ADD CONSTRAINT "scholar_notifications_academic_period_id_fkey"
    FOREIGN KEY ("academic_period_id") REFERENCES "academic_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "scholar_notifications"
    ADD CONSTRAINT "scholar_notifications_payroll_claim_id_fkey"
    FOREIGN KEY ("payroll_claim_id") REFERENCES "payroll_claims"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
