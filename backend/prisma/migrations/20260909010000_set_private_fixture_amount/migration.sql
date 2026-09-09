-- Keep the two unprocessed private-school workflow fixtures at PHP 5,000 each.
-- Processed fixtures are intentionally left unchanged to preserve recorded totals.
UPDATE scholar_requirements AS requirement
SET billing_amount = 5000.00,
    updated_at = CURRENT_TIMESTAMP
FROM applicants AS applicant
WHERE requirement.applicant_id = applicant.id
  AND applicant.email IN (
    'billing.workflow.prv01@pgceap.test',
    'billing.workflow.prv02@pgceap.test'
  )
  AND requirement.billing_reference IS NULL;
