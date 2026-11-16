# CNPGCEAP Scholarship Profiling and Monitoring System
## Recommendation Status and Tracking Notes

**As of November 4, 2026**

## Presentation summary

The system implements most of the recommendations. The remaining gaps are a general achievements area for Scholars and reporting of confirmed disbursements. Reports currently show generated payroll-list amounts, which are not proof that funds were released or received. Recent database-query reductions have been committed locally but have not been deployed or measured in production.

## Recommendation status

### 1. Administrator test access wording

**Status: Implemented**

The site has an invitation-only **Authorized test access** checkpoint with a separate test access code, before account sign-in. The wording differs slightly from the suggested “Test” label but communicates test access.

**How to track:** During the presentation, show the access checkpoint and confirm that the administrator-facing wording matches the intended terminology.

### 2. Login page photo or background

**Status: Implemented as a logo background**

The CAO logo is used as a large, faint background graphic on the login page. It is not a photographic image.

**How to track:** Show the deployed login page at desktop and mobile sizes and compare it with the approved visual reference.

### 3. Applicants with complete requirements awaiting Scholar approval

**Status: Implemented**

The Potential Scholars workflow separates applicants who have been checked from accepted Scholars. Staff must explicitly accept an applicant; adding someone to Potential Scholars does not itself grant Scholar status.

**How to track:** In a test environment, follow **Results → check requirements → Potential Scholars → accept**. Confirm the person is not a Scholar before acceptance and becomes one only after the authorized acceptance action.

### 4. Allowed document formats and validation

**Status: Implemented**

The upload interface specifies PDF, JPG, or PNG and a maximum size of 6 MB per requirement. Client-side and server-side validation are present.

**How to track:** Check the format and size guidance beside upload fields. With test accounts and non-personal files, verify that allowed files are accepted and unsupported or malformed files are rejected by both the interface and API.

### 5. Administrator editing the scholarship allowance amount

**Status: Implemented with payroll-list scope**

Authorized staff can edit a Scholar’s recorded payroll-list amount before the Scholar is included in a generated list. The amount is locked after list generation. This does not release funds.

**How to track:** Edit an eligible test Scholar’s amount before list generation and verify the saved value in the generated list and Reports. Confirm that an already-listed amount is locked.

### 6. Scholar acknowledgement of receiving a payout

**Status: Implemented as a self-reported acknowledgement**

A Scholar can report receipt for their own scheduled Payroll entry. Staff-recorded attendance is separate. The Scholar acknowledgement is not official payment verification.

**How to track:** With a test Payroll schedule and test Scholar account, verify that the Scholar sees only their own scheduled entry, can submit or correct their acknowledgement, and does not change attendance or generated payroll totals.

### 7. Reports search and money disbursed by Scholar

**Status: Partially implemented; disbursement reporting is out of scope**

Reports includes Scholar search and individual recorded payroll-list amounts and totals. These amounts represent generated payroll-list records, not money confirmed as released or disbursed. The system does not provide an official released-money audit or reconciliation report.

**How to track:** Search for a test Scholar and verify the individual payroll-list amount and matching total. Label these figures **Payroll list amount**, not **Disbursed**. Do not use them as proof of payment.

### 8. Achievements in each Scholar account

**Status: Partially implemented**

Scholar records include a **Graduation & honors** section. A general section for recording and displaying other achievements was not found.

**How to track:** Review a Scholar record and confirm graduation and honors fields are available. Record the general achievements section as remaining work if non-graduation accomplishments are required.

## How to track implementation

For each recommendation, keep a simple record with these fields:

- Recommendation number and short name
- Status: Implemented, Partially implemented, or Not implemented
- Commit or release identifier
- Deployment date and environment
- Acceptance check performed and result
- Remaining work or limitation
- Person responsible and next review date

Use the repository change log and dated QA acceptance documents as implementation evidence. A code change is not production confirmation: record the deployed commit and verify the corresponding workflow in the live system with authorized test accounts. Do not include real personal information, passwords, access codes, or private document locations in presentation materials or tracking records.

## Database-usage improvements to track

- **November 1, 2026 — commit `3746392`:** Changed the two email workers from 30-second polling to five-minute polling. The repository change log says backend deployment is required for the reduction to affect production; deployment was not verified here.
- **November 3, 2026 — commit `f34d8a0`:** Changed routine dashboard refresh from five to ten minutes, time-sensitive refresh from two to five minutes, slowed paired phone-capture polling, reduced repeated image-queue reads when a session revision is unchanged, and changed expired-session cleanup from one minute to 15 minutes.
- The November 3 changes were committed but not deployed. Automated tests and builds were not run for that commit.

### How to measure the effect after deployment

1. Record the deployment date and deployed commit for both frontend and backend.
2. Record the database operation count at the same time each day for several days before and after deployment, if historical data is available.
3. Compare daily increases (today’s total minus yesterday’s total), not only the projected monthly line.
4. Note backend instance count and any phone-capture use, test sessions, or unusual traffic for each measurement period.
5. Treat the database dashboard’s monthly projection as an estimate. The usage chart alone cannot identify which routes or workers generated the operations.
6. Confirm that the observed operation rate remains within the database plan allowance and that login, portals, uploads, examinations, schedules, and Reports work normally.

## Defense presentation talking point

The system now supports controlled applicant-to-Scholar approval, document format validation, editable pre-list payroll amounts, and a Scholar-owned receipt acknowledgement for scheduled payroll entries. Reports search and payroll-list amount breakdowns are available. The remaining recommendation gaps are general Scholar achievements and any request for confirmed disbursement reporting; confirmed disbursement is outside the approved system scope. The latest database-query reductions still need deployment and production measurement.

## Scope note

The system’s processing workflow ends when it generates the official payroll list of Scholars. Attendance and a Scholar’s receipt acknowledgement are separate records. A receipt acknowledgement is self-reported. Do not describe payroll-list totals as released, paid, or audited funds.
