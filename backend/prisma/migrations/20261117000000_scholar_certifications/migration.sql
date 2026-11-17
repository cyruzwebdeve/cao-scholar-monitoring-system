BEGIN;
CREATE TABLE "scholar_certifications" (
  "id" SERIAL PRIMARY KEY,
  "applicant_id" INTEGER NOT NULL REFERENCES "applicants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  "scholar_account_id" INTEGER NOT NULL REFERENCES "scholar_accounts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  "academic_period_id" INTEGER NOT NULL REFERENCES "academic_periods"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  "reference_number" VARCHAR(50) NOT NULL,
  "snapshot_hash" CHAR(64) NOT NULL,
  "template_version" VARCHAR(50) NOT NULL,
  "snapshot" JSONB NOT NULL,
  "generated_at" TIMESTAMP(6) NOT NULL,
  "generated_by" INTEGER NOT NULL REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  "generated_by_role" VARCHAR(30) NOT NULL,
  "file_name" VARCHAR(255) NOT NULL,
  "file_type" VARCHAR(30) NOT NULL,
  "file_data" TEXT,
  "file_url" TEXT,
  "file_pathname" TEXT,
  "storage" VARCHAR(30) NOT NULL,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "scholar_certifications_hash_check" CHECK ("snapshot_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "scholar_certifications_pdf_check" CHECK ("file_type" = 'application/pdf'),
  CONSTRAINT "scholar_certifications_snapshot_check" CHECK (jsonb_typeof("snapshot") = 'object'),
  CONSTRAINT "scholar_certifications_staff_check" CHECK ("generated_by_role" IN ('SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin')),
  CONSTRAINT "scholar_certifications_storage_check" CHECK (
    ("storage" = 'database' AND "file_data" IS NOT NULL AND "file_url" IS NULL AND "file_pathname" IS NULL)
    OR ("storage" = 'vercel-blob-private' AND "file_data" IS NULL AND "file_url" IS NOT NULL AND "file_pathname" IS NOT NULL)
  )
);
CREATE UNIQUE INDEX "scholar_certifications_snapshot_key" ON "scholar_certifications"("scholar_account_id", "academic_period_id", "snapshot_hash");
CREATE INDEX "scholar_certifications_applicant_id_generated_at_idx" ON "scholar_certifications"("applicant_id", "generated_at");
CREATE INDEX "scholar_certifications_academic_period_id_idx" ON "scholar_certifications"("academic_period_id");
COMMIT;
