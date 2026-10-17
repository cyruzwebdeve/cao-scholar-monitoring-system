# Informational payout schedules — 2026-10-17

Deployment pending. Requires frontend/backend and migration `20261017010000_payout_schedules`; no new environment variables. The feature never records fund release, claiming or disbursement confirmation.

1. Refresh, open **Payroll → Payout schedules** with a staff account assigned Payroll access. Confirm the tab matches existing tabs and lists/export actions remain in Payroll lists. Verify an account without Payroll access cannot read or write schedules.
2. Use an existing dedicated official Payroll test batch containing Scholars in different municipalities/schools. Billing batches and unfinished/empty batches must not be available.
3. Click Create schedule; select the batch. Filter municipality, school or name, select filtered Scholars or individual checkboxes. Confirm the selected count and all selected names in Review schedule, including any outside the current filter.
4. Enter title, date/time, optional end, venue and instructions/documents to bring. Use an office or designated school venue independent of enrolled school. Times are Philippine time even when the browser has another timezone.
5. Save draft. Verify it is visible to staff and invisible to all Scholars; no publish notice. Reopen/edit and Review schedule, then Publish. Only selected members of that batch must receive a portal notification and dashboard card.
6. Sign in with a selected Scholar and an unselected Scholar. Verify date/time/venue/reference/period/instructions on the selected dashboard; the other account must not see the schedule or another recipient's identity. The latest schedule-update card must not show a fabricated Amount.
7. Create another schedule for the same batch and a different group. Already-published recipients are disabled. Force overlapping/stale requests only in local/staging; the server must reject conflicts without partial schedules or duplicate notices.
8. Reschedule/edit a published schedule. The batch/recipients stay fixed; date, venue and instructions may change. Publish changes and verify the same recipients see updated details and receive a notice. Draft rollback is unavailable after publication.
9. Cancel schedule; preview the cancellation note, test keyboard Tab/Escape and confirm. Recipients see a cancelled card and targeted notice. Original Payroll membership/reference/amounts remain unchanged. Those recipients may now be assigned to a replacement schedule.
10. Verify invalid dates/end-before-start, empty audience, nonmembers, expired/stale revisions and changed published audience are rejected. Cancelled records cannot be edited. Use local/staging network controls for load/roster/save failure and notification-write rollback; do not fault-inject production.
11. Switch between Payroll lists and Payout schedules; queued Scholars and the schedule editor must remain. Check desktop and phone widths, readable notices, no overflow and both Word/Excel paths.

Scholar cards refresh on the existing two-minute/focus cadence; refresh to test immediately. Portal bell notifications use their existing refresh cadence. This release adds no email/SMS. Historical notification messages remain; current schedule cards show revised/cancelled details.

Completed locally: policy/permission/integration and frontend regressions, serializable/conflict/notification rollback facade checks, actual additive SQL constraints/rollback in isolated PGlite, Prisma generation/validation, lint/build, synthetic desktop/mobile/narrow scheduling and actual Scholar dashboard flows plus existing exports. No production records modified by verification. Backend revision/migration needs hosted confirmation after deployment.
