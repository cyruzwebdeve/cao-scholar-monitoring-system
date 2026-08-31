# PGCEAP System Features, Innovations, and Improvements

## TL;DR

- The system manages scholarship applications from submission through the CAO-generated official payroll list of scholars.
- Its main innovations are explainable eligibility recommendations, verified priority-criterion auto-acceptance, and personalized next-action guidance.
- Staff workflows include examination scheduling, protected document review, scholar processing, exports, reporting, and operational activity logs.
- Security, accessibility, validation, and responsive user experience have been strengthened across applicant, scholar, moderator, administrator, and super administrator areas.
- Fund release, payment claiming, disbursement confirmation, reconciliation, and monetary auditing are outside the approved product scope.

## 1. System purpose and workflow boundary

PGCEAP is a scholarship application and scholar-processing platform for applicants,
scholars, Content Moderators, Administrators, Billing/Payroll Administrators, and
Super Administrators. The approved workflow ends when CAO generates the official
payroll list of scholars. The system does not release funds or confirm that money
has been received.

The primary workflow is:

1. Applicant views application availability and submits an application.
2. The system validates applicant information, municipality, school, family, and supporting records.
3. Eligible applicants receive examination scheduling and status guidance, unless a verified priority pathway bypasses the examination.
4. Staff review applicant and scholar documents and record corrections or approvals.
5. Approved scholars complete the in-scope processing requirements.
6. CAO prepares the official payroll list of scholars.

## 2. Core features

### Applicant experience

- Public scholarship application form with live open/closed/scheduled submission status.
- Municipality and school selection backed by the maintained school catalog.
- Eligibility-criteria declarations, including honors, academic contest placement, ALS passer, PWD, child of a PWD, solo parent, and Indigenous Group criteria.
- Conditional proof upload for priority criteria using private PDF, JPG, or PNG files.
- Applicant dashboard showing application status, examination details, returned documents, scholar acceptance, and next actions.
- Password recovery with expiring, single-use reset links and generic responses that prevent account discovery.

### Examination and application processing

- Municipality-based examination assignment for the active academic period.
- Consistent schedule matching for online applications and bulk schedule assignment.
- Examination schedule cards with Philippine date formatting, venue details, and delivery mode.
- Current application and scheduling metrics for authorized staff.

### Document and requirement review

- Protected Moderator/Super Administrator review queue for applicant proofs and scholar requirement uploads.
- Secure preview of private PDF/image files without exposing storage locations.
- Approve or reject decisions with required correction notes.
- Grouped scholar review rows with pending, approved, rejected, and file-count summaries.
- Safe bulk approval for ordinary scholar requirements; priority-proof auto-acceptance is deliberately individual-only.

### Scholar processing and payroll-list preparation

- Scholar account creation and acceptance status management.
- Requirement tracking for the active academic period.
- Physical-folder receipt recording where required by the processing workflow.
- Readiness checks and controlled administrative processing before inclusion in the official payroll list.
- Scholar-facing notices and progress information for in-scope processing states.

### Administration and operations

- Staff account management with role assignment, active-status controls, password changes, and safeguards against removing the final active Super Administrator.
- Administrator-controlled scholarship application availability and Philippine-time opening/closing windows.
- School Catalog with search, Public/Private filtering, classification totals, and controlled classification editing.
- Configurable CSV exports for Applicants, Results, Scholars, Billing, Payroll, and Reports.
- Operational Activity Logs for sign-ins, record changes, decisions, and important workflow actions.
- Responsive Reports and lifecycle metrics for authorized staff.

## 3. Innovations

### 3.1 Explainable eligibility recommendation engine

Authorized staff receive a versioned, transparent scorecard instead of an opaque
accept/reject result. The recommendation shows the contributing factors, policy
version, recommendation, and a human-authority notice. A non-matching
recommendation requires a written override reason before staff acceptance. The
final decision stores an immutable assessment snapshot and an operational log.

The engine supports decision consistency while keeping final authority with CAO
personnel.

### 3.2 Verified priority eligibility pathway

An applicant who selects at least one approved priority criterion can provide a
matching proof document or ID. Self-declaration alone never accepts an applicant.
After an authorized Moderator or Super Administrator individually verifies the
proof, the system atomically:

