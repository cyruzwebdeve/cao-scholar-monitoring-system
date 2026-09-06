-- Retire the standalone Content Moderator role without deleting historical records.
-- Existing accounts are disabled and their active sessions are invalidated.
UPDATE "admins"
SET
  "is_active" = false,
  "auth_version" = "auth_version" + 1,
  "updated_at" = CURRENT_TIMESTAMP
WHERE LOWER("role") = 'moderator';

-- Explicitly assigned Billing accounts receive the transferred review section.
-- NULL continues to mean the role defaults, which already include documentReviews.
UPDATE "admins"
SET "section_access" = "section_access" || '["documentReviews"]'::jsonb
WHERE LOWER("role") = 'billing'
  AND "section_access" IS NOT NULL
  AND NOT ("section_access" @> '["documentReviews"]'::jsonb);
