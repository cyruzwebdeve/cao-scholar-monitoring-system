-- Empty outbox: existing schedules are not retrospectively broadcast.
CREATE TABLE "payout_schedule_email_deliveries" (
  "id" SERIAL PRIMARY KEY,
  "schedule_id" INTEGER NOT NULL REFERENCES "payout_schedules"("id") ON DELETE CASCADE,
  "revision" INTEGER NOT NULL,
  "applicant_id" INTEGER NOT NULL REFERENCES "applicants"("id") ON DELETE CASCADE,
  "event" VARCHAR(20) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "available_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sent_at" TIMESTAMP(6),
  "last_reason" VARCHAR(80),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "schedule_email_recipient_revision_key"
  ON "payout_schedule_email_deliveries"("schedule_id", "revision", "applicant_id");
CREATE INDEX "schedule_email_pending_idx"
  ON "payout_schedule_email_deliveries"("status", "available_at");
