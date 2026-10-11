-- Timed attempts start only when authorized applicants first load questions.
-- Existing slots/results remain unchanged and no attempt is backdated.
ALTER TABLE "exam_slots"
  ADD COLUMN "online_started_at" TIMESTAMP(6),
  ADD COLUMN "online_deadline_at" TIMESTAMP(6),
  ADD COLUMN "online_configuration_id" INTEGER;
ALTER TABLE "exam_slots" ADD CONSTRAINT "exam_slots_online_attempt_check" CHECK (
  ("online_started_at" IS NULL AND "online_deadline_at" IS NULL AND "online_configuration_id" IS NULL)
  OR ("online_started_at" IS NOT NULL AND "online_deadline_at" IS NOT NULL AND "online_configuration_id" IS NOT NULL
      AND "online_deadline_at" > "online_started_at" AND "online_configuration_id" >= 0)
);
