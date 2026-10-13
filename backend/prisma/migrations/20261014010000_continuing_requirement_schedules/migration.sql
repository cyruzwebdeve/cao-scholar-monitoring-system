CREATE TABLE "continuing_requirement_schedules" (
 "academic_period_id" INTEGER PRIMARY KEY REFERENCES "academic_periods"("id") ON DELETE RESTRICT,
 "opens_at" TIMESTAMP(6) NOT NULL,
 "closes_at" TIMESTAMP(6) NOT NULL,
 "late_opens_at" TIMESTAMP(6),
 "late_closes_at" TIMESTAMP(6),
 "late_scope" VARCHAR(20) NOT NULL DEFAULT 'all',
 "late_applicant_ids" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
 "revision" INTEGER NOT NULL DEFAULT 1,
 "updated_by" INTEGER NOT NULL,
 "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "continuing_regular_dates" CHECK ("opens_at" < "closes_at"),
 CONSTRAINT "continuing_late_dates" CHECK (("late_opens_at" IS NULL AND "late_closes_at" IS NULL) OR ("late_opens_at" IS NOT NULL AND "late_closes_at" IS NOT NULL AND "late_opens_at" > "closes_at" AND "late_opens_at" < "late_closes_at")),
 CONSTRAINT "continuing_late_scope" CHECK ("late_scope" IN ('all', 'selected'))
);
