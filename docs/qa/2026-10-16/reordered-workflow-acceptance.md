# Reordered intake and list processing — staff acceptance

Use test records. Do not accept a real applicant merely to test the workflow.

## Deployment prerequisites

Frontend and backend must use this release. Backend must apply `20261016010000_passer_lists` and regenerate Prisma. Public health cannot identify revision/migration status. Existing Scholars, initial files and generated certification/payroll memberships are retained.

## Passer List and results

1. In Examination → Results, review a paper or online score. A score alone does not permit acceptance.
2. Open **Passer Lists**. Select reviewed passers (failed and already accepted applicants are excluded). **Save draft**. Reload and expand the saved list: members/scores remain retained, but draft saving does not publish new outcomes.
3. Choose **Post & lock saved draft**, or prepare a new selection and **Post & lock list** immediately. Repeated retries must not duplicate the same saved request. Posted lists remain read-only, retaining their original source references, score snapshots, staff and date.
4. On the applicant account, reload: the published outcome and **Initial requirements · CAO upload** checklist appear. A failed applicant sees their outcome after CAO uses the existing **Publish reviewed result** action; failed results are not posted in Passer Lists.
5. To correct a list, create a reasoned revision using **Revision of**. Retain the old version; post the replacement. A changed examination score needs a new current posted membership before intake/acceptance. A stale draft must reject posting rather than retain a silently changed score.

## Initial verification before Scholar registration

6. Results → View result: before posting, intake/acceptance is unavailable. After posting, **Capture initial requirements** is available even without a Scholar account.
7. The Admin handles every initial upload, including grades, registration form and Private tuition receipt. Use existing camera, photo/file, multipage PDF or paired-phone intake. Phone **Upload** only transfers a temporary photo; end pairing and confirm the complete reviewed set to save it.
8. Public required: tax exemption, valid ID, grades, registration form. Private required: those four plus tuition receipt. **Barangay Indigency remains optional**, visible and uploadable. Leave it absent: it must not block set confirmation, required-document completion or acceptance.
9. Missing/rejected required files, unpublished/failed results or missing current posted membership must block **Accept as Scholar**, including direct API requests. Once required files are approved, an authorized decision-maker can accept. No separate Decision reason field is required.
10. Applicant sees read-only filenames/statuses and verification progress; no initial upload buttons. Existing visible-page refresh is two minutes, or reload immediately. Official Scholar role is created only at acceptance. After acceptance, continuing uploads remain Scholar-owned within the configured period window.
11. Priority-proof approval verifies that proof only; it must not automatically create a Scholar or tag the application Priority_Accepted. Existing priority Scholars are preserved.

## Payroll versus Billing

12. Newly accepted initial Public **and Private** Scholars appear in Payroll preparation. Do not auto-generate the official list just to test visibility. Public remains PHP 3,000 and Private PHP 5,000; this routing change does not alter grants.
13. In a later continuing period, regular Public records appear in Payroll and regular Private records in Billing/certification. Session-edit permissions follow that destination. A record routed elsewhere must be rejected if manually submitted to the wrong processing API.
14. Configure an authorized late window and upload a continuing file during it. Public and Private late records appear in Payroll, including after the late window closes. Late identification uses retained upload timestamps in the authorized late window; merely opening an all-Scholar late window does not reroute early Private submissions.
15. Continuing incompleteness/deadlines remain advisory for list generation; they do not add a new payroll block for accepted Scholars. Account/classification and duplicate-period checks still apply.
16. Existing generated certification/payroll memberships keep their original route/reference; do not duplicate or move them. The Scholar dashboard must reflect the actual list destination, including Private initial/late Payroll.

## Automated validation

Backend regression suite, frontend suite/lint/build, Prisma validation, isolated browser workflow and embedded PostgreSQL migration checks are recorded in the detailed change log. Browser/API facade tests use synthetic records; hosted authenticated acceptance remains for staff.
