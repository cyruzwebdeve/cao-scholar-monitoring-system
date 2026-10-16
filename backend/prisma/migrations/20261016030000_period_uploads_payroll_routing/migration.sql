-- Retain historical schedule dates and authorizations; new access uses the period switch.
ALTER TABLE "continuing_requirement_schedules"
 ADD COLUMN "uploads_open" BOOLEAN NOT NULL DEFAULT true,
 ALTER COLUMN "opens_at" DROP NOT NULL,
 ALTER COLUMN "closes_at" DROP NOT NULL;
ALTER TABLE "scholar_requirements"
 ADD COLUMN "payroll_requested_at" TIMESTAMP(6),
 ADD COLUMN "payroll_requested_by" INTEGER REFERENCES "admins"("id") ON DELETE RESTRICT,
 ADD CONSTRAINT "payroll_request_provenance" CHECK (("payroll_requested_at" IS NULL) = ("payroll_requested_by" IS NULL));
