ALTER TABLE "announcements"
  ADD COLUMN IF NOT EXISTS "external_url" VARCHAR(2048);
