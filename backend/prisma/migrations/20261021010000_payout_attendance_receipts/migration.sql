BEGIN;
-- Independent of recipient rows, which published schedule edits recreate.
CREATE TABLE "payout_schedule_attendance" (
  "schedule_id" INTEGER NOT NULL REFERENCES "payout_schedules"("id") ON DELETE RESTRICT,
  "applicant_id" INTEGER NOT NULL REFERENCES "applicants"("id") ON DELETE RESTRICT,
  "session_starts_at" TIMESTAMP(6) NOT NULL,
  "attendance" VARCHAR(20) NOT NULL CHECK ("attendance" IN ('not_marked','present','absent')),
  "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" > 0),
  "recorded_by" INTEGER NOT NULL REFERENCES "admins"("id") ON DELETE RESTRICT,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("schedule_id", "applicant_id", "session_starts_at")
);
CREATE INDEX "payout_schedule_attendance_applicant_id_idx" ON "payout_schedule_attendance"("applicant_id");
-- One current Scholar report per saved Payroll membership, across reschedules.
-- Legacy claim_status/claimed_date/released_at fields remain unused.
CREATE TABLE "scholar_payout_receipts" (
  "payroll_claim_id" INTEGER PRIMARY KEY REFERENCES "payroll_claims"("id") ON DELETE RESTRICT,
  "schedule_id" INTEGER NOT NULL REFERENCES "payout_schedules"("id") ON DELETE RESTRICT,
  "is_received" BOOLEAN NOT NULL,
  "received_on" DATE,
  "confirmed_at" TIMESTAMP(6),
  "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" > 0),
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "scholar_receipt_dates_check" CHECK (
    ("is_received" AND "received_on" IS NOT NULL AND "confirmed_at" IS NOT NULL)
    OR (NOT "is_received" AND "received_on" IS NULL AND "confirmed_at" IS NULL)
  )
);
CREATE INDEX "scholar_payout_receipts_schedule_id_idx" ON "scholar_payout_receipts"("schedule_id");
COMMIT;
