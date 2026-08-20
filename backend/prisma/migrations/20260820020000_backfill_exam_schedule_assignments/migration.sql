-- Persist municipality-based examination assignments that were previously resolved only at read time.
WITH selected_year AS (
  SELECT COALESCE(
    (SELECT "school_year" FROM "academic_periods" WHERE "is_active" = true ORDER BY "updated_at" DESC LIMIT 1),
    '2026-2027'
  ) AS "school_year"
),
latest_exams AS (
  SELECT DISTINCT ON (LOWER(TRIM("municipality")))
    "id",
    "municipality",
    "academic_year"
  FROM "exams", selected_year
  WHERE "municipality" IS NOT NULL
    AND TRIM("municipality") <> ''
    AND "academic_year" = selected_year."school_year"
  ORDER BY LOWER(TRIM("municipality")), "updated_at" DESC
)
INSERT INTO "exam_slots" (
  "applicant_id",
  "exam_id",
  "appeared",
  "created_at",
  "updated_at"
)
SELECT
  applicant."id",
  exam."id",
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "applicants" applicant
JOIN selected_year ON true
JOIN latest_exams exam
  ON LOWER(TRIM(applicant."municipality")) = LOWER(TRIM(exam."municipality"))
WHERE applicant."deleted_at" IS NULL
  AND (
    applicant."school_year" = selected_year."school_year"
    OR applicant."school_year" IS NULL
    OR applicant."school_year" = ''
    OR applicant."school_year" = '2025-2026'
  )
ON CONFLICT ("applicant_id", "exam_id") DO NOTHING;
