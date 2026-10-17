-- Informational schedules only; no fund-release or claiming state.
CREATE TABLE "payout_schedules" (
  "id" SERIAL PRIMARY KEY,
  "payroll_batch_id" INTEGER NOT NULL REFERENCES "payroll_batches"("id") ON DELETE RESTRICT,
  "title" VARCHAR(160) NOT NULL,
  "starts_at" TIMESTAMP(6) NOT NULL,
  "ends_at" TIMESTAMP(6),
  "venue" VARCHAR(250) NOT NULL,
  "instructions" TEXT NOT NULL DEFAULT '',
  "status" VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK ("status" IN ('draft','published','cancelled')),
  "cancellation_reason" TEXT NOT NULL DEFAULT '',
  "revision" INTEGER NOT NULL DEFAULT 1,
  "created_by" INTEGER NOT NULL REFERENCES "admins"("id") ON DELETE RESTRICT,
  "updated_by" INTEGER NOT NULL REFERENCES "admins"("id") ON DELETE RESTRICT,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("ends_at" IS NULL OR "ends_at" > "starts_at")
);
CREATE INDEX "payout_schedules_payroll_batch_id_idx" ON "payout_schedules"("payroll_batch_id");
CREATE INDEX "payout_schedules_status_starts_at_idx" ON "payout_schedules"("status", "starts_at");
CREATE TABLE "payout_schedule_recipients" (
  "schedule_id" INTEGER NOT NULL REFERENCES "payout_schedules"("id") ON DELETE CASCADE,
  "payroll_batch_id" INTEGER NOT NULL REFERENCES "payroll_batches"("id") ON DELETE RESTRICT,
  "applicant_id" INTEGER NOT NULL REFERENCES "applicants"("id") ON DELETE RESTRICT,
  "active" BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY ("schedule_id", "applicant_id")
);
CREATE INDEX "payout_schedule_recipients_applicant_id_idx" ON "payout_schedule_recipients"("applicant_id");
-- A Scholar may have only one published schedule per batch; cancellation frees the slot.
CREATE UNIQUE INDEX "payout_schedule_one_active_recipient" ON "payout_schedule_recipients"("payroll_batch_id", "applicant_id") WHERE "active";
