-- Existing notices intentionally remain opted out to prevent historical mail blasts.
ALTER TABLE "announcements" ADD COLUMN "notify_email" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "email_queued_at" TIMESTAMP(6);
CREATE TABLE "announcement_email_deliveries" (
  "id" SERIAL PRIMARY KEY,
  "announcement_id" INTEGER NOT NULL REFERENCES "announcements"("id") ON DELETE CASCADE,
  "applicant_id" INTEGER NOT NULL REFERENCES "applicants"("id") ON DELETE CASCADE,
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "available_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sent_at" TIMESTAMP(6),
  "last_reason" VARCHAR(80),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "announcement_email_deliveries_announcement_id_applicant_id_key"
  ON "announcement_email_deliveries"("announcement_id", "applicant_id");
CREATE INDEX "announcement_email_deliveries_status_available_at_idx"
  ON "announcement_email_deliveries"("status", "available_at");
