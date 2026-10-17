# Short reference verification — 2026-10-17

Status: implemented and verified locally; deployment authorized and in progress. No migration is required. Deploy backend and frontend together for the complete change.

## Expected references

| Record | Example | Meaning |
| --- | --- | --- |
| New Billing certification list | `BILL-0042` | Batch ID 42 |
| New Payroll list | `PAY-0043` | Batch ID 43 |
| Private Scholar individual PDF | `PGCEAP-CERT#0034` | Scholar-account ID 34, reused across periods |

Examples do not force the next record to use these exact numbers. Batch IDs are shared across list types and can skip; all IDs expand beyond four digits as needed. The certificate uses the scholar-account database ID, which can differ from the control number or applicant ID.

## Staff checks after deployment

1. Note an existing Billing and Payroll reference. Confirm history, filters and existing downloads still show those original values.
2. Select the appropriate academic period and generate a **new** eligible Billing certification list. Verify `BILL-` followed by at least four digits agrees in the success response, saved list/history, scholar Billing reference and Word document/filename.
3. Generate a **new** eligible Payroll list. Verify `PAY-` followed by at least four digits agrees in the saved record, filters and generated Excel reference/filename.
4. Refresh both sections; confirm references are retained and listed scholars remain excluded from duplicate listing.
5. Open a Private Scholar drawer and choose **Download Certification**. Check `PGCEAP-CERT#` plus the padded scholar-account ID appears in the PDF and filename.
6. Select another academic period for that same scholar and download again. The individual reference remains identical while the body reflects the selected semester/year. Another scholar must receive a different number.

## Local validation completed

- Backend/frontend regression suites, lint, build and backend syntax checks passed; one existing backend database opt-in test remains skipped.
- Reference unit/controller checks cover short outputs, invalid IDs, large IDs, matching saved/returned/requirement references, and finalization error propagation.
- PGlite transaction checks retained legacy references, generated short references from unique IDs, left no temporary references committed, rolled back on a collision and gave concurrent requests distinct IDs.
- Actual Scholar drawer browser downloads for two synthetic periods produced the same `PGCEAP-CERT#0034` in PDF text and filenames, with correct semester text and no API mutation.

No production records were created or rewritten. Individual PDF references identify a scholar rather than a unique issuance. Existing long list references are intentionally retained; this change is not a historical renumbering.
