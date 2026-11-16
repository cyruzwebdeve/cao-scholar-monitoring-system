CREATE TABLE "intake_settings" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "academic_period_id" INTEGER,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "updated_by" INTEGER,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "intake_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "intake_settings_singleton" CHECK ("id" = 1),
  CONSTRAINT "intake_settings_revision_nonnegative" CHECK ("revision" >= 0),
  CONSTRAINT "intake_settings_academic_period_id_fkey" FOREIGN KEY ("academic_period_id")
    REFERENCES "academic_periods"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
CREATE INDEX "intake_settings_academic_period_id_idx" ON "intake_settings"("academic_period_id");

-- Copy the existing real default once. Later Scholar processing changes must not
-- silently move Application/Examination intake. No existing period is modified.
INSERT INTO "intake_settings" ("id", "academic_period_id")
VALUES (1, (
  SELECT "id" FROM "academic_periods"
  WHERE "is_active" = TRUE
  ORDER BY "is_primary" DESC, "updated_at" DESC, "id" DESC
  LIMIT 1
));
