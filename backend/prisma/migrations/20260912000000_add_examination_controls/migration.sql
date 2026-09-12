ALTER TABLE "application_settings"
  ADD COLUMN IF NOT EXISTS "examination_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "exam_delivery_mode" VARCHAR(20) NOT NULL DEFAULT 'paper';

ALTER TABLE "application_settings"
  DROP CONSTRAINT IF EXISTS "application_settings_exam_delivery_mode_check";

ALTER TABLE "application_settings"
  ADD CONSTRAINT "application_settings_exam_delivery_mode_check"
  CHECK ("exam_delivery_mode" IN ('paper', 'online'));
