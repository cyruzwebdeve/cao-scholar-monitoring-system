ALTER TABLE "academic_periods"
  ADD COLUMN IF NOT EXISTS "is_primary" BOOLEAN NOT NULL DEFAULT false;

UPDATE "academic_periods"
SET "is_primary" = true,
    "is_active" = true,
    "status" = 'active'
WHERE "id" = (
  SELECT "id"
  FROM "academic_periods"
  WHERE "is_active" = true
  ORDER BY "updated_at" DESC, "id" DESC
  LIMIT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS "academic_periods_one_primary_idx"
  ON "academic_periods" (("is_primary"))
  WHERE "is_primary" = true;

CREATE INDEX IF NOT EXISTS "academic_periods_is_primary_idx"
  ON "academic_periods"("is_primary");

ALTER TABLE "academic_periods"
  ADD CONSTRAINT "academic_periods_primary_requires_active"
  CHECK (NOT "is_primary" OR "is_active");
