# Attendance Synchronization and Provincial Admin Verification

Date: 2026-10-13 (Asia/Manila)

Release 90832a5 deployed: frontend labels verified live, API/database healthy, backend deployment success confirmed by the user. No migration; attendance timing unchanged.

## Attendance findings

- Admin save: PUT /examinations/:examId/attendance/:applicantId persists appeared/appeared_at and returns Present after success.
- Applicant API: the next applications/me response returns Present with the saved timestamp; the paper/online real-controller fixture test verifies both fields.
- Same browser context: localStorage attendance revision events trigger an immediate dashboard refetch.
- Separate browser/device: those local events do not reach the applicant. ApplicantDashboard uses the existing 120-second visible-page polling interval.
- Focus/visibility return can refresh after the existing 60-second minimum age; hidden tabs are not regularly refreshed.
- Controlled browser test: isolated-context update remained Pending before the next poll, then became Present at 120 seconds; a same-context sibling revision updated immediately.

The verification did not change attendance synchronization or create any real attendance records. Hosted authenticated verification remains outstanding.

## Role naming

Current visible Super Admin/Super Administrator labels are now Provincial Admin, including the role selector/sidebar/app shell and relevant server messages. The internal SuperAdmin role, database fields, section access, self/final-admin safeguards, and stored account names are unchanged. Both frontend and backend deployment are needed; no database migration.

## Manual verification after deployment

1. Log in using a privileged staff account: confirm Provincial Admin labels in the sidebar, role display, and Staff settings.
2. Confirm the staff role selection still creates/edits the same full-access role and existing privileged accounts retain all allowed sections.
3. In an approved test environment, open an applicant dashboard and admin Examination Management in separate browsers with synthetic accounts.
4. Mark the applicant Present. Confirm the admin receives a successful save, then observe the applicant attendance on the next two-minute visible-page refresh. A manual reload should show it immediately.
5. Confirm paper attendance leads to For review while online access still requires the existing activation/date/application eligibility conditions.

For near-immediate cross-device updates, consider an examination-specific five-second refresh during the active window; true instant delivery would require server push. These remain recommendations.
