CREATE TABLE "phone_capture_sessions" (
 "id" UUID PRIMARY KEY,
 "owner_admin_id" INTEGER NOT NULL,
 "applicant_id" INTEGER NOT NULL REFERENCES "applicants"("id") ON DELETE CASCADE,
 "academic_period_id" INTEGER NOT NULL REFERENCES "academic_periods"("id") ON DELETE RESTRICT,
 "context" JSONB NOT NULL,
 "pages" JSONB NOT NULL DEFAULT '[]',
 "revision" INTEGER NOT NULL DEFAULT 0,
 "expires_at" TIMESTAMP(6) NOT NULL,
 "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "phone_capture_sessions_expires_at_idx" ON "phone_capture_sessions"("expires_at");
CREATE INDEX "phone_capture_sessions_owner_admin_id_idx" ON "phone_capture_sessions"("owner_admin_id");
