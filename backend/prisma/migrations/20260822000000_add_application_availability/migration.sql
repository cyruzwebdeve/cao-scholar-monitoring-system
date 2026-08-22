CREATE TABLE IF NOT EXISTS "application_settings" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "opens_at" TIMESTAMP(6),
  "closes_at" TIMESTAMP(6),
  "updated_by" INTEGER,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "application_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "application_settings_singleton_check" CHECK ("id" = 1),
  CONSTRAINT "application_settings_window_check" CHECK (
    ("opens_at" IS NULL AND "closes_at" IS NULL)
    OR ("opens_at" IS NOT NULL AND "closes_at" IS NOT NULL AND "closes_at" > "opens_at")
  )
);

INSERT INTO "application_settings" ("id", "is_enabled")
VALUES (1, true)
ON CONFLICT ("id") DO NOTHING;