- creates the scholar record,
- records the verified criterion and policy version,
- bypasses the examination stage,
- starts scholar requirements,
- sends the scholar notification, and
- records the action in the Activity Log.

The one-scholar-per-family rule, active-scholar conflict checks, file validation,
and account-conflict checks remain enforced. Existing inactive scholar records
are held for Super Administrator review rather than overwritten.

### 3.3 Personalized next-action assistant

Applicant and Scholar portals receive a safe, explainable timeline that identifies
the next action from recorded examination, acceptance, document-review,
physical-folder, and payroll-list states. It prioritizes missing or returned
requirements and explains a verified examination bypass without making a new
eligibility decision or exposing unreleased results.

### 3.4 Policy-versioned workflow decisions

Eligibility and priority decisions identify their policy version (for example,
`PGCEAP-2026.1` or `PGCEAP-PRIORITY-2026.1`). This makes a decision traceable to
the rule set used at the time while preserving an immutable, minimized input
snapshot.

## 4. Improvements made

### Reliability and data integrity

- Server-side validation is authoritative for roles, files, criteria, schedules, and status transitions.
- Additive database migrations preserve existing records and avoid destructive rewrites.
- Transactional writes keep scholar creation, requirements, assessment records, notifications, and logs consistent.
- Duplicate-safe schedule, billing, and payroll-list preparation operations reduce repeated records.

### Security and privacy

- Private uploads are streamed through protected authorization checks; storage paths are not exposed to users.
- Password reset tokens are random, hashed, single-use, and time-limited.
- Rate limits protect authentication, staff mutations, review decisions, and sensitive workflow actions.
- Activity Logs store safe operational metadata rather than passwords, tokens, or request bodies.
- Priority-proof checks validate the declared criterion, file type, decoded size, role, family conflict, and account conflict on the server.

### User experience and accessibility

- Responsive layouts support desktop and mobile workflows.
- Loading, failure, retry, empty, scheduled, closed, and ended states are explicit instead of relying on placeholder data.
- Review modals, export dialogs, accordions, and forms support keyboard use, clear labels, focus handling, and reduced-motion preferences.
- Dates, venues, document statuses, correction notes, and next actions use plain-language labels.

### Operational transparency

- Staff can see why a recommendation was produced and which policy version applied.
- Applicants can see where they are in the process and what they need to do next.
- Review decisions, acceptance actions, and important account changes are attributable in Activity Logs.
- Export columns can be selected by role and section while preserving active filters and protecting against spreadsheet formula injection.

## 5. Role coverage

| Role | Main capabilities |
|---|---|
| Applicant | Submit an application, provide priority proof, view schedule/status, correct returned documents, and track next actions |
| Scholar | View acceptance, requirements, review outcomes, notices, and payroll-list processing status |
| Content Moderator | Review documents and proofs, approve/reject submissions, and record correction notes |
| Administrator | Manage routine application and scholarship-processing operations within assigned permissions |
| Billing/Payroll Administrator | Perform controlled in-scope readiness and payroll-list preparation tasks; cannot release funds |
| Super Administrator | Manage staff, settings, catalog data, reviews, reporting, and privileged operational actions |
| CAO authority | Retain final institutional authority for policy approval and official payroll-list generation |

## 6. Scope exclusions

The following are intentionally not part of the product workflow:

- fund release or disbursement,
- payment claiming or confirmation of receipt,
- reconciliation of released money,
- monetary auditing, and
- presenting operational Activity Logs as an audit of released funds.

Legacy payment-oriented code may remain for controlled cleanup or historical
compatibility, but it does not redefine the approved endpoint of the system.

## 7. Verification status

The current implementation has been verified with the backend test suite,
frontend lint, frontend production build, Prisma schema validation, syntax checks,
and live production health checks. The frontend is deployed on Vercel and the API
is deployed on Render with a connected database.

The priority policy remains subject to formal CAO approval before it is used for
actual scholarship decisions. Proof authenticity is still a human review
responsibility; the system validates workflow and file structure, not an issuing
authority's registry.

