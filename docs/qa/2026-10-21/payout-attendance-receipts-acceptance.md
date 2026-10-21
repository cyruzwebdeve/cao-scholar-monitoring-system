# Payout attendance and Scholar receipt acceptance — 2026-10-21

Status: implemented locally; not deployed. Use dedicated authorized test accounts and saved test Payroll lists. Never confirm receipt for a real Scholar during testing.

1. Verify deployment identity, successful migration 20261021010000_payout_attendance_receipts, API health and both new tables before opening the feature.
2. With staff Payroll access, open Payout Schedules → Attendance & status on a published schedule. Confirm Scholar, Attendance and Payout status columns; search, filters, counts and 25-row pagination.
3. Before the scheduled start, verify attendance and new receipt confirmation are disabled. Draft/Billing lists and unauthorized roles must fail through direct requests too.
4. After the start, mark Present, Absent and Not marked. Verify the same Scholar's receipt remains Not confirmed. Staff cannot confirm a Scholar's receipt.
5. Sign in as the assigned Scholar. Confirm only their own scheduled entries and attendance appear. Click Received Payout, choose a valid date and check the personal attestation. Confirm once; reload and verify Received — scholar-confirmed and the date in both portals.
6. Change attendance after receipt: it must not change the acknowledgement. Withdraw a mistaken receipt with Correct receipt report: attendance must remain unchanged. No released-money totals or legacy paid flags should change.
7. Try another Scholar identity in the request body/URL, invalid/future dates, missing checkbox, missing versions and stale schedule revisions; verify rejection without writes. Two tabs editing the same attendance/receipt must receive conflict protection. Refresh before retrying a conflict.
8. Edit same-time schedule metadata: records survive recipient replacement. Reschedule to a new start: current attendance is Not marked, old attendance is retained with a previous-date note, and the same Payroll receipt is shared. Return to a previously used exact start: that start's prior attendance reappears.
9. Cancel a schedule: records stay visible/read only; new receipt confirmations are blocked and an existing own receipt can be withdrawn. Remove a recipient, remove Payroll membership or soft-delete the applicant: writes must fail.
10. Test network failures, draft retention, explicit Retry save for eligible failures, Refresh records after conflict, single-submit protection, keyboard/Escape/focus restoration and 320/390/768/1440 widths. Confirm existing scheduling notifications/email controls still work; do not send real mail in synthetic testing.
11. Confirm Reports monetary totals/XLSX still reflect generated Payroll amounts and office Paid/release endpoints remain retired (410).

Local evidence: 467 backend passed/one existing opt-in database skip; 226 frontend passed; lint/build and Prisma validate/generate passed. Fourteen focused controller/JWT route cases passed. Actual migration accepted by embedded PostgreSQL with status/date/version/FK constraints, recipient replacement survival and independent state. Synthetic Chromium exercised staff attendance, Scholar confirmation/withdrawal, readonly receipt, filtering, Escape and responsive bounds. Production concurrency, managed-database migration and authenticated hosted acceptance remain pending.

Rollback: revert application source while retaining additive tables and records. A destructive schema rollback requires separate review; do not drop recorded acknowledgements or attendance silently.
