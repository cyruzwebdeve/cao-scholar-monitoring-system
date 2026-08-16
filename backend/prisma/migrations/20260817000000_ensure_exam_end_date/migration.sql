-- Examination schedules support multi-day examination windows.
ALTER TABLE "exams"
ADD COLUMN IF NOT EXISTS "exam_end_date" TIMESTAMP(6);
