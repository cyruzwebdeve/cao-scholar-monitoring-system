-- Baseline migration for the clean PGCEAP application database.
CREATE TABLE "academic_periods" (
    "id" SERIAL NOT NULL,
    "school_year" VARCHAR(20) NOT NULL,
    "semester" VARCHAR(30) NOT NULL,
    "start_date" DATE,
    "end_date" DATE,
    "status" VARCHAR(20) NOT NULL DEFAULT 'upcoming',
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "academic_periods_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "activity_logs" (
    "id" BIGSERIAL NOT NULL,
    "actor_type" VARCHAR(30) NOT NULL,
    "actor_id" INTEGER NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "target_table" VARCHAR(100),
    "target_id" INTEGER,
    "description" TEXT,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "announcements" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "audience" VARCHAR(40) NOT NULL DEFAULT 'all',
    "priority" VARCHAR(20) NOT NULL DEFAULT 'normal',
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "publish_at" TIMESTAMP(6),
    "expires_at" TIMESTAMP(6),
    "published_at" TIMESTAMP(6),
    "image_name" VARCHAR(255),
    "image_type" VARCHAR(100),
    "image_data" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admins" (
    "id" SERIAL NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_super_admin" BOOLEAN NOT NULL DEFAULT false,
    "role" VARCHAR(30) NOT NULL DEFAULT 'admin',
    "last_login_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "applicants" (
    "id" SERIAL NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "middle_name" VARCHAR(100),
    "last_name" VARCHAR(100) NOT NULL,
    "name_ext" VARCHAR(10),
    "email" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(20),
    "street" VARCHAR(255),
    "barangay" VARCHAR(100),
    "municipality" VARCHAR(100),
    "school_id" INTEGER,
    "gender" VARCHAR(30),
    "date_of_birth" DATE,
    "birthplace" VARCHAR(255),
    "civil_status" VARCHAR(30) DEFAULT 'Single',
    "family_income" VARCHAR(50),
    "gwa" DECIMAL(5,2),
    "guardians" TEXT,
    "siblings_boys" INTEGER NOT NULL DEFAULT 0,
    "siblings_girls" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(40) NOT NULL DEFAULT 'pending',
    "school_year" VARCHAR(20) DEFAULT '2026-2027',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "deleted_at" TIMESTAMP(6),
    CONSTRAINT "applicants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "application_submissions" (
    "id" SERIAL NOT NULL,
    "applicant_id" INTEGER,
    "email" VARCHAR(150) NOT NULL,
    "identity" JSONB NOT NULL,
    "address" JSONB NOT NULL,
    "school_plan" JSONB NOT NULL,
    "family" JSONB NOT NULL,
    "eligibility" JSONB NOT NULL,
    "initial_docs" JSONB NOT NULL DEFAULT '{}',
    "status" VARCHAR(40) NOT NULL DEFAULT 'Applied',
    "submitted_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "application_submissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "control_accounts" (
    "id" SERIAL NOT NULL,
    "applicant_id" INTEGER NOT NULL,
    "control_number" VARCHAR(20) NOT NULL,
    "username" VARCHAR(150) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "control_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exams" (
    "id" SERIAL NOT NULL,
    "created_by" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "exam_date" TIMESTAMP(6) NOT NULL,
    "exam_end_date" TIMESTAMP(6),
    "venue" VARCHAR(255),
    "municipality" VARCHAR(100),
    "academic_year" VARCHAR(20),
    "instructions" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exam_slots" (
    "id" SERIAL NOT NULL,
    "applicant_id" INTEGER NOT NULL,
    "exam_id" INTEGER NOT NULL,
    "appeared" BOOLEAN,
    "appeared_at" TIMESTAMP(6),
    "forfeited_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "exam_slots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "results" (
    "id" SERIAL NOT NULL,
    "exam_slot_id" INTEGER NOT NULL,
    "applicant_id" INTEGER NOT NULL,
    "exam_id" INTEGER NOT NULL,
    "score" DECIMAL(6,2),
    "passing_score" DECIMAL(6,2),
    "passed" BOOLEAN NOT NULL,
    "remarks" TEXT,
    "recorded_by" INTEGER,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "results_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "scholar_accounts" (
    "id" SERIAL NOT NULL,
    "applicant_id" INTEGER NOT NULL,
    "result_id" INTEGER,
    "scholar_id" VARCHAR(30),
    "issued_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issued_by" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "scholar_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "scholar_requirements" (
    "id" SERIAL NOT NULL,
    "applicant_id" INTEGER NOT NULL,
    "billing_period_id" INTEGER NOT NULL,
    "school_id" INTEGER,
    "year_level" VARCHAR(20),
    "course" VARCHAR(150),
    "major" VARCHAR(150),
    "cert_tax_exemption_file" VARCHAR(255),
    "cert_tax_exemption_review_status" VARCHAR(30) DEFAULT 'pending',
    "barangay_indigency_file" VARCHAR(255),
    "barangay_indigency_review_status" VARCHAR(30) DEFAULT 'pending',
    "valid_id_photocopy_file" VARCHAR(255),
    "valid_id_photocopy_review_status" VARCHAR(30) DEFAULT 'pending',
    "registration_form_file" VARCHAR(255),
    "registration_form_review_status" VARCHAR(30) DEFAULT 'pending',
    "tuition_fee_receipt_file" VARCHAR(255),
    "tuition_fee_receipt_review_status" VARCHAR(30) DEFAULT 'pending',
    "folder_physical_submitted" BOOLEAN NOT NULL DEFAULT false,
    "folder_physical_submitted_at" TIMESTAMP(6),
    "grade_report_file" VARCHAR(255),
    "grade_report_review_status" VARCHAR(30) DEFAULT 'pending',
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "scholar_requirements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "schools" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "school_type" VARCHAR(20) NOT NULL DEFAULT 'public',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "schools_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payroll_batches" (
    "id" SERIAL NOT NULL,
    "batch_number" VARCHAR(50) NOT NULL,
    "billing_period_id" INTEGER NOT NULL,
    "total_scholars" INTEGER NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "status" VARCHAR(30) NOT NULL DEFAULT 'draft',
    "prepared_by" INTEGER,
    "released_by" INTEGER,
    "prepared_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMP(6),
    "remarks" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "payroll_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payroll_claims" (
    "id" SERIAL NOT NULL,
    "payroll_batch_id" INTEGER NOT NULL,
    "applicant_id" INTEGER NOT NULL,
    "claim_amount" DECIMAL(10,2) NOT NULL,
    "claim_status" VARCHAR(30) NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "claimed_date" TIMESTAMP(6),
    "claimed_notes" VARCHAR(80),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "payroll_claims_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "academic_periods_is_active_idx" ON "academic_periods"("is_active");
CREATE INDEX "academic_periods_school_year_idx" ON "academic_periods"("school_year");
CREATE UNIQUE INDEX "academic_periods_school_year_semester_key" ON "academic_periods"("school_year", "semester");
CREATE UNIQUE INDEX "academic_periods_single_active_idx" ON "academic_periods"("is_active") WHERE "is_active" = true;
CREATE INDEX "activity_logs_actor_type_actor_id_idx" ON "activity_logs"("actor_type", "actor_id");
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs"("created_at");
CREATE INDEX "announcements_status_publish_at_idx" ON "announcements"("status", "publish_at");
CREATE INDEX "announcements_audience_idx" ON "announcements"("audience");
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");
CREATE UNIQUE INDEX "applicants_email_key" ON "applicants"("email");
CREATE INDEX "applicants_school_id_idx" ON "applicants"("school_id");
CREATE INDEX "applicants_municipality_barangay_idx" ON "applicants"("municipality", "barangay");
CREATE INDEX "applicants_status_idx" ON "applicants"("status");
CREATE INDEX "applicants_school_year_idx" ON "applicants"("school_year");
CREATE INDEX "application_submissions_applicant_id_status_idx" ON "application_submissions"("applicant_id", "status");
CREATE INDEX "application_submissions_email_idx" ON "application_submissions"("email");
CREATE UNIQUE INDEX "control_accounts_applicant_id_key" ON "control_accounts"("applicant_id");
CREATE UNIQUE INDEX "control_accounts_control_number_key" ON "control_accounts"("control_number");
CREATE UNIQUE INDEX "control_accounts_username_key" ON "control_accounts"("username");
CREATE INDEX "exams_academic_year_is_active_idx" ON "exams"("academic_year", "is_active");
CREATE INDEX "exams_municipality_idx" ON "exams"("municipality");
CREATE INDEX "exam_slots_exam_id_idx" ON "exam_slots"("exam_id");
CREATE UNIQUE INDEX "exam_slots_applicant_id_exam_id_key" ON "exam_slots"("applicant_id", "exam_id");
CREATE UNIQUE INDEX "results_exam_slot_id_key" ON "results"("exam_slot_id");
CREATE INDEX "results_applicant_id_created_at_idx" ON "results"("applicant_id", "created_at");
CREATE INDEX "results_exam_id_idx" ON "results"("exam_id");
CREATE UNIQUE INDEX "scholar_accounts_applicant_id_key" ON "scholar_accounts"("applicant_id");
CREATE UNIQUE INDEX "scholar_accounts_result_id_key" ON "scholar_accounts"("result_id");
CREATE UNIQUE INDEX "scholar_accounts_scholar_id_key" ON "scholar_accounts"("scholar_id");
CREATE INDEX "scholar_accounts_is_active_idx" ON "scholar_accounts"("is_active");
CREATE INDEX "scholar_requirements_billing_period_id_idx" ON "scholar_requirements"("billing_period_id");
CREATE INDEX "scholar_requirements_school_id_idx" ON "scholar_requirements"("school_id");
CREATE UNIQUE INDEX "scholar_requirements_applicant_id_billing_period_id_key" ON "scholar_requirements"("applicant_id", "billing_period_id");
CREATE UNIQUE INDEX "schools_name_key" ON "schools"("name");
CREATE UNIQUE INDEX "payroll_batches_batch_number_key" ON "payroll_batches"("batch_number");
CREATE INDEX "payroll_batches_billing_period_id_status_idx" ON "payroll_batches"("billing_period_id", "status");
CREATE INDEX "payroll_claims_applicant_id_claimed_date_idx" ON "payroll_claims"("applicant_id", "claimed_date");
CREATE UNIQUE INDEX "payroll_claims_payroll_batch_id_applicant_id_key" ON "payroll_claims"("payroll_batch_id", "applicant_id");
