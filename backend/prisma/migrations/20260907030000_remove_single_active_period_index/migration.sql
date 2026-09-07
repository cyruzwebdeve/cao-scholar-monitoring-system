-- Multiple processing periods are allowed. The separate partial unique index
-- on is_primary continues to enforce one Primary System Period.
DROP INDEX IF EXISTS "academic_periods_single_active_idx";
