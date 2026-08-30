-- Store immutable, versioned decision-support snapshots without automating
-- the authorized staff member's final scholarship decision.
CREATE TABLE IF NOT EXISTS "eligibility_assessments" (
  "id" SERIAL PRIMARY KEY,
  "applicant_id" INTEGER NOT NULL,
  "application_id" INTEGER NOT NULL,
  "result_id" INTEGER,
  "academic_period_id" INTEGER,
  "policy_version" VARCHAR(40) NOT NULL,
  "policy_name" VARCHAR(150) NOT NULL,
  "recommendation" VARCHAR(40) NOT NULL,
  "total_score" DECIMAL(6,2),
  "max_score" INTEGER NOT NULL DEFAULT 100,
  "threshold_score" INTEGER NOT NULL,
  "summary" TEXT NOT NULL,
  "scorecard" JSONB NOT NULL,
  "input_snapshot" JSONB NOT NULL,
  "generated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_by" INTEGER,
  "review_decision" VARCHAR(30),
  "review_reason" TEXT,
  "reviewed_at" TIMESTAMP(6)
);

CREATE INDEX IF NOT EXISTS "eligibility_assessments_applicant_id_generated_at_idx"
  ON "eligibility_assessments"("applicant_id", "generated_at");
CREATE INDEX IF NOT EXISTS "eligibility_assessments_application_id_idx"
  ON "eligibility_assessments"("application_id");
CREATE INDEX IF NOT EXISTS "eligibility_assessments_result_id_idx"
  ON "eligibility_assessments"("result_id");
CREATE INDEX IF NOT EXISTS "eligibility_assessments_policy_version_idx"
  ON "eligibility_assessments"("policy_version");

DO $$ BEGIN
  ALTER TABLE "eligibility_assessments"
    ADD CONSTRAINT "eligibility_assessments_applicant_id_fkey"
    FOREIGN KEY ("applicant_id") REFERENCES "applicants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "eligibility_assessments"
    ADD CONSTRAINT "eligibility_assessments_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "application_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "eligibility_assessments"
    ADD CONSTRAINT "eligibility_assessments_result_id_fkey"
    FOREIGN KEY ("result_id") REFERENCES "results"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "eligibility_assessments"
    ADD CONSTRAINT "eligibility_assessments_academic_period_id_fkey"
    FOREIGN KEY ("academic_period_id") REFERENCES "academic_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "eligibility_assessments"
    ADD CONSTRAINT "eligibility_assessments_reviewed_by_fkey"
    FOREIGN KEY ("reviewed_by") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
