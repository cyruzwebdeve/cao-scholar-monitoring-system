BEGIN;
CREATE TABLE "scholar_graduations" (
  "applicant_id" INTEGER PRIMARY KEY REFERENCES "scholar_accounts"("applicant_id") ON DELETE RESTRICT,
  "graduation_date" DATE NOT NULL,
  "academic_year" VARCHAR(9) NOT NULL,
  "latin_honor" VARCHAR(30) NOT NULL,
  "school" VARCHAR(200) NOT NULL,
  "course" VARCHAR(200) NOT NULL,
  "proof_name" VARCHAR(255) NOT NULL,
  "proof_type" VARCHAR(30) NOT NULL,
  "proof_data" BYTEA NOT NULL,
  "review_status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "review_notes" VARCHAR(1000),
  "reviewed_by" INTEGER,
  "reviewed_at" TIMESTAMP(6),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "graduation_honor_check" CHECK ("latin_honor" IN ('none','cum_laude','magna_cum_laude','summa_cum_laude')),
  CONSTRAINT "graduation_review_check" CHECK ("review_status" IN ('pending','verified','rejected')),
  CONSTRAINT "graduation_review_metadata_check" CHECK (
    ("review_status" = 'pending' AND "reviewed_by" IS NULL AND "reviewed_at" IS NULL)
    OR ("review_status" IN ('verified','rejected') AND "reviewed_by" IS NOT NULL AND "reviewed_at" IS NOT NULL)
  ),
  CONSTRAINT "graduation_proof_type_check" CHECK ("proof_type" IN ('application/pdf','image/jpeg','image/png')),
  CONSTRAINT "graduation_version_check" CHECK ("version" > 0),
  CONSTRAINT "graduation_proof_size_check" CHECK (octet_length("proof_data") BETWEEN 1 AND 6291456)
);
CREATE INDEX "scholar_graduations_review_status_latin_honor_idx" ON "scholar_graduations"("review_status", "latin_honor");
COMMIT;
