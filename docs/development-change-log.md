# Comprehensive Development Change Log

This document is the detailed engineering record for material PGCEAP system
changes. The root `change_log.txt` remains the concise chronological summary.
Entries here explain what changed, why it changed, how it affects the system,
and how the result was verified.

## 2026-09-09 - Payroll Transfer-Board Record Scoping

### TL;DR

- Payroll now lists only current-period scholars who have already completed Billing.
- Archived period rows no longer appear as duplicate scholars in the operational transfer board.
- Unbilled scholars remain counted by the surrounding management data but are not shown as non-actionable Payroll rows.
- No records were deleted or changed, and Billing/Payroll validation remains authoritative.

### Objective and reason

The Payroll transfer board used the combined current-and-archived dataset that
supports reporting filters. This could show the same scholar twice and could
mislabel an archived row as inactive. It also displayed unbilled scholars even
though Payroll correctly prevented staff from selecting them. The objective
was to keep the operational board focused on the current processing period and
the actual Billing-to-Payroll sequence.

### Previous and new behavior

Previously, archived financial-history rows and current rows could both appear
under List of Scholars. Unbilled current scholars appeared with Billing
required first, producing a cluttered list of records staff could not process.

Now the transfer board excludes archived rows in both workspaces. In Payroll,
it additionally excludes current scholars until Billing is completed. Billed
scholars remain available and are labelled Ready for payroll or In payroll as
appropriate. Aggregate cards and stored historical records are not removed.

### Affected users, workflow, and implementation

Billing and Payroll staff receive a cleaner Payroll queue with one operational
row per scholar and period. The frontend derives `visibleRecords` from the
existing filtered dataset, removes `isArchivedPeriod` rows, and—only in Payroll—
requires the existing `billed` state. Server-side active-period, billed-claim,
duplicate, and role checks remain unchanged.

### Files and system areas changed

- `frontend/src/BillingPayrollManagement.jsx`: scopes transfer-board records to
  current-period entries and billed Payroll candidates.
- `change_log.txt` and `docs/development-change-log.md`: document the correction.

### Impact assessment

- **API/database/configuration/dependencies:** no impact; this is frontend
  presentation scoping and introduces no endpoint, schema, or package change.
- **Security/privacy:** no impact; authorization and validation are unchanged,
  and no additional data is exposed.
- **Accessibility:** removes duplicated and non-actionable rows, reducing
  navigation noise while retaining textual processing status.
- **Deployment:** frontend deployment only; no backend restart or migration is
  required.
- **Product scope:** the workflow still ends at official payroll-list
  generation and adds no payment-release functionality.

### Validation, limitations, rollback, and next work

Frontend ESLint, the production build, and Git whitespace validation passed.
Historical entries remain available through existing history and record data
rather than the live transfer board. Rollback requires restoring the unscoped
filtered dataset assignment and has no data impact. Recommended next work is a
deployed check using a scholar with both current and historical period records.

## 2026-09-09 - Scholar Billing Preparation Form Refinement

### TL;DR

- The Scholar Billing preparation controls now use the same green card, typography, borders, spacing, and interaction styling as the administration environment.
- School Year, Semester, Billing Reference, and Billing Status have persistent visible labels instead of relying on field contents.
- Billing Reference and Billing Status include concise guidance explaining automatic generation and the editing lock.
- No Billing/Payroll rules, API behavior, database records, or permissions changed.

### Objective and reason

The compact Billing preparation controls were functional but visually sparse,
and their labels were hidden from sighted users. The objective was to make the
form immediately understandable and visually consistent with the surrounding
Scholar drawer without altering the recently restored Billing-to-Payroll flow.

### Previous and new behavior

Previously, field purpose was communicated primarily through selected values
and placeholders, while the visible layout appeared as four disconnected
boxes and a button. Now the fields sit inside a subtle green-accented setup
card with a short heading, persistent uppercase labels, balanced spacing, and
clear helper text. The generated Billing Reference has a distinct read-only
treatment, and the action remains visually aligned with the system's primary
green controls.

### Affected users, workflow, and implementation

Administrators and Billing staff see the refinement in Scholars -> Scholar
Record -> Billing & Payroll. Their workflow is unchanged: select School Year
and Semester, choose the pre-processing Billing Status, then use Prepare & open
Billing. The JSX adds semantic visible label and guidance content; the admin
stylesheet supplies the card header, field, focus, disabled, button, and
narrow-screen presentation.

### Files and system areas changed

- `frontend/src/ScholarsManagement.jsx`: adds the setup heading, visible field
  labels, and concise reference/status guidance.
- `frontend/src/styles/admin.css`: adds environment-matched presentation and
  responsive behavior for the Billing preparation form.
- `change_log.txt` and `docs/development-change-log.md`: document the UX change.

### Impact assessment

- **API/database/configuration/dependencies:** no impact; no endpoints, request
  payloads, schema, environment variables, or packages changed.
- **Security/privacy:** no impact; authorization and server-side processing
  remain unchanged, and no additional data is displayed or collected.
- **Accessibility:** persistent labels supplement the existing accessible names;
  focus visibility remains explicit, read-only state is visually distinct, and
  the form becomes single-column on very narrow screens.
- **Deployment:** frontend deployment only; no backend restart or migration is
  required for this refinement.
- **Product scope:** no change to Billing processing or official payroll-list
  generation, and no out-of-scope payment-release behavior was introduced.

### Validation, limitations, rollback, and next work

Frontend ESLint, the Vite production build, and Git whitespace checks passed.
The layout remains intentionally compact for the Scholar drawer and changes to
one column only below 360 pixels. Rollback consists of removing the added form
heading/guidance and restoring the previous form CSS; it has no data impact.
Recommended next work is deployed visual confirmation at desktop and mobile
drawer widths before applying the same pattern elsewhere.

## 2026-09-08 - Shared Billing-to-Payroll Flow for All School Classifications

### TL;DR

- Public- and private-school scholars now both follow Billing first and may then enter the official Payroll list.
- The separate School Year/Semester controls, editable pre-processing Billing status, automatic billing reference, and new-session behavior in the Scholar Billing tab were retained.
- Payroll accepts only active scholars already processed through Billing for the selected period; it does not release or mark money as paid.
- School-specific document applicability, staff authorization, duplicate protection, and historical period locking remain enforced.

### Objective and reason

The classification-only process sent private-school scholars exclusively to
Billing and public-school scholars directly to Payroll. Staff requested the
earlier shared operational sequence in which both classifications are billed
before they can be placed on the official payroll list. The change is limited
to Billing and Payroll routing and presentation; unrelated scholarship stages
remain unchanged.

### Previous and new behavior

Previously, Billing displayed and accepted only private-school scholars, while
Payroll displayed and accepted only public-school scholars. The Scholar drawer
also routed public scholars directly to Payroll and labelled their Billing
status as not applicable.

Now both classifications start in Billing. After requirements are cleared,
staff can edit the active-period billing details, queue the scholar, and select
Process Billing. The system generates the billing reference and marks the
scholar billed. The same scholar then becomes selectable in Payroll, where
Generate payroll list adds the billed record to the official list. Unbilled
scholars may be visible in Payroll for context but are labelled Billing
required first and cannot be moved into the Payroll queue.

### Affected roles and workflow

Super Administrators, Regular Administrators with the necessary section
access, and Billing/Payroll staff continue using their existing permissions.
The staff workflow is now Scholar Billing tab -> Billing preparation and
processing -> Payroll-list generation for both public- and private-school
scholars. Billing overrides remain restricted to Super Administrators and
Billing/Payroll Administrators and still require a recorded reason.

### Implementation and data flow

`getScholarManagement` now derives progress from stored period records rather
than treating school classification as a terminal route. A billing reference
or period claim establishes the Billed state; association with a generated
Payroll batch establishes inclusion in Payroll. School classification still
determines the applicable requirement set: the tuition receipt remains a
private-school requirement and is not imposed on public-school scholars.

Billing processing no longer rejects public-school selections. It continues
to revalidate activity, requirements, duplicate status, and any authorized
override on the server, then creates a Billing batch, claim, amount, and
automatic billing reference transactionally. Payroll processing now requires
the corresponding active, pending Billing claim, creates the official Payroll
batch, and advances that claim to `listed`. The claim is associated with the
generated Payroll batch while the original billing reference remains stored
on the scholar's period requirement record.

The Scholar Billing tab retains its separate School Year and Semester
selectors, read-only system reference, editable pre-processing status, active
period selection, completed-period lock, and short-lived handoff. Its prepare
action now consistently opens Billing because Billing is again the first
processing stage for every scholar.

### Files and system areas changed

- `backend/controllers/applicationController.js`: restores shared Billing
  eligibility and requires a billed record before Payroll-list generation.
- `backend/middleware/activityAudit.js`: describes Payroll activity as a list
  of billed scholars rather than a classification-specific operation.
- `backend/tests/activityLog.test.js` and
  `backend/tests/lifecycleIntegrity.test.js`: align assertions and descriptions
  with the shared process while retaining school-specific requirements.
- `frontend/src/BillingPayrollManagement.jsx`: shows both classifications in
  each workspace and applies sequential Billing/Payroll queue eligibility.
- `frontend/src/ScholarsManagement.jsx`: retains the redesigned Billing tab and
  directs new session preparation to Billing for both classifications.
- `change_log.txt` and `docs/development-change-log.md`: record this change.

### Impact assessment

- **API:** endpoint paths and request shapes are unchanged. Billing now accepts
  either school classification; Payroll now requires an existing billed claim
  for the selected active academic period.
- **Database:** no migration or new table is required. Existing Billing claims
  are advanced to the generated Payroll batch, and the period-specific
  `billing_reference` remains the durable evidence of Billing processing.
- **Configuration/dependencies:** no environment variable, dependency, build,
  or service configuration changes.
- **Security:** server-side role, section-access, active-period, eligibility,
  override, concurrency, and duplicate checks remain authoritative.
- **Privacy:** no new personal information is collected, exposed, exported, or
  stored in browser handoff state.
- **Accessibility:** status text explicitly distinguishes Ready for payroll,
  Billing required first, and inactive records; the established keyboard and
  labelled control behavior is unchanged.
- **Deployment:** backend and frontend deployment are both required when this
  change is released; no database migration step is required.
- **Product scope:** Payroll still ends at official list generation. No fund
  release, claiming, disbursement confirmation, reconciliation, or monetary
  audit behavior was introduced.

### Validation and results

All 82 backend tests passed. Backend controller and middleware syntax checks
passed. Frontend ESLint passed, and the Vite production build completed after
transforming 491 modules. Git whitespace validation passed.

### Limitations, rollback, and recommended next work

The current data model uses the same period claim as it advances from Billing
to the generated Payroll batch; the Billing reference remains on the scholar
period record and the original Billing batch retains its aggregate record.
This preserves the existing one-claim-per-scholar-per-period constraint
without a migration. A future reporting enhancement may present the two
milestones more explicitly without changing that constraint.

Rollback can restore classification-only filters and validation while leaving
existing period records valid; already generated references or lists must not
be deleted silently. Recommended next work is an end-to-end deployed test with
one public- and one private-school scholar in the same active period, checking
requirements, Billing references, Payroll eligibility, duplicate prevention,
and historical locking.

## 2026-09-07 - Scholar-to-Billing/Payroll Session Handoff

### TL;DR

- Preparing a scholar session now opens the correct operational workspace automatically: Private scholars go to Billing and Public scholars go to Payroll.
- The destination opens the exact active School Year/Semester selected in the Scholar drawer and focuses the prepared scholar.
- The handoff is short-lived, browser-session-only, contains only internal numeric identifiers, and is cleared after loading.
- Existing requirements, routing rules, duplicate checks, and the official-payroll-list scope boundary remain unchanged.

### Objective and reason

The session-preparation form correctly created a scholar-period record, but the
staff member still had to leave Scholars, open Billing or Payroll, reselect the
same processing period, and search for the scholar again. The objective was to
remove those repeated navigation steps without bypassing either workspace's
normal readiness checks.

### Previous and new behavior

Previously, Prepare session saved the selected period and remained in the
Scholar drawer. Billing and Payroll independently defaulted to the Primary
System Period, so a session prepared for another active period could appear
missing until staff manually changed the Processing period selector.

Now the action is labelled Prepare & open Billing or Prepare & open Payroll,
according to the scholar's server-derived school route. After the metadata save
succeeds, the dashboard opens that section. Its Processing period is initialized
to the prepared period, the record list is loaded from the period-scoped API,
and the prepared scholar is focused using the existing search filter. A success
notice confirms the scholar and period that were loaded.

### Roles, workflow, and implementation

Authorized staff select an active period in the Scholar Billing & Payroll tab
and use the single preparation action. Private-school scholars hand off to
Billing; Public-school scholars hand off to Payroll. Staff then complete the
existing requirement/detail review and queue process. Preparation does not
automatically mark a scholar eligible or add the scholar to a processing queue.

`frontend/src/utils/processingHandoff.js` writes a ten-minute session-scoped
context containing only `periodId`, `applicantId`, route mode, and creation time.
`BillingPayrollManagement` reads a context only when its mode matches, requests
the exact period, locates the applicant in the returned current records, focuses
the row through the search field, then removes the context. Invalid, mismatched,
expired, or unavailable browser storage safely falls back to the existing UI.

### Files and system areas changed

- `frontend/src/ScholarsManagement.jsx`: saves the handoff and routes staff to
  Billing or Payroll after successful preparation.
- `frontend/src/BillingPayrollManagement.jsx`: initializes the processing
  period, focuses the prepared scholar, and reports handoff success/failure.
- `frontend/src/utils/processingHandoff.js`: validates, expires, and clears the
  temporary session handoff.
- `change_log.txt` and `docs/development-change-log.md`: document the integrated
  staff workflow.

### Impact assessment

- **API/database:** no new endpoint, request field, table, migration, or data
  duplication. Both workspaces continue reading the period-scoped scholar API.
- **Security/privacy:** the backend remains authoritative for active-period,
  role, section, school-route, eligibility, and duplicate enforcement. The
  browser handoff contains no name, email, control number, document, or token;
  it expires after ten minutes and is cleared on consumption.
- **Accessibility:** the destination's existing period selector, search input,
  and textual status notice expose the resulting context; no color-only state
  was introduced.
- **Configuration/dependencies/deployment:** no configuration or dependency
  changes; frontend deployment only.
- **Scope:** the handoff ends in Billing preparation or official payroll-list
  preparation. It does not add fund release, payment claiming, disbursement,
  reconciliation, or monetary auditing.

### Validation, limitations, rollback, and next work

Frontend ESLint and the production build passed, as did Git whitespace checks.
The existing 82-test backend suite and syntax checks had already passed for the
period-scoped metadata behavior and were not invalidated by this browser-only
handoff.

The handoff focuses one scholar at a time and intentionally does not preselect
or enqueue the scholar, because readiness must remain visible and staff-driven.
If session storage is disabled, preparation still saves safely but remains in
the Scholar drawer. Rollback can remove the temporary utility and navigation
calls without changing stored scholar-period records. Recommended next work is
period-specific requirement assistance in the destination workspace.

## 2026-09-07 - Scholar New-Session Preparation Workflow

### TL;DR

- School Year and Semester now select the scholar's active processing session instead of editing labels on the completed session.
- Staff can move from a locked processed period to another active period, where the reference is empty and the new session is editable.
- Saving writes metadata to the exact selected period; same-period processed sessions remain immutable.
- Historical billing and payroll-list records are preserved, and the workflow remains within official payroll-list generation.

### Objective and reason

The four compact fields are intended to prepare a scholar for a new Billing or
Payroll session. The first implementation correctly displayed them but disabled
the School Year and Semester controls whenever the currently displayed period
had already been processed. That prevented the controls from performing their
actual rollover function.

### Previous and new behavior

Previously, a processed Billing or payroll-list record disabled all fields. The
metadata endpoint also saved the selected labels into the Primary System
Period's requirement row, so choosing another period did not truly change the
scholar's processing context.

Now, School Year and Semester remain available for authorized staff even when
the displayed session is locked. Only active configured period combinations
are offered. Selecting a pair reloads that scholar from the server for the
chosen period. If it has no processed claim, the prior Billing Reference is not
carried forward, its status begins as Not billed yet or Not applicable according
to school route, and the Prepare session action becomes available. If that pair
was already processed, it remains locked and is shown as historical state.

### Roles, workflow, and data flow

Authorized Billing users and Super Administrators select an active School Year
and Semester in the Scholar drawer. The frontend requests
`GET /api/scholars/management?academicPeriodId=<id>`, replaces only the open
scholar detail with the selected-period representation, and retains the other
processed sessions in history. Background refreshes do not overwrite a drawer
that is intentionally viewing a non-primary period.

On Prepare session, the existing protected metadata endpoint verifies that the
period is still active, checks duplicate processing against that period, and
upserts `scholar_requirements` using the selected period as
`billing_period_id`. It no longer writes another period's labels into the
Primary System Period row.

### Files and system areas changed

- `frontend/src/ScholarsManagement.jsx`: enables period switching after
  processing, loads the selected-period scholar state, and changes the action
  label to Prepare session.
- `backend/controllers/applicationController.js`: returns the current context's
  academic-period ID and writes metadata to the selected active period.
- `change_log.txt` and `docs/development-change-log.md`: document the corrected
  operational meaning.

### Impact assessment

- **API:** no new route; the existing management query parameter and metadata
  payload are now used consistently for the selected period.
- **Database:** no additional schema change beyond the already prepared
  Not-billed-yet migration; writes target the correct existing unique
  scholar-period row.
- **Security/privacy:** server-side active-period validation, duplicate checks,
  authentication, role/section authorization, rate limiting, and Activity Logs
  remain in place. No new personal data is returned.
- **Accessibility:** native labelled selectors remain keyboard accessible;
  loading and locked states use disabled controls and textual feedback.
- **Configuration/deployment:** no dependency or environment change.
- **Scope:** completed payroll-list records remain immutable. No fund release,
  payment claiming, disbursement, reconciliation, or monetary auditing is added.

### Validation, limitations, rollback, and next work

All 82 backend tests passed. Frontend lint and production build, backend syntax,
and Git whitespace validation passed. End-to-end authenticated verification is
required after deployment using two active periods: open a processed scholar,
choose the second period, confirm the old reference disappears, then prepare
the fresh session.

Only active periods can prepare new sessions; archived periods remain visible
through history rather than the preparation selectors. Rollback can restore the
previous drawer/controller behavior without deleting any newly created
scholar-period row. Recommended next work is requirement carry-forward guidance
for staff, not automatic copying of approvals without policy confirmation.

### Production deployment outcome

Commit `06a15c0` was pushed to `main` on 2026-09-07. The live Vercel dashboard
bundle contained both `Prepare session` and the selected-period loading/error
flow, confirming the corrected controls are available in production. Render's
health endpoint returned HTTP 200 with a healthy connected database. The
authenticated period-switch and preparation action is ready for staff testing;
the untracked ERD files were not staged or modified.

## 2026-09-07 - Compact Scholar Billing Period Form

### TL;DR

- Replaced the combined academic-period field with separate School Year and Semester selectors in the Scholar Billing & Payroll tab.
- Kept Billing Reference read-only and blank until Process Billing generates it.
- Made Billing Status directly editable before processing and changed its initial private-school value to `Not billed yet`.
- Processed records remain locked, Public scholars remain `Not applicable`, and no billing or payroll-list history is removed.

### Objective and reason

The objective was to match the supplied compact two-column reference and make
routine billing setup faster for staff. The former interface required opening
a separate Edit state and selecting one combined school-year/semester label,
which made the two values harder to scan and adjust independently.

### Previous and new behavior

Previously, Processing details rendered as a read-only definition list until
staff clicked Edit. The edit form stacked Billing Reference, one combined
academic-period selector, and Billing Status vertically. New requirement rows
defaulted to the technical label `Pending`.

Now, opening Billing & Payroll immediately presents a two-by-two field grid:
School Year, Semester, Billing Reference, and Billing Status. Selecting a
school year limits Semester to configured combinations, and saving resolves
the pair back to its validated academic-period identifier. The system selects
the scholar's saved period first, then the Primary System Period as the default.
Billing Reference remains read-only and displays the requested placeholder
until Process Billing creates the batch reference.

### Affected roles and workflows

- Authorized Billing users and Super Administrators can edit and save the
  period and pre-processing status without entering a separate edit mode.
- Private-school scholars begin as `Not billed yet`; staff may choose Ready for
  billing or On hold before processing.
- Public-school scholars retain the Payroll route and a disabled Not applicable
  Billing Status.
- Once a scholar is included in Billing or the official payroll list, all four
  controls remain visible but locked to protect the completed period record.

### Implementation and data flow

The frontend derives unique School Year options from configured academic
periods and derives Semester options from the selected year. On save it finds
the exact configured pair and sends its numeric identifier plus Billing Status
to the existing protected metadata endpoint. The backend retains independent
validation and writes the existing period metadata fields.

The Prisma default for `scholar_requirements.billing_status` is now
`Not billed yet`. An additive migration changes the PostgreSQL default and
updates only legacy `Pending` requirement rows that have no processed claim for
the same scholar and period. Processed history is excluded from the backfill.

### Files and system areas changed

| Area | Change |
|---|---|
| `frontend/src/ScholarsManagement.jsx` | Added separate linked selectors and the always-visible four-field billing form |
| `frontend/src/styles/admin.css` | Added compact two-column styling, accessible hidden labels, focus states, and locked states |
| `backend/controllers/applicationController.js` | Normalizes legacy Pending values to Not billed yet in scholar-management responses |
| `backend/middleware/validators.js` | Accepts the new editable status while retaining legacy Pending compatibility |
| `backend/prisma/schema.application.prisma` | Changes the billing-status default |
| `backend/prisma/migrations/20260907040000_default_not_billed_status/migration.sql` | Changes the database default and safely backfills unprocessed rows |
| `backend/tests/billingMetadata.test.js` | Covers the new status as a supported pre-processing value |

### Impact assessment

- **API:** request shape remains compatible; the academic period is still sent
  as `academicPeriodId`, and `Not billed yet` is now an accepted status.
- **Database:** an additive default change and bounded backfill affect only
  unprocessed legacy Pending rows. No reference, claim, batch, or history row
  is removed.
- **Configuration/dependencies:** no changes.
- **Security/privacy:** authentication, roles, section access, rate limiting,
  server validation, and Activity Logs remain unchanged. No additional personal
  data is displayed.
- **Accessibility:** every visually compact field retains an accessible label;
  keyboard focus is explicit and disabled fields are programmatically locked.
- **Deployment:** Render must apply the additive migration before serving the
  updated API; no Vercel configuration change is needed.
- **Product scope:** unchanged. Payroll functionality ends at generation of the
  official payroll list and does not perform fund release or monetary auditing.

### Validation, limitations, rollback, and next work

The backend suite, Prisma schema validation, backend syntax, frontend lint and
production build, and Git whitespace checks are run before deployment.

School Year and Semester are visually separate but intentionally restricted to
configured pairs so staff cannot create an orphan billing label. New academic
periods must still be created in Settings. Rolling back the interface can leave
the new textual default in place safely; reverting the database default should
not rewrite already stored statuses. Recommended next work is the planned
requirements-side assistance for starting a new active billing period.

### Production deployment outcome

Commit `a048fdf` was pushed to `main` on 2026-09-07. Vercel returned HTTP 200,
and inspection of its production dashboard bundle confirmed the new `BILL REF
NO.`, `Not billed yet`, and `Save changes` interface text. Render's live health
endpoint returned HTTP 200 with a healthy connected database after the push;
its build pipeline applies the additive billing-status migration before API
startup. The untracked ERD files were not staged or modified.

## 2026-09-07 - Multiple Active Period Activation Hotfix

### TL;DR

- Removed the legacy database index that unintentionally blocked activation of a second academic period.
- Preserved the separate rule requiring exactly one Primary System Period for single-default workflows.
- Improved the activation API response if a deployment is briefly serving code before the corrective migration is available.
- No period, billing, payroll-list, requirement, or applicant records are deleted or rewritten.

### Objective and reason

Production correctly exposed the new multi-period interface and primary-period
field, but activating a second period returned a generic server error. Schema
inspection found that the original baseline migration had created the partial
unique index `academic_periods_single_active_idx`, which permits only one row
whose `is_active` value is true. The initial multi-period migration added the
new primary constraint but omitted removal of this obsolete index.

### Previous and new behavior

Previously, PostgreSQL rejected the second active row before the controller
could complete activation. After this hotfix, any number of periods may be
active, while `academic_periods_one_primary_idx` still permits only one primary
row and `academic_periods_primary_requires_active` ensures that primary row is
active.

### Roles, workflow, and implementation

Super Administrators, Administrators, and authorized Billing / Payroll staff
continue using the existing Activate action in Settings. A new additive
migration performs only `DROP INDEX IF EXISTS` for the obsolete single-active
index. The activation controller also maps a Prisma uniqueness conflict to a
clear HTTP 409 retry message rather than presenting a generic HTTP 500 banner.
All selected-period Billing and payroll-list behavior is otherwise unchanged.

### Files and system areas changed

- `backend/prisma/migrations/20260907030000_remove_single_active_period_index/migration.sql`
  removes only the obsolete partial unique index.
- `backend/controllers/applicationController.js` improves activation conflict
  handling during a rolling deployment.
- `change_log.txt` and `docs/development-change-log.md` record the correction.

### Impact assessment

- **API:** successful activation behavior is restored; a remaining uniqueness
  conflict returns HTTP 409 with safe retry guidance.
- **Database:** one obsolete index is removed. Tables and stored rows are not
  changed, and the primary-period unique index/check constraint remain intact.
- **Configuration/dependencies:** no changes.
- **Security/privacy:** authentication, role authorization, section access,
  and Activity Log behavior remain unchanged; no private data is exposed.
- **Accessibility:** the existing inline textual error region receives the
  clearer message; no interaction or keyboard behavior changes.
- **Deployment:** Render must run the new migration before starting the updated
  service. The existing build pipeline already uses this order.
- **Product scope:** unchanged; Payroll still ends at official payroll-list
  generation with no fund release, claiming, disbursement, reconciliation, or
  monetary audit functionality.

### Validation, limitations, rollback, and next work

The Prisma application schema, backend automated suite, backend syntax,
frontend lint/build, and Git whitespace checks are rerun before deployment.
Production verification will confirm database health, primary-period output,
and successful persistence of more than one active period through the
authenticated Settings workflow.

Rollback should not recreate the obsolete index while multiple active rows
exist because doing so would fail or require archiving staff-selected periods.
If strict single-active behavior is intentionally restored later, staff must
first choose and preserve one active period through a controlled migration.

### Production deployment outcome

The hotfix was pushed to `main` as commit `d2068d6`. Render's deployment path
includes Prisma migration deployment before service startup. After rollout,
`/api/health` returned HTTP 200 with a healthy connected database and
`/api/academic-periods/active` returned HTTP 200 with `isPrimary: true`.
Because activation is an authenticated mutation, the final end-to-end action
is intentionally left to an authorized staff tester in Settings. The untracked
ERD files were not staged or modified.

## 2026-09-07 - Multiple Active Academic Periods with a Primary System Period

### TL;DR

- Staff can keep several school-year/semester periods active at the same time and select the intended period directly in Billing or Payroll.
- Exactly one active period is designated as the Primary System Period for applications, examinations, document review, and other workflows that require a single safe default.
- Billing and payroll-list batches, scholar requirements, references, and duplicate checks use the explicitly selected active period; historical records are preserved.
- The change is additive and passed 82 backend tests, Prisma schema validation, backend syntax checks, frontend lint/build, and Git whitespace checks.

### Objective and reason

The objective was to let staff test and operate more than one academic period
without forcing a rollover that archives the previous period. A simple removal
of the single-active-period rule would have made application, examination, and
document workflows ambiguous. The new model therefore combines multiple
processing periods with one explicit Primary System Period.

### Previous and new behavior

Previously, activating a period automatically archived every other active
period. Billing, payroll-list generation, application intake, examinations,
document review, and reports all implicitly used whichever single row was
active.

Now, activating a period adds it to the active set and leaves existing periods
active. Settings identifies the primary period, shows the active-period count,
and provides actions to set another active period as primary or deactivate a
non-primary period. The primary period cannot be deactivated until another
period is selected as primary. Billing and Payroll show a Processing period
selector and reload their records for that period before editing or processing.
Same-scholar duplicate processing remains blocked within each period.

### Affected roles and workflows

- **Super Administrator, Administrator, and Billing / Payroll staff:** can use
  the existing Settings permissions to activate periods, set the primary
  period, and deactivate non-primary periods.
- **Billing / Payroll staff:** explicitly select an active processing period;
  billing-detail edits, Process Billing, and payroll-list generation are bound
  to that selection.
- **Applicants and examination staff:** continue using one predictable primary
  period, so their existing process flow does not change.
- **Document reviewers and Reports users:** default to the primary period when
  no period is explicitly requested.

### Implementation and data flow

`academic_periods.is_primary` records the single global default. An additive
migration promotes the most recently updated existing active period and adds a
partial unique index so PostgreSQL permits only one primary row. A check
constraint prevents a primary period from being inactive.

The academic-period API now serializes `isPrimary`. Activation no longer
archives other rows. Dedicated protected actions set the primary period and
deactivate non-primary periods. The scholar-management read endpoint accepts
an optional active `academicPeriodId`, returns all active choices, and scopes
requirements and processed status to the selected period. Billing-detail,
billing-process, and payroll-process requests send the selected identifier;
the backend independently verifies that it still refers to an active period.
Clients that omit the identifier continue to use the primary period.

Production bootstrap now repairs an older installation that has an active row
but no primary row, and creates the default period as both active and primary
on an empty installation.

### Files and system areas changed

| Area | Change |
|---|---|
| `backend/prisma/schema.application.prisma` | Added the `is_primary` academic-period field and index |
| `backend/prisma/migrations/20260907020000_multiple_active_academic_periods/migration.sql` | Backfills one primary period and enforces primary uniqueness/activity |
| `backend/controllers/applicationController.js` | Added primary/selected-period resolution and period-aware billing/payroll operations |
| `backend/controllers/documentReviewController.js` | Uses the primary period for single-default requirement review work |
| `backend/controllers/lifecycleReportController.js` | Uses the primary period as the default report period |
| `backend/routes/applicationRoutes.js` | Added protected primary-selection and deactivation endpoints |
| `backend/scripts/bootstrap-production.js` | Ensures a primary period exists after clean or legacy bootstrap |
| `frontend/src/SettingsManagement.jsx` | Added multi-active status, primary selection, and safe deactivation controls |
| `frontend/src/BillingPayrollManagement.jsx` | Added the active Processing period selector and selected-period request payloads |
| `frontend/src/styles/admin.css` | Added responsive period-selector and Settings action styling |

### API, database, configuration, and deployment impact

- **API:** `GET /api/scholars/management` accepts optional
  `academicPeriodId`; billing-detail, billing-process, and payroll-process
  mutations accept the same field. `PUT /api/academic-periods/:id/primary` and
  `PUT /api/academic-periods/:id/deactivate` were added. Existing callers remain
  compatible through primary-period fallback.
- **Database:** one additive Boolean column, indexes, and a check constraint
  are added. Existing periods and billing/payroll-list history are not deleted
  or rewritten beyond marking the latest active period as primary.
- **Configuration/dependencies:** no environment variable, package, or external
  service changes are required.
- **Deployment:** the backend migration must run before the updated API starts;
  the existing Render build pipeline already performs Prisma generation and
  migration deployment in that order.

### Security, privacy, accessibility, and scope impact

All new mutations retain authentication, role checks, section-access checks,
rate limiting where already applied, and Activity Log middleware. The server
does not trust the browser's period label and accepts only a positive identifier
for a currently active period. No private documents or personal data are added
to responses. Native labelled selectors and textual Primary/Active states keep
the interface keyboard- and screen-reader-compatible and do not rely on color
alone.

The approved product boundary is unchanged: Payroll produces the official
payroll list only. This work does not add fund release, claiming, disbursement,
reconciliation, or monetary auditing.

### Validation results

- Backend automated suite: **82 passed, 0 failed**.
- Prisma application schema validation: passed.
- Backend controller, route, and bootstrap `node --check`: passed.
- Frontend ESLint: passed.
- Frontend production build: passed.
- Git whitespace validation: passed.

Local Prisma client regeneration reached the Windows replacement step but the
existing query-engine DLL was locked by a running local Node process. No process
was terminated because it may have been the user's server. Schema validation
passed. Render's clean build subsequently regenerated the client, applied the
additive migration, and started the updated API without that workstation-only
file lock.

### Production deployment outcome

Commit `2e904b3` was pushed to `main` and deployed on 2026-09-07.

| Service | Verification result |
|---|---|
| Vercel frontend | Returned HTTP 200 and its deployed dashboard bundle contained both the Processing period selector and Primary System Period controls |
| Render backend | `/api/health` returned HTTP 200 with `healthy` and `database: connected` |
| Database migration/API | `/api/academic-periods/active` returned HTTP 200 with `isPrimary: true`, confirming the new field and primary-period resolution are live |
| Workspace hygiene | The untracked ERD Markdown, Mermaid, PNG, and SVG files were not staged or changed |

### Known limitations, rollback, and next work

Requirements are period-specific. A newly activated period therefore begins
with fresh requirement and processing state; staff may need to confirm or
record that period's physical-folder status before processing. The Scholar
drawer still defaults to the Primary System Period, while the operational
Billing and Payroll workspaces provide explicit multi-period selection.

Rollback should restore the former activation/controller and frontend behavior
but leave `is_primary` and the additive migration in place to avoid destructive
schema reversal. Non-primary active rows can be deactivated through Settings
before rollback if strict single-period behavior is required. Recommended next
work is to complete the planned separation of School Year and Semester fields
and add clearer period-specific requirement carry-forward assistance for staff.

## 2026-09-07 - New Academic-Period Billing Cycle Guidance

### TL;DR

- Preserved completed Billing and Payroll records as immutable history instead of reopening them for editing.
- Added an in-context action that takes authorized staff from a processed Scholar record to academic-period setup in Settings.
- Activating the next academic period uses the existing period-based data model to present a fresh cycle with no reference; duplicate processing in the same period remains blocked.
- Corrected Public-school helper text so a legacy billing record does not obscure the current Payroll-only route.
- Verification passed: frontend lint and production build.

### Objective, reason, and behavior

The objective was to answer the operational need for another billing cycle
without overwriting a completed record. A processed scholar previously showed
read-only details with no explanation of the next step. Staff could already
create and activate academic periods in Settings, and the database already
stores requirements and claims per scholar and academic period, but that path
was not visible from the locked record.

Processed Scholar drawers now show **Need another billing cycle?** for the
Private-school Billing route or **Need another payroll cycle?** for the
Public-school Payroll route. The message explains that the completed period
remains locked and that the next academic period starts a fresh record with no
reference. Staff with Settings access can use **Set up the next academic
period** to navigate there directly; staff without access receive a clear
instruction to contact an authorized administrator.

After a new period is created and activated, the existing active-period lookup
loads a new scholar-period state: no processed claim, no Billing Reference, and
editable pre-processing metadata. Process Billing generates the reference only
for Private-school scholars when that new cycle is processed. Public-school
scholars continue to bypass Billing and enter Payroll-list generation. A second
record in the same academic period remains prohibited by the existing unique
database constraint and server-side duplicate check.

### Roles, implementation, and files

Billing / Payroll Admins, Administrators, and Super Administrators with Settings
access can follow the shortcut. Other staff can see the required next step but
cannot bypass their assigned sections. `Dashboard.jsx` passes its existing
section-navigation callback to `ScholarsManagement.jsx`; the Scholar drawer
renders route-aware guidance only for a processed cycle. `admin.css` provides
responsive, keyboard-visible presentation. The Public-school Billing summary
now explicitly says that the scholar follows the Payroll route, and the Payroll
summary describes payroll-list preparation without requiring a nonexistent
Billing step.

Changed areas:

- `frontend/src/Dashboard.jsx`
- `frontend/src/ScholarsManagement.jsx`
- `frontend/src/styles/admin.css`
- `change_log.txt` and this detailed record

### API, database, configuration, security, privacy, accessibility, deployment, and scope impact

- **API/database:** no new endpoint, schema, or migration. The existing
  academic-period, scholar-requirement, claim, and duplicate-protection behavior
  is reused.
- **Configuration/dependencies:** no impact.
- **Security/privacy:** the shortcut does not grant access. Existing section
  permissions and backend role checks still govern period creation/activation;
  no additional personal information is exposed.
- **Accessibility:** the shortcut is a native button with visible keyboard focus,
  and the complete instruction is available as text rather than color alone.
- **Deployment:** frontend deployment only.
- **Scope:** no payment release, claim confirmation, disbursement,
  reconciliation, or monetary-audit capability was added. Public/Private school
  routing and the official payroll-list endpoint remain unchanged.

### Validation, limitations, rollback, and next work

Frontend ESLint and the Vite production build passed. This change intentionally
does not allow multiple billing batches for one scholar in the same academic
period. Starting the next cycle changes the system-wide active academic period,
so staff should activate it only during the actual rollover. Rollback can remove
the guidance and navigation callback without affecting any record. The next
planned task—separating School Year and Semester in the Scholar Billing tab—can
build on this period-safe workflow without changing completed history.

## 2026-09-07 - Billing Reference Generation at Processing

### TL;DR

- Billing references are now absent before processing and generated only by the existing **Process Billing** action.
- One billing batch number becomes the shared Billing Reference for every scholar included in that processed batch.
- Existing processed records are mapped to their real batch reference; premature references on unprocessed records are cleared.
- The change is transactional and does not add a new staff step or extend the workflow into payment activity.
- Verification passed: 82 backend tests, application Prisma schema validation, frontend lint/build, backend syntax, and Git whitespace checks.

### Objective and reason

The objective was to make the Billing Reference accurately represent an actual
billing operation. Previously, the database schema generated a reference as soon
as a scholar-requirement row was created, which could make an unprocessed scholar
appear to have an official billing record. The new behavior aligns the reference
with the staff action that creates that record and avoids misleading identifiers.

### Previous and new behavior

Previously, `billing_reference` was required and unique, and Prisma generated a
CUID before billing processing. The earlier migration also backfilled `BILL-...`
values for every requirement row. Consequently, saving other scholar information
could create a reference even though staff had not clicked Process Billing.

Now, the field is nullable and has no automatic default. Before processing, the
Scholar Billing & Payroll panel shows **Generated when billing is processed**.
When staff confirm Process Billing, the backend creates the billing batch,
creates its scholar claim rows, and assigns the new batch number to every
selected scholar's active-period requirement row in the same transaction. The
response also identifies that batch number explicitly as `billingReference`.

### Affected users and workflow

- **Billing / Payroll Admin, Administrator, and Super Administrator:** the
  existing queue and Process Billing interaction are unchanged; the reference
  becomes available only after that action succeeds.
- **Scholars/applicants:** no portal interaction or decision behavior changes.
- **Payroll staff:** public-school Payroll-list generation is unchanged and does
  not create a Billing Reference.

No extra confirmation, form field, or handoff was added. Failed or rolled-back
billing transactions leave no new reference behind.

### Implementation and data flow

`createBillingReference` produces the existing timestamp-based `BILL-` batch
identifier from the server processing time. `processBillingSelection` uses it as
the billing batch number. Within the existing database transaction, the selected
private-school scholars receive that same value in `billing_reference`; an
override edge case with no prior requirement row creates the necessary period
row inside the transaction. The reference is returned only after the transaction
succeeds.

The migration removes the old unique/default/not-null behavior because a batch
reference is intentionally shared by all scholars in that batch. It replaces the
unique index with a normal lookup index. Previously processed requirements are
set to their associated billing batch number. Requirements with no corresponding
billing batch are reset to `NULL`, correcting premature identifiers without
removing scholar, claim, batch, or document data.

### Files and system areas changed

- `backend/controllers/applicationController.js` - generates and assigns the
  reference during Process Billing.
- `backend/services/billingReference.js` - deterministic reference generator.
- `backend/tests/billingReference.test.js` - valid and invalid timestamp tests.
- `backend/prisma/schema.application.prisma` - nullable reference model.
- `backend/prisma/migrations/20260907010000_generate_reference_on_billing_process/migration.sql`
  - data correction and constraint/index update.
- `frontend/src/ScholarsManagement.jsx` - accurate pre-processing placeholder.
- `change_log.txt` and this detailed engineering record.

### API, database, configuration, security, privacy, accessibility, and deployment impact

- **API:** `POST /api/billing/process` keeps its request contract and adds
  `batch.billingReference`, equal to `batch.batchNumber`. Scholar-management
  responses return `null` until billing succeeds.
- **Database:** `billing_reference` becomes nullable and non-unique; a standard
  index remains. Existing processed data is reconciled to its batch number and
  unprocessed placeholder references are cleared. No record is deleted.
- **Configuration/dependencies:** no environment variable, dependency, or
  external service changes.
- **Security/privacy:** existing authentication, role checks, section access,
  rate limiting, eligibility enforcement, and Activity Logging remain in place.
  The reference contains only a processing timestamp and no personal data.
- **Accessibility:** only read-only helper text changed; existing labelled form
  controls and Process Billing button behavior remain intact.
- **Deployment:** the backend migration and regenerated application Prisma client
  must deploy with the frontend wording. No manual production data edit is needed.
- **Scope:** the reference identifies billing-list processing only. It does not
  represent fund release, claiming, payment, reconciliation, or monetary audit;
  the system boundary still ends at official payroll-list generation.

### Validation, limitations, rollback, and recommended next work

All 82 backend tests passed, including deterministic format and invalid-date
coverage for the generator. The application Prisma schema validated successfully.
Frontend ESLint and the production build passed, backend syntax checks passed,
and `git diff --check` reported no whitespace errors. Local Prisma client
regeneration was attempted but the Windows query-engine DLL was locked by an
already-running local Node process; stale temporary files were removed. A clean
deployment environment will regenerate the client through the existing Render
build command.

The reference is batch-level by design, so every scholar processed together has
the same reference. A later per-scholar invoice identifier would be a separate
business requirement and should not overload this field. Rollback would require
restoring the old constraint/default and deciding how to populate every null
reference; automatically recreating references for unprocessed scholars is not
recommended because it would restore the original misleading behavior.

The next queued task is to separate School Year and Semester in the Scholar
Billing tab, but it is intentionally excluded from this change so this behavior
can be reviewed independently.

## 2026-09-07 - Billing Staff Document Review Ownership

### TL;DR

- Retired the standalone Content Moderator role and moved document-review authority to Billing / Payroll staff; Super Administrators retain oversight.
- Made submitted online documents in a Scholar's Document checklist clickable for secure preview and approve/reject decisions in place.
- Preserved the full Document Reviews queue and existing review, correction, Activity Log, and billing-readiness behavior.
- Added a migration that disables legacy moderator accounts and invalidates their sessions without deleting historical review records.
- Verification passed: 80 backend tests, Prisma schema validation, frontend lint, and production build.

### Objective and reason

The change removes a narrowly scoped staff role and reduces handoffs before
billing preparation. Billing staff already depend on approved requirements to
determine whether a scholar can enter the appropriate Billing or Payroll-list
route, so giving that team the existing review tools lets them resolve a
document blocker while inspecting the scholar record instead of waiting for a
separate moderator. This does not add a new process step or alter the approved
scholar lifecycle.

### Previous and new behavior

Previously, Content Moderators and Super Administrators could use the Document
Reviews queue, while Billing / Payroll staff could see checklist statuses but
could not open or decide the files. The Staff editor could also create or assign
the Content Moderator role.

Now, Content Moderator is no longer assignable or accepted for login. Billing /
Payroll staff and Super Administrators can use the existing protected Document
Reviews queue. Within Scholars > View details > Overview, each submitted online
document is a keyboard-accessible button labelled "View and review." It opens
the established secure preview and confirmation dialogs, supports approval or
rejection with the same note rules, refreshes the scholar record after saving,
and shows the resulting status. Missing uploads and the physical-folder row are
not presented as digital previews; physical-folder receipt remains handled by
the existing queue control.

### Affected roles and workflows

- **Billing / Payroll Admin:** gains Document Reviews by role default and can
  review a specific file directly from the Scholar drawer or use the full queue.
- **Super Administrator:** retains document-review access and can oversee the
  same direct and queue-based workflow.
- **Administrator:** does not gain document-review authority; scholar checklist
  rows remain read-only.
- **Content Moderator:** the role is retired. Existing accounts are disabled and
  sessions invalidated; their historical names and decisions remain available.
- **Scholars/applicants:** upload, pending, rejected-correction, approved, and
  eligibility behavior is unchanged; portal wording now identifies Billing
  staff as the reviewer.

### Implementation and data flow

The role configuration, validators, login resolution, navigation, and route
authorization no longer accept Moderator. `documentReviews` was added to the
Billing / Payroll role defaults and to explicitly configured Billing accounts
by migration. All document-review endpoints now require either
`BillingPayrollAdmin` or `SuperAdmin` plus section access.

The scholar-management response now provides safe review metadata--application
ID, requirement key, filename, media type, timestamps, notes, and status--for
each checklist item. It does not expose encoded contents, blob URLs, or storage
tokens. Clicking a submitted online item requests the existing authenticated
stream endpoint, creates a browser-only object URL for preview, and uses the
existing review endpoint to save the decision and Activity Log metadata. The
object URL is revoked when the preview closes or changes.

### Files and system areas changed

- Administrator authentication, RBAC, section-access defaults, staff role
  configuration/validation, and production bootstrap.
- Document-review routes and Billing navigation.
- Scholar-management response serialization and Scholar drawer review controls.
- Applicant/Scholar guidance wording and review-related lifecycle messages.
- Staff management role options and retired-account presentation.
- Prisma migration `20260907000000_retire_content_moderator`.
- Automated staff, lifecycle, and rate-limit tests; this change documentation.

### API, database, configuration, security, privacy, accessibility, and deployment impact

- **API:** existing document-review endpoint shapes and decisions are preserved;
  authorized roles change to Billing / Payroll Admin and Super Administrator.
  Scholar-management items gain non-secret review metadata.
- **Database:** the migration disables rows whose legacy role is `moderator`,
  increments `auth_version`, and adds `documentReviews` to non-null explicit
  section lists for Billing accounts. No review record or staff row is deleted.
- **Configuration:** moderator bootstrap variables and the moderator seed command
  are removed; the normal Billing bootstrap remains.
- **Security:** server-side role and section checks remain mandatory for listing,
  streaming, and deciding documents. Legacy moderator sessions are invalidated;
  private file URLs and content remain hidden behind authenticated streaming.
- **Privacy:** no new document content is persisted or exposed in list responses.
  Existing reviewer identity, notes, and Activity Logs remain operational records.
- **Accessibility:** clickable checklist rows are native buttons with descriptive
  labels, keyboard focus styling, textual status, and the existing modal keyboard
  behavior; review meaning does not rely on color alone.
- **Deployment:** both frontend and backend must deploy, and Render must apply the
  migration before the retired-role policy is fully effective. No new secret or
  external service is required.
- **Scope:** no fund release, payment claiming, disbursement confirmation,
  reconciliation, or monetary-audit functionality was introduced. Payroll still
  ends at generation of the official scholar list.

### Validation, limitations, rollback, and recommended next work

All 80 backend tests passed. Prisma schema validation passed. Frontend ESLint and
the Vite production build passed. The build completed without the earlier
500-kB chunk warning. The secure preview still depends on supported browser
rendering and configured private blob storage; unsupported formats open through
the protected original-file link. The physical folder is not a digital file and
therefore remains a received/not-received control in the full queue.

Rollback requires restoring Moderator role authorization and navigation before
reactivating any legacy account. The disabling migration should not be reversed
blindly because doing so would restore credentials; account reactivation must be
an explicit Super Administrator action with a password reset. The next useful
staff-efficiency improvement should be measured against this shortened review
handoff rather than adding another workflow stage.

## 2026-09-07 — Applicant Data Quality Trial Rollback

### TL;DR

- Removed the trial Applicant Data Quality Dashboard following user evaluation.
- Restored the Dashboard summary API and interface to their pre-trial behavior.
- No applicant records, database structures, or earlier approved features were changed.
- Verification passed: 79 backend tests, backend syntax, frontend lint/build, and Git whitespace checks.

### Objective, behavior, and affected users

The objective was to cleanly reverse the first experimental roadmap phase after
it did not provide sufficient innovative value for the user. Administrators no
longer see the Applicant Data Quality score, aggregate issue cards, or review
shortcut on Dashboard. Recent Applications, Recent Activity, account metrics,
and all other administrator workflows retain their previous behavior. Applicant,
Scholar, and Moderator experiences remain unchanged.

### Implementation and data flow

The rollback removed the server-side data-quality assessment service and its
tests, returned `GET /api/dashboard/summary` to its previous minimized recent-
applicant query and response, and removed the corresponding Dashboard state,
panel, progress indicator, and styles. No data-quality results had been persisted,
so no data cleanup or migration was required.

### Files and system areas changed

- Dashboard summary controller.
- Administrator Dashboard component and styles.
- Removed data-quality assessment service and tests.
- `change_log.txt` and this detailed engineering record.

### API, database, configuration, security, privacy, accessibility, and deployment impact

- API: removed the experimental `dataQuality` object from the Dashboard summary;
  all earlier response fields remain unchanged.
- Database/configuration/dependencies: no impact and no migration required.
- Security/privacy: no authorization changes; the removed feature had exposed
  only aggregates and persisted no applicant information.
- Accessibility: the experimental progress indicator and issue cards were
  removed; existing Dashboard controls remain unchanged.
- Deployment: normal frontend/backend deployment required to publish the rollback.

### Validation, limitations, rollback, and next work

All remaining 79 backend tests passed. Backend syntax, frontend lint, frontend
production build, and Git whitespace checks passed. Reintroducing this exact
trial would require reverting the rollback commit, but future innovation work
should instead start from a separately approved concept. No known data recovery
or operational limitation remains from the trial.

## 2026-09-06 — Results Decision Support Panel Removal

### TL;DR

- Removed the visible Decision Support recommendation card from Examination Results details.
- Result review, re-evaluation, and scholar-acceptance controls remain available.
- Stored recommendation snapshots and server-side decision safeguards were retained; no data was deleted.
- Frontend lint and the production build passed.

### Objective, behavior, and affected users

The objective was to simplify the Examination Results drawer before introducing
further workflow improvements. Previously, authorized staff saw an eligibility
recommendation card containing a total score, factor breakdown, policy version,
and generated timestamp beneath each result. The drawer now proceeds directly
from Remarks to result-review and acceptance actions. This visual change affects
Super Administrators, Administrators, and Billing / Payroll Administrators who
can access Results. Applicant, Scholar, and Moderator interfaces are unchanged.

### Implementation and data flow

The recommendation card markup, its presentation-label mapping, and its dedicated
CSS rules were removed. Examination result loading and the backend eligibility
assessment engine were not changed. Existing immutable assessment records remain
in the database, and current acceptance safeguards—including any required human
decision reason—continue to be enforced. No workflow was extended beyond official
payroll-list generation.

### Files and system areas changed

- `frontend/src/ResultsManagement.jsx` — removed the Decision Support card.
- `frontend/src/styles/admin.css` — removed now-unused recommendation-card styles.
- `change_log.txt` and this detailed engineering record.

### API, database, configuration, security, privacy, accessibility, and deployment impact

- API/database/configuration/dependencies: no impact; no records or schema were removed.
- Security/privacy: server authorization and decision safeguards remain unchanged.
- Accessibility: removing the panel reduces drawer length and focus-independent
  reading content; remaining controls retain their existing labels and keyboard behavior.
- Deployment: frontend-only deployment; no migration or environment change required.

### Validation, limitations, rollback, and next work

Frontend lint and the production build passed. The underlying recommendation
payload is still returned by the current API for compatibility and continues to
support server-side decision rules; this change removes only its visible detail
card. Rollback requires restoring the removed JSX and CSS, with no data recovery.
Recommended next work is to assess whether the retained decision-support engine
should remain internal, be redesigned, or be retired through a separate reviewed
data and policy change.

## 2026-09-06 — Editable Scholar Billing Metadata

### TL;DR

- Scholar Billing & Payroll details now provide an inline editor for authorized Billing users before processing.
- Billing references are generated by the system and cannot be edited; configured school year/semester and pre-processing billing status can be changed.
- Public-school billing remains Not applicable, and processed Billing or Payroll records remain locked.
- Verification passed: 79 backend tests, Prisma generation, backend syntax checks, frontend lint/build, and Git whitespace checks.

### Objective, behavior, and affected users

The objective was to replace the read-only processing-detail list with the
requested focused fields: Billing Reference, School Year and Semester, and
Billing Status. Previously, the Scholar drawer displayed several derived claim
and batch values but provided no editor. Staff with Billing section access can
now edit the period label and pre-processing status directly in the Billing &
Payroll tab. The system-generated reference is visible but read-only. Private-
school records support Pending, Ready for billing, and On hold; Public scholars
remain Not applicable because their approved route bypasses Billing and proceeds
to official payroll-list generation. Applicants, Scholars using the portal,
Moderators, and staff without Billing access receive no editing control.

### Implementation and data flow

Each active-period `scholar_requirements` row now stores an immutable unique
billing reference, selected billing school year, selected semester, and billing
status. Existing rows receive deterministic references during migration and
inherit their linked academic-period labels. New rows receive a Prisma-generated
reference. The editor retrieves configured academic periods from the existing
Scholar management response and submits the selected period ID and allowed
status to a dedicated endpoint. The server resolves the period rather than
trusting client-provided labels, validates the status allowlist, rejects inactive
or missing scholars, and locks changes once an active-period processing claim
exists. Successful changes produce an operational Activity Log entry.

The editable school year and semester are billing display metadata for the
scholar's active requirement row; they do not activate an academic period or
move a processed claim. Existing Billing and official payroll-list generation
remain governed by the system's active academic period and school-classification
route.

### Files and system areas changed

- Backend Scholar controller, routes, validation, and activity-audit mapping.
- Prisma schema and additive billing-metadata migration.
- Scholar management drawer, role-aware editor state, and responsive admin styles.
- Billing metadata validation tests.
- `change_log.txt` and this detailed engineering record.

### API, database, configuration, security, privacy, accessibility, and deployment impact

- API: added `PUT /api/scholars/:applicantId/billing-metadata`; the Scholar
  management response now includes billing metadata and configured periods.
- Database: added unique `billing_reference`, nullable `billing_school_year` and
  `billing_semester`, and defaulted `billing_status` columns. The migration is
  additive and backfills existing requirement rows without deleting records.
- Configuration/dependencies: no new variables, packages, or external services.
- Security/privacy: role checks, Billing section access, rate limiting, server-side
  period/status validation, immutable references, and post-processing locks are
  enforced. No new personal data is collected.
- Accessibility: fields use associated labels, the reference exposes read-only
  state, errors use an alert role, and controls are native keyboard-operable
  inputs, selects, and buttons.
- Deployment: the backend migration and refreshed Prisma Client must deploy
  before the updated frontend uses the endpoint.

### Validation, limitations, rollback, and next work

All 79 backend tests passed, including four new billing metadata validation
tests. Prisma Client generation, backend syntax checks, frontend lint, frontend
production build, and Git whitespace validation passed. Billing status is a
pre-processing administrative label and cannot replace the system-generated
Billed state. Editing is intentionally unavailable after processing, and this
feature does not perform fund release, payment claiming, disbursement,
reconciliation, or monetary auditing. Rollback requires reverting the UI/API;
the additive columns may safely remain unused or be removed later through a
reviewed migration. Recommended next work is a component test for editor focus,
save errors, permission visibility, and processed-record locking.

## 2026-09-06 — Applicants Tabbed Workspace

### TL;DR

- Applicants, Schedules & Assignments, and Results now share one flat tab row.
- Super Administrators, Administrators, and Billing / Payroll Administrators retain their existing section-level visibility and access.
- The sidebar has one Applicants entry, with no dropdown or nested tab level.
- Frontend lint and the production build passed.

### Objective, behavior, and affected users

The objective was to reduce crowding in the administrator sidebar without
removing either workflow. Previously, Applicants and Examination Management
were separate top-level entries. They now appear as Applicants, Schedules &
Assignments, and Results in one tab row inside a shared Applicants workspace,
matching the requested flat control without a sidebar dropdown or sub-tabs.
This affects Super Administrators, Administrators, and
Billing / Payroll Administrators; Moderator, Applicant, and Scholar navigation
is unchanged.

### Implementation and data flow

The sidebar now exposes one Applicants item when the staff member has either
the `applicants` or `examination` section permission. Inside the workspace, each
tab is independently filtered by that existing permission value. Staff with
only Examination access open directly on Schedules & Assignments. The schedules
and results components render directly beneath the same top-level tab row, so
no application or examination data flow changed.

### Files and system areas changed

- `frontend/src/components/Sidebar.jsx` — single Applicants entry with combined
  permission visibility and active-state handling.
- `frontend/src/Dashboard.jsx` — permission-aware Applicants, Schedules &
  Assignments, and Results tabs with no nested workspace tabs.
- `change_log.txt` and this detailed engineering record.

### API, data, security, privacy, accessibility, and deployment impact

- API/database/configuration/dependencies: no impact.
- Security/privacy: no authorization rules changed; existing backend section
  enforcement remains authoritative, while unavailable tabs remain hidden.
- Accessibility: the workspace uses native buttons within a labelled navigation
  region and preserves the existing visible focus behavior.
- Deployment: frontend-only deployment required; no migration or environment
  variable change is needed.

### Validation, limitations, rollback, and next work

`npm.cmd run lint` and `npm.cmd run build` both passed. Validation covered the
compiled role-aware navigation and production asset generation. No automated
component test suite currently covers tab interactions; a future test could
exercise tab selection and permission combinations. Rollback is limited to
restoring the separate flat sidebar items; no stored data requires reversal.

## 2026-09-05 — Examination, Billing, Health, and Staff Section Access

### TL;DR

- Results now live inside Examination Management, and Super Admin System Health moved from Dashboard to Settings.
- Billing users can edit a scholar's active-period school, year level, course, major, billable amount, and notes before processing.
- Super Administrators can assign staff section access, enforced in both navigation and protected APIs.
- Existing staff keep role-default access until customized; access changes invalidate current sessions.
- Verification passed: 75 backend tests, frontend lint/build, Prisma generation, backend syntax, and whitespace checks.

### Objective, behavior, and affected users

The objective was to simplify navigation, place diagnostics with configuration,
allow pre-processing billing corrections, and give Super Administrators finer
staff-access control. Previously, examination schedules and results were
separate sidebar sections, System Health occupied Dashboard, billing details
were read-only, and access was controlled only by role and active status.

Schedules and results now share a tabbed Examination Management workspace.
System Health is in Settings and remains Super Administrator-only. Authorized
Billing users can correct active-period details until a Billing or Payroll
record exists. Super Administrators can choose the available sections for each
non-super staff account. Administrators and Billing / Payroll Administrators
can be limited to their normal role sections; Moderators can be limited to
Document Reviews, Announcements, and Settings. Applicant and Scholar workflows
are unchanged.

### Implementation and data flow

An additive `admins.section_access` JSON field stores section keys. Null
permissions resolve to prior role defaults for backward compatibility.
Authentication returns normalized permissions. The sidebar filters entries,
and route middleware independently rejects requests for unassigned sections.
Role checks remain authoritative, so section selection narrows rather than
elevates a role. Role, status, or permission changes increment
`auth_version`, signing out existing sessions. Super Administrator access
cannot be reduced, and existing self-demotion/final-admin safeguards remain.

The Billing editor writes school, year level, course, major, amount, and notes
to the active-period `scholar_requirements` record. New nullable
`billing_amount` and `billing_notes` columns preserve the values before
processing. Billing processing copies configured amounts to claims and totals
the billing batch atomically. Processed active-period records are locked.
Edits receive a dedicated operational Activity Log event.

### Files and system areas changed

- Backend authentication/RBAC, staff and application controllers, validators,
  routes, activity mapping, section-access service, Prisma schema/migration,
  and staff tests.
- Frontend app defaults, permission-aware sidebar, Staff permission editor,
  Examination tabs, Settings health placement, Billing editor, and styles.
- `change_log.txt` and this detailed engineering record.

### API, data, security, and deployment impact

- API: added `PUT /api/scholars/:applicantId/billing-details`; management
  endpoints now enforce assigned sections.
- Database: added nullable JSONB `admins.section_access`, decimal
  `scholar_requirements.billing_amount`, and text
  `scholar_requirements.billing_notes`; no destructive backfill.
- Configuration/dependencies: no new variables, packages, or services.
- Security/privacy: server enforcement prevents bypassing hidden navigation;
  permissions cannot exceed role capability; notes remain staff-only; no new
  public personal-data exposure.
- Accessibility: native buttons, labels, checkboxes, dialog semantics, and
  textual states are used, with responsive layouts.
- Deployment: the additive migration must run before the new backend. The
  standard Render migration flow covers it; no deployment was performed.

### Validation, limitations, rollback, and next work

Prisma client generation passed. All 75 backend tests, frontend ESLint, Vite
production build, backend syntax checks, and Git whitespace checks passed.

Permissions apply to whole sections rather than individual controls or records,
and changed staff must sign in again. Rollback should remove UI and enforcement
first; additive columns can remain safely, while dropping them would discard
configured data. Recommended next work is browser testing with representative
staff accounts after migration, then a separately controlled cleanup of legacy
payment-oriented code.

The approved workflow still ends when CAO generates the official payroll list.
No fund release, claiming, disbursement confirmation, reconciliation, or
monetary auditing was added. Legacy payment-oriented routes and display fields
remain unchanged for compatibility and outside the approved workflow.

## Entry format for future changes

Every material change should record:

1. TL;DR
2. Summary and objective
3. Previous behavior
4. New behavior
5. Affected users and workflow
6. Implementation and data flow
7. Files and components changed
8. API and database impact
9. Security, privacy, and accessibility impact
10. Validation results
11. Deployment and rollback notes
12. Known limitations and recommended next work

---

## 2026-09-02 — Minimal Classification-Only Routing Patch

### TL;DR

- Reverted the extra Billing/Payroll and Scholar-detail interface redesigns.
- Restored the original Billing & Payroll filters and established screen layout.
- Kept only the required branch: Private scholars in Billing, Public scholars in Payroll.
- Frontend lint/build and all 74 backend tests passed; no migration was required.

### Objective and behavior

The prior iterations changed more presentation and workflow terminology than
requested. This correction restores the pre-change administrative screens and
applies school classification only where necessary to select and validate the
processing destination. Private scholars are included in the Billing record
set; Public scholars are included in the Payroll record set.

The original filter group, exports, historical fields, metrics layout, queue
board, and Scholar Management details are retained. Only route-dependent
counts, readiness, queue membership, endpoint submission, and status wording
needed for the new branch differ from the original Billing/Payroll component.

### Users, implementation, and data flow

Super Administrators, Regular Administrators, and Billing / Payroll
Administrators use the familiar interface. The client filters the loaded
scholar records by `schoolType` for the active section. The backend continues
to resolve School Catalog classification independently, rejects Public records
from Billing, rejects Private records from Payroll, and prevents a client from
bypassing the route rule. Public Payroll processing ends at official list
generation; Private Billing records do not continue to Payroll.

### Files and impact

`frontend/src/BillingPayrollManagement.jsx` was restored close to its
pre-routing form with the minimum route predicates and compatible list state.
`frontend/src/ScholarsManagement.jsx` was fully restored to its pre-routing
version. Change documentation records that the broader UI revisions are
superseded.

There is no database, migration, configuration, dependency, security, privacy,
or deployment-topology change. Existing role authorization remains in force.
Native controls and the established keyboard interaction remain unchanged.
Legacy payment-oriented filters and historical display are retained for
compatibility, but the active Payroll mutation remains the in-scope official
payroll-list generator and does not release or reconcile funds.

### Validation, limitations, and rollback

Frontend ESLint and the Vite production build passed. All 74 backend tests and
backend syntax checks passed. Rollback requires reverting this client-side
restoration only; there is no data rollback. Historical records remain
untouched. Recommended follow-up is a production smoke test with one Private
and one Public scholar to confirm exclusive section placement.

## 2026-09-02 — Cross-Section Billing and Payroll Visibility

### TL;DR

- All scholars now remain visible in both Billing and Payroll workspaces.
- Private scholars are actionable in Billing; Public scholars are actionable in Payroll.
- Scholars shown outside their assigned route are clearly labelled and view-only.
- No API or data behavior changed; frontend lint and production build passed.

### Objective and behavior

The earlier classification change incorrectly used the assigned process route
as a visibility filter. The corrected behavior separates visibility from
processing authority. Both workspaces show the complete scholar list, while
classification continues to determine which records can enter the active
processing queue. The previous exclusive lists are replaced by cross-section
visibility with explicit route statuses.

### Users, implementation, and data flow

Super Administrators, Regular Administrators, and Billing / Payroll
Administrators can find any scholar from either section. Private scholars can
be selected only from Billing and display “Private — Billing route” in
Payroll. Public scholars can be selected only from Payroll and display
“Public — Payroll route” in Billing. Select movable and Select all continue to
include only records assigned to the active section.

`frontend/src/BillingPayrollManagement.jsx` now keeps all filtered records in
the source list, adds classification to the actionability checks, adapts
status text and tooltips for view-only rows, makes Assigned route an actual
filter, and reports total plus route-specific metrics.

### Impact, validation, and rollback

There is no API, database, configuration, security, privacy, or deployment
topology impact. Backend classification enforcement remains unchanged, so a
client cannot submit a scholar through the wrong route. Disabled rows and
textual route labels preserve keyboard and non-color accessibility. No fund
release, payment claiming, reconciliation, or monetary auditing behavior was
introduced. Frontend ESLint and the Vite production build passed.

Rollback affects only the Billing/Payroll component and requires no data
change. Recommended follow-up is a production visual check of both sections
using one Private and one Public scholar.

## 2026-09-02 — Billing and Payroll Filter Panel Restoration

### TL;DR

- Restored the filter controls mistakenly removed from the Billing/Payroll workspace.
- Added status and readiness filters tailored to the active Billing or Payroll route.
- Preserved the Private-to-Billing and Public-to-Payroll process rule without changing data or APIs.
- Frontend lint and the production build passed.

### Objective and behavior change

The classification-routing implementation incorrectly replaced the existing
Billing & Payroll filter group with a static explanation. This correction
restores the three-field panel. Administrators can filter by Billing or
payroll-list status and by processing readiness, while a read-only field makes
the active classification route explicit. The surrounding heading continues
to explain why only Private or Public scholars appear in the section.

### Users, implementation, and affected areas

Super Administrators, Regular Administrators, and Billing / Payroll
Administrators regain the operational filtering workflow. The change is
limited to `frontend/src/BillingPayrollManagement.jsx`: it adds two local
filter states, applies them to the existing client-side record set, resets
them with Clear filters, and restores the three-control visual group.

### Impact and validation

There is no API, database, configuration, security, privacy, or deployment
topology impact. Accessibility remains based on labelled native select
controls, including a disabled assigned-route field. School classification is
still enforced by the backend and no payment, release, reconciliation, or
monetary-audit behavior was restored. Frontend ESLint and the Vite production
build completed successfully.

Rollback is a single-component UI reversal and requires no data action. No
known functional limitation was introduced; recommended follow-up is a visual
smoke test of both modes after deployment.

## 2026-09-02 — School-Classification Billing and Payroll Routing

### TL;DR

- Private-school scholars now route to Billing only and cannot enter Payroll.
- Public-school scholars bypass Billing and route directly to official payroll-list preparation.
- Payroll now generates the in-scope list instead of recording payment completion, references, amounts, or payment notifications.
- No migration was required; historical records remain intact. All 74 backend tests, frontend lint/build, and backend syntax checks passed.

### Objective, previous behavior, and outcome

The objective was to make the scholar process depend on the authoritative
School Catalog classification. Previously, every eligible scholar entered
Billing, a pending payroll claim was created, and a later Payroll action marked
that claim paid. That sequence did not match the required classification rule
and its final action exceeded the approved payroll-list scope boundary.

Private scholars now appear only in Billing. Their completed billing record is
terminal and they cannot enter Payroll. Public scholars bypass Billing, appear
directly in Payroll, and can be included in the generated official payroll
list. Public readiness retains the common document-review and physical-folder
checks but omits the tuition-fee receipt that applies only to Private scholars.

### Affected users and workflow

Billing / Payroll Administrators, Regular Administrators, and Super
Administrators see classification-specific queues and explanatory text.
Billing eligibility overrides remain available only for Private scholars and
cannot override classification. Scholar Management shows each scholar's
classification route, Billing applicability, and payroll-list inclusion.

### Implementation and data flow

The lifecycle service normalizes School Catalog classification into a Billing
or Payroll route. Scholar Management resolves the current school from the
current-period requirement, applicant school, or submitted school name and
returns route, readiness, billing, and payroll-list state to the client.

Both mutation endpoints independently re-resolve and validate classification
and readiness on the server. Billing rejects Public scholars even if an
override is supplied. Payroll rejects Private scholars and creates a
`PAYROLL-*` batch with `generated` status and `listed` scholar records. Billing
continues to create `BILL-*` batches for Private scholars.

### Files and system areas changed

- `backend/services/lifecycleIntegrity.js`: canonical routing and classification-aware requirements.
- `backend/controllers/applicationController.js`: branch enforcement, Public payroll-list generation, and route serialization.
- `backend/middleware/activityAudit.js`: operational logging now describes payroll-list generation.
- `backend/tests/lifecycleIntegrity.test.js` and `backend/tests/activityLog.test.js`: routing, requirements, and log assertions.
- `frontend/src/BillingPayrollManagement.jsx`: classification queues and in-scope list-generation action.
- `frontend/src/ScholarsManagement.jsx`: route and processing status presentation.
- `docs/scope-boundary-audit.md`: affected legacy payment path marked as replaced.

### API, data, configuration, and deployment impact

`POST /api/billing/process` now accepts only Private scholars.
`POST /api/payroll/process` accepts only eligible Public scholars and generates
payroll-list records instead of changing payment state. No database schema,
migration, dependency, environment variable, or deployment topology changed.
Existing string status fields store `billed`, `generated`, and `listed`.

### Security, privacy, accessibility, and scope impact

Existing role checks remain in force, classification is server-validated, and
no new personal data is collected or exposed. Headings, action labels, status
text, and native controls remain keyboard-readable, and route meaning is not
communicated by color alone. The new Payroll action ends at official list
generation and performs no fund release, claiming, disbursement confirmation,
reconciliation, or monetary audit.

### Validation

All 74 backend tests passed. `applicationController.js` and
`lifecycleIntegrity.js` passed `node --check`. Frontend ESLint and the Vite
production build also passed.

### Limitations, rollback, and recommended next work

Historical records and legacy paid, claimed, released, reference, and amount
columns remain for compatibility. Other legacy payment routes, portal/report
copy, and unused mailer code remain documented in the scope-boundary audit;
they were not silently deleted. Rollback requires restoring controller and
client routing only because no schema changed, while records generated under
this rule should remain as operational history. Recommended next work is the
controlled cleanup of those remaining legacy surfaces and database-backed
integration tests using both Public and Private scholar fixtures.

### Production deployment outcome

The classification-routing change was pushed to `main` in commit `688c809` on
2026-09-02. Vercel reported that the production deployment completed
successfully. Render is configured with `autoDeployTrigger: commit`, and the
live `/api/health` endpoint returned `healthy` with `database: connected` after
the push. No migration was required. The user-provided untracked ERD files
were not staged, committed, or modified.

## 2026-08-30 — Payroll-List Scope Boundary Clarification

### TL;DR

- The PGCEAP system officially ends when CAO generates the payroll list of
  scholars.
- Fund release, payment confirmation, financial reconciliation, and auditing
  released money are outside scope.
- The new guidance timeline now ends at payroll-list inclusion.
- Older payment-oriented features remain temporarily and are inventoried for
  controlled removal.
- All 61 backend tests pass after the correction.

### 1. Clarified boundary

The approved PGCEAP workflow ends when CAO generates the official payroll
list of scholars. Payroll-list generation confirms which qualified and
compliant scholars are included in the administrative list for the academic
period.

The following activities occur outside the system boundary:

- Releasing or disbursing funds
- Recording that a scholar was paid
- Recording that money was claimed or received
- Generating or tracking payment references
- Reconciling released funds
- Auditing the release, receipt, or movement of money

System Activity Logs remain in scope because they record account access and
changes to scholarship records. They must not be described as audits of
released money.

### 2. Immediate system correction

The personalized guidance lifecycle introduced in the entry below originally
used “Allowance release” as its final stage. It now ends at “Payroll list.” A
payroll-claim/list entry completes the in-scope lifecycle regardless of any
legacy payment-status fields.

Guidance no longer tells scholars to wait for fund release or monitor payment
status. After payroll-list inclusion, it tells the scholar that the system's
recorded process is complete and directs post-list questions to CAO.

### 3. Existing legacy functionality

An audit found older payment-oriented functionality that predates this scope
clarification. It has not been silently deleted because removing routes,
stored fields, reports, and portal behavior requires a controlled migration
and regression pass. The affected surfaces are recorded in
[`scope-boundary-audit.md`](scope-boundary-audit.md).

Until that cleanup is implemented, the legacy payment functions must not be
treated as approved requirements or used as the basis for new features.

### 4. Technical impact

- Guidance terminal condition changed from a paid/released state to the
  existence of the scholar's payroll-list entry.
- The final timeline identifier changed from `allowance` to `payroll_list`.
- Paid, claimed, and released status values no longer affect guidance.
- The final completion timestamp uses payroll-list creation or batch
  preparation time when available.
- No database migration or stored-record mutation was required.
- Repository instructions and the README now explicitly preserve this scope
  boundary for future work.

### 5. Validation and next action

The guidance tests were updated to use a pending payroll entry as the terminal
condition and to reject payment/release language in the serialized guidance.
The next controlled cleanup should disable the out-of-scope payment mutation
routes and convert the existing Payroll workspace into payroll-list review and
export only.

---

## 2026-08-30 — Personalized Next-Action Assistant and Transparent Timeline

### TL;DR

- Applicants and scholars now receive record-specific next actions instead of
  generic workflow guidance.
- Both portals display the same five-stage, API-driven lifecycle timeline.
- Missing, rejected, pending, and physical requirements are clearly separated
  and prioritized.
- The feature does not make eligibility decisions or expose unreleased exam
  results.
- Verification passed: 61 backend tests, frontend lint, and production build.

### 1. Summary and objective

The Applicant and Scholar portals now provide guidance derived from the
authenticated user's actual scholarship record. The feature explains the
current lifecycle stage, identifies actions the user can take, distinguishes
those actions from stages controlled by CAO, and presents a common timeline
from application submission through payroll-list generation.

The objective is to reduce uncertainty, incomplete requirements, unnecessary
office inquiries, and missed workflow steps without allowing automation to
make scholarship decisions.

### 2. Previous behavior

The Applicant portal displayed generic text such as “What happens next?” and
used client-side conditions to show a limited examination message. It did not
present the complete scholarship journey or explain which exact step applied
to the authenticated applicant.

The Scholar portal calculated its progress and timeline separately in the
browser. It showed document counts and upload controls, but the explanation
of the most important next action was distributed across progress,
notification, announcement, and requirements panels.

Because guidance logic lived mainly in presentation code, the two portals
could describe similar lifecycle states differently.

### 3. New behavior

The backend now produces one explainable `guidance` object using existing
application, examination, scholar, requirement-review, physical-folder,
billing, and payroll records.

The guidance can report one of three top-level states:

| State | Meaning | Example |
|---|---|---|
| `action_required` | The authenticated user has a concrete task | Upload a missing requirement |
| `waiting` | CAO or a moderator owns the next step | Wait for an official examination result |
| `complete` | No action remains in the in-scope cycle | Payroll-list inclusion is recorded |

The interface now provides:

- A clear headline describing the current situation
- A short explanation of why that state applies
- Prioritized and individually identified next actions
- Direct links to relevant portal sections when an online action exists
- A five-stage application timeline
- Completed, current, and upcoming stage labels
- Recorded completion dates where the database provides reliable timestamps

### 4. Guidance decision matrix

| Recorded condition | Guidance state | User-facing result |
|---|---|---|
| Application exists; no examination result or active schedule | Waiting | Wait for CAO to publish the municipality schedule |
| Active schedule exists; examination not completed | Action required | Review the schedule and assigned venue |
| Examination recorded; scholar account not active | Waiting | Wait for the official scholarship decision |
| Active scholar has rejected documents | Action required | Replace returned documents; affected document names are listed |
| Active scholar has missing documents | Action required | Upload missing requirements; affected requirement names are listed |
| Physical folder is not recorded | Action required | Submit the white long folder directly to CAO |
| All user-controlled items are complete; documents await review | Waiting | Wait for moderator review |
| Requirements are complete; no payroll-list entry exists | Waiting | Wait for CAO to generate the payroll list |
| A payroll-list entry exists | Complete | Scholar is included in the generated payroll list |

When more than one requirement issue exists, rejected files are shown first,
then missing files, followed by the physical-folder action. This keeps the
most corrective work visible without hiding other outstanding tasks.

### 5. Lifecycle timeline

The shared timeline contains these stages:

1. Application submitted
2. Qualifying examination
3. Scholarship decision
4. Scholar requirements
5. Payroll list

Each stage is serialized as `completed`, `current`, or `upcoming`. The
timeline uses recorded timestamps only when the corresponding event has an
authoritative date. It does not invent expected completion dates or service
deadlines.

### 6. Implementation and data flow

The request flow is:

1. An Applicant or Scholar requests `GET /api/applications/me` with their
   authenticated session token.
2. Existing authorization middleware limits the endpoint to the Applicant and
   Scholar roles.
3. The controller retrieves the user's latest application and related active
   academic-period records.
4. `buildApplicantGuidance` receives those already-authorized records.
5. The pure guidance service normalizes review states and payroll-list
   inclusion and returns
   the summary, actions, and timeline.
6. The API includes the result as the `guidance` property alongside the
   existing response fields.
7. Both portals render the same API contract through the shared
   `PortalGuidance` component.

The service is deterministic and stateless. It performs no database writes,
does not call external AI services, and does not change workflow status.

### 7. API response contract

The authenticated application response now includes the following shape:

~~~json
{
  "guidance": {
    "state": "action_required",
    "headline": "Your requirements need attention",
    "description": "Complete the items below so your record can proceed to payroll-list preparation.",
    "actions": [
      {
        "id": "upload-missing-requirements",
        "type": "requirements",
        "title": "Upload 2 missing requirements",
        "description": "Photocopy of ID, Certificate of Grades",
        "priority": "high",
        "route": "requirements"
      }
    ],
    "timeline": [
      {
        "id": "application",
        "label": "Application submitted",
        "status": "completed",
        "detail": "Your application was received by the Scholarship Office.",
        "completedAt": "2026-08-20T08:00:00.000Z"
      }
    ]
  }
}
~~~

Routes in action objects are semantic identifiers rather than unrestricted
URLs. Each portal decides whether and where the identifier may navigate. For
example, the Scholar portal maps `requirements` to its authenticated
requirements section. The Applicant portal exposes an examination link only
for the online examination mode.

### 8. Files and components changed

| File | Change |
|---|---|
| `backend/services/applicantGuidance.js` | Added deterministic guidance and timeline rules |
| `backend/controllers/applicationController.js` | Added guidance to the authenticated application response |
| `backend/tests/applicantGuidance.test.js` | Added five policy and privacy-focused test scenarios |
| `frontend/src/components/PortalGuidance.jsx` | Added shared accessible rendering for actions and timeline stages |
| `frontend/src/styles/portal-guidance.css` | Added responsive state, action, and timeline presentation |
| `frontend/src/ApplicantDashboard.jsx` | Replaced generic guidance with record-derived guidance while retaining face-to-face schedule details |
| `frontend/src/ScholarDashboard.jsx` | Replaced browser-derived timeline presentation with the shared API-driven guidance panel |
| `change_log.txt` | Added the concise feature summary |

### 9. Database, configuration, and dependency impact

- Database migration: None
- Prisma schema change: None
- New environment variables: None
- New npm packages: None
- External service dependency: None
- Existing stored records modified: None

The feature reads existing data and therefore deploys without a migration or
backfill operation.

### 10. Security and privacy impact

The feature retains the existing authenticated endpoint and role checks. It
does not add a public endpoint or widen access to application records.

Important privacy and decision safeguards:

- Guidance is built only from the authenticated user's record.
- No document contents, storage URLs, password data, or staff-only audit data
  are included.
- An examination submission may be marked as recorded, but an unreleased pass
  or fail value is not exposed.
- Guidance never approves, rejects, scores, or changes an application.
- Route values are controlled semantic identifiers, not user-provided URLs.
- The feature performs no database mutations.

### 11. Accessibility and responsive behavior

The shared panel uses semantic headings, a labelled next-actions region, an
ordered lifecycle list, text labels in addition to color, and decorative icon
attributes that avoid duplicate screen-reader announcements.

On small screens, action links and stage labels move below their descriptions
instead of compressing or overflowing the panel. Completed, current, waiting,
and action-required states remain understandable without relying only on
color.

### 12. Validation performed

| Check | Result |
|---|---|
| Backend automated test suite | 61 passed, 0 failed |
| New guidance policy tests | 5 passed |
| Frontend ESLint | Passed with no reported errors |
| Vite production build | Passed; 487 modules transformed |
| Backend syntax checks | Passed |
| Git whitespace validation | Passed; line-ending notices only |

The added tests cover:

- Active examination scheduling
- Waiting for an official decision without leaking an unreleased result
- Combined missing, rejected, and physical requirement actions
- Pending moderator review with no unnecessary upload request
- Payroll-list inclusion as the terminal lifecycle state

### 13. Deployment and rollback

Deployment requires the normal backend and frontend release only. The backend
should be deployed before or together with the frontend so the new
`guidance` response is available when the shared panel loads.

The frontend safely renders no guidance panel if the property is temporarily
absent, which supports a rolling deployment. Rolling back consists of
reverting the service, controller integration, shared component, portal
integration, and related tests. No database rollback is necessary.

### 14. Known limitations

- Expected processing times are not shown because the system does not yet
  store SLA rules for each lifecycle stage.
- The guidance is rule-based and currently supports English only.
- Face-to-face examination attendance confirmation remains part of the
  existing examination workflow.
- Appeals and correction requests do not yet have a dedicated applicant
  submission workflow.
- Guidance refresh follows the existing portal request and polling behavior;
  it is not delivered through real-time push updates.

### 15. Recommended next development work

The next Phase 1 slice should implement offline application drafts and upload
recovery. After that, accessibility verification and administrator MFA should
be prioritized. Those foundations should precede predictive or AI-assisted
decision features.

---

## 2026-08-30 — Versioned Explainable Eligibility Recommendation Engine

### TL;DR

- Authorized staff now receive a transparent, deterministic eligibility
  recommendation with a four-factor 100-point scorecard and policy version.
- The engine never accepts or rejects an applicant; staff retain the final
  decision, and a written reason is required when overriding its advice.
- Acceptance stores an immutable decision snapshot, minimized rule inputs,
  reviewer identity, decision time, and operational Activity Log event.
- Accepted applicants and scholars can see a plain-language explanation only
  after the official decision is recorded.
- Verification passed: 67 backend tests, Prisma client generation, backend
  syntax checks, frontend lint, production build, and Git whitespace checks.

### 1. Objective and reason

The previous scholarship decision workflow treated a passing examination as
the only automated acceptance prerequisite. Staff could view the score and
manually accept an applicant, but the interface did not explain how other
submitted information related to the decision, identify the rule version in
use, or preserve the exact recommendation reviewed at decision time.

This change introduces an explainable decision-support layer. Its purpose is
to make staff review more consistent and transparent without transferring
decision authority to software. It also gives an accepted applicant a concise
explanation of the factors used after CAO records the official outcome.

### 2. Previous and new behavior

Previously:

- Results Management showed the examination score, passing score, result,
  remarks, schedule, and an Accept as Scholar action.
- Acceptance required a passing result but stored no eligibility-policy
  version, factor breakdown, input snapshot, or reviewer explanation.
- Applicants were told to wait for an official result but never received an
  assessment explanation from the system.
- A historical passing result could satisfy acceptance even if a newer result
  was not passing.

Now:

- Each result record receives a live recommendation calculated from the latest
  submitted application and latest examination result.
- Staff see the overall score, recommendation, summary, factor-by-factor
  points and explanations, policy version, generation time, and an explicit
  human-authority notice.
- The final acceptance operation recalculates the recommendation server-side
  and stores that exact version as an immutable assessment snapshot.
- If the recommendation is `REVIEW_REQUIRED` or
  `DOES_NOT_MEET_CRITERIA`, the staff interface and API require a written
  decision reason before allowing acceptance.
- Acceptance checks the latest examination result instead of any historical
  passing result.
- After acceptance, the Applicant or Scholar portal receives a safe version
  of the stored assessment and explains that software supported, but did not
  make, the decision.

### 3. Initial policy version

Policy `PGCEAP-2026.1` uses a deterministic 100-point model:

| Factor | Maximum | Input | Explanation |
|---|---:|---|---|
| Financial need | 35 | Submitted annual family-income band | Lower configured income bands receive more need points |
| Academic standing | 25 | Submitted GWA | Supports percentage and 1.00–5.00 college formats |
| Qualifying examination | 30 | Latest verified score and pass value | Score is normalized against the current 20-point exam maximum; passing is required |
| Priority qualifications | 10 | Declared configured qualifications | Two points per declared qualification, capped at ten |

The recommendation threshold is 60 points. A complete record must reach the
threshold and have a passing latest examination result to receive
`MEETS_CONFIGURED_CRITERIA`. Missing or unrecognized required inputs produce
`REVIEW_REQUIRED`. A failed examination or complete score below the threshold
produces `DOES_NOT_MEET_CRITERIA`.

These outputs remain advice. They do not update application status, create a
scholar account, or bypass an authorized staff decision on their own.

### 4. Affected roles and workflows

| Role | Change |
|---|---|
| Super Administrator | Can review the scorecard and record the final acceptance decision |
| Billing/Payroll Administrator | Retains existing acceptance access and receives the same decision safeguards |
| Applicant | Does not see a provisional recommendation while the decision is pending; sees the explanation only after acceptance if still using the Applicant portal |
| Scholar | Sees the stored official-decision explanation in the Scholar portal |
| Moderator | No workflow change |

The operational sequence is now:

1. Applicant submits financial, academic, and priority information.
2. The latest verified examination result becomes available.
3. Results Management requests applicant records.
4. The backend calculates a current advisory recommendation.
5. Authorized staff review the factor explanations.
6. Staff record acceptance; an override reason is mandatory when applicable.
7. The backend recalculates and atomically stores the decision snapshot,
   scholar account, and current-period scholar-requirement record.
8. The accepted user can view the safe explanation in the portal.

### 5. Implementation and data flow

`evaluateEligibility` is a pure service with no database or external network
dependency. It normalizes configured income and GWA values, calculates each
factor, determines missing inputs, applies the examination hard condition and
score threshold, and returns a structured recommendation.

`GET /api/applicants/management` loads applications and examination results in
bulk. The controller indexes the newest record per applicant and adds an
`eligibilityRecommendation` object to each management row. No assessment is
persisted merely because a staff member views the directory.

`POST /api/scholars/:applicantId/accept` performs the authoritative
server-side calculation again. Within the existing database transaction it:

- creates or activates the scholar account;
- creates an `eligibility_assessments` snapshot;
- records the minimal rule inputs used by that policy version;
- stores reviewer ID, decision, optional or required reason, and timestamp;
- creates or refreshes the current academic-period scholar requirements.

The successful mutation is also written to Activity Logs. A recommendation
override receives the distinct
`ELIGIBILITY_RECOMMENDATION_OVERRIDDEN` activity action. The detailed override
reason remains in the assessment record rather than being copied into the
general activity description.

`GET /api/applications/me` returns `eligibilityAssessment` only when the
requesting user already has an active scholar account. The portal contract
does not expose provisional recommendations to applicants awaiting a final
decision.

### 6. Database impact

Migration `20260830000000_add_explainable_eligibility` adds the
`eligibility_assessments` table with:

- applicant, application, result, and academic-period identifiers;
- policy version and display name;
- recommendation, total, maximum, threshold, and summary;
- JSON scorecard and minimized JSON input snapshot;
- generation timestamp;
- reviewer, final decision, decision reason, and review timestamp;
- lookup indexes and referential constraints.

The migration is additive. It does not rewrite existing applications, results,
scholar accounts, requirements, or payroll-list records. Existing scholars do
not receive a fabricated historical assessment; their explanation remains
absent unless a later authorized process records one.

### 7. API and user-interface impact

The management response adds:

~~~json
{
  "eligibilityRecommendation": {
    "policyVersion": "PGCEAP-2026.1",
    "recommendation": "MEETS_CONFIGURED_CRITERIA",
    "totalScore": 88,
    "maxScore": 100,
    "threshold": 60,
    "requiresHumanDecision": true,
    "requiresOverrideReason": false,
    "factors": []
  }
}
~~~

The acceptance endpoint now accepts an optional `reviewReason`. It returns
`ELIGIBILITY_OVERRIDE_REASON_REQUIRED` with the recalculated recommendation
when a reason is required but missing. The staff drawer disables the final
button in that condition and provides a bounded 2,000-character reason field.

Results Management gained a responsive recommendation card and factor list.
Applicant and Scholar portals share `EligibilityAssessmentCard`, ensuring the
same safe explanation appears regardless of which authenticated portal is
active after the role transition.

### 8. Security and privacy impact

- Existing authentication and role checks remain in force.
- The acceptance mutation now uses a dedicated per-staff scholarship-decision
  rate limiter.
- The browser-provided scorecard is never trusted; acceptance recalculates the
  recommendation from database records.
- The persisted input snapshot contains only the fields used by the rules:
  application/result IDs, income band, GWA, exam score/pass values, and the
  keys of declared priority qualifications.
- Names, email addresses, contact information, home addresses, guardian names,
  documents, and credentials are excluded from the decision snapshot.
- Provisional recommendations remain staff-only.
- The applicant-facing response is released only after an active scholar
  account establishes that the official acceptance was recorded.
- Activity Logs describe the operation and policy version without duplicating
  the potentially sensitive written decision reason.

### 9. Accessibility impact

Both recommendation cards use semantic headings, text labels, factor names,
numeric values, and explanatory sentences. Status meaning does not depend on
color alone. The applicant-facing card reflows its score and factors for small
screens, and the staff decision reason has a visible label and native textarea
semantics.

### 10. Configuration and dependency impact

- New environment variables: None
- New npm dependencies: None
- External AI or scoring service: None
- Runtime network dependency: None
- Policy storage: Versioned source configuration in
  `backend/services/eligibilityRecommendation.js`

The feature is intentionally deterministic and is not machine learning. A
future policy change must use a new policy version so existing stored
assessments keep their original meaning.

### 11. Files and system areas changed

| Area | Change |
|---|---|
| `backend/services/eligibilityRecommendation.js` | Added policy, scoring, recommendations, minimized snapshots, and assessment serialization |
| `backend/controllers/applicationController.js` | Added bulk recommendation calculation, applicant-safe assessment response, latest-result acceptance validation, snapshot storage, and override audit metadata |
| `backend/routes/applicationRoutes.js` | Applied dedicated decision rate limiting to acceptance |
| `backend/middleware/rateLimits.js` | Added the per-staff scholarship-decision limiter |
| `backend/scripts/audit-schema.js` | Added assessment relationship checks to the schema audit |
| `backend/prisma/schema.application.prisma` | Added the runtime assessment model |
| `backend/prisma/schema.prisma` | Mirrored the assessment model in the canonical schema |
| `backend/prisma/migrations/20260830000000_add_explainable_eligibility/migration.sql` | Added the production database structure |
| `backend/tests/eligibilityRecommendation.test.js` | Added five deterministic scoring, blocker, missing-input, and privacy tests |
| `frontend/src/ResultsManagement.jsx` | Added staff recommendation display and human decision-reason workflow |
| `frontend/src/components/EligibilityAssessmentCard.jsx` | Added shared official-decision explanation |
| `frontend/src/ApplicantDashboard.jsx` | Loaded and displayed released assessment explanations |
| `frontend/src/ScholarDashboard.jsx` | Displayed the stored assessment in the scholar workflow |
| `frontend/src/styles/admin.css` | Styled staff scorecard and decision controls |
| `frontend/src/styles/eligibility-assessment.css` | Styled the shared responsive portal explanation |

### 12. Scope impact

The feature operates only at the scholarship-decision stage. It does not
release funds, mark money as paid or claimed, reconcile transactions, or audit
money. Downstream workflow remains requirements completion followed by CAO
payroll-list generation, which is the final system stage.

The Activity Log entry is an operational record of system access and a staff
decision. It is not a monetary audit.

### 13. Validation performed

| Check | Result |
|---|---|
| Eligibility recommendation tests | 5 passed |
| Full backend automated suite | 67 passed, 0 failed |
| Prisma client generation | Passed |
| Backend controller and service syntax | Passed |
| Frontend ESLint | Passed with no reported errors |
| Vite production build | Passed; 490 modules transformed |
| Git whitespace validation | Passed; line-ending notices only |

The automated policy tests verify configured income bands, percentage and
college GWA formats, a complete passing recommendation, a failed-exam blocker,
missing-input review routing, deterministic generation time, human-decision
flags, and exclusion of names and email addresses from the snapshot.
The rate-limit suite also verifies that scholarship-decision limits are
isolated per authenticated staff account.

### 14. Known limitations and policy governance

- Policy weights and the 60-point threshold are source-configured in this
  first version; there is no administrator policy editor.
- CAO should formally approve every policy version before it is used for real
  scholarship decisions. Changing policy values requires a new version and a
  normal backend release.
- The form currently infers GWA format from its numeric range; an explicit
  grading-scale field would remove ambiguity for values from 1.00 to 5.00.
- Declared priority qualifications are not yet independently document-verified
  by this feature. Staff must treat them as submitted information.
- The system records acceptance but does not yet provide a dedicated rejection
  or applicant appeal workflow.
- Existing scholars are intentionally not backfilled with reconstructed
  assessments because doing so would imply a historical review that did not
  occur.

### 15. Rollback considerations

The frontend and controller integration can be reverted without altering
existing application, result, scholar, requirement, or payroll-list records.
Assessment rows created after deployment should normally be retained as
operational decision records even if the feature is later disabled. Dropping
the table would permanently remove those explanations and reviewer reasons
and therefore requires a separate, explicitly approved data-retention action.

For a rolling release, deploy the backend migration and API before the new
frontend. Older frontends ignore the added response property. The new
frontend also tolerates an absent applicant assessment card, but the staff
management response must provide recommendations for the full review UI.

### 16. Recommended next work

1. Obtain formal CAO approval for policy `PGCEAP-2026.1`, including weights,
   threshold, exam maximum, income bands, and priority treatment.
2. Add an explicit grading-scale choice to application data and validation.
3. Add a controlled, version-creating policy administration interface with
   effective dates and dual authorization.
4. Add a dedicated official rejection and applicant correction/appeal flow
   without extending the system beyond payroll-list generation.
5. Add end-to-end database tests for atomic assessment and scholar creation.

### 17. Production deployment outcome

The feature was deployed for real-time testing from Git commit `f579800` on
2026-08-30.

| Service | Outcome |
|---|---|
| Vercel frontend | Production deployment completed successfully at 15:22:59 UTC |
| Render backend | Production deployment completed successfully at 15:23:42 UTC |
| Database migration | Render's successful build completed the configured Prisma migration step for the additive assessment table |
| Live API health | Healthy; database connection confirmed |
| Deployed frontend inspection | Production administrator bundle contains the new Eligibility Recommendation interface |

Production URLs:

- Frontend: `https://cao-scholar-monitoring-system.vercel.app/`
- API health: `https://cao-scholar-monitoring-api.onrender.com/api/health`

This deployment makes the feature available for controlled real-time testing.
Policy `PGCEAP-2026.1` remains advisory and must receive formal CAO approval
before it is relied upon for actual scholarship decisions.

---

## 2026-08-30 — Verified Priority Eligibility and Examination Bypass

### TL;DR

- Selecting a priority checkbox no longer acts only as a score input: the
  applicant must upload proof for one selected criterion.
- A Moderator or Super Administrator reviews the proof in the existing secure
  Document Reviews workspace.
- Individual approval automatically creates the scholar account and bypasses
  the qualifying examination; self-declaration and bulk approval cannot do so.
- The system rechecks the one-scholar-per-family rule and blocks inactive
  scholar-record conflicts before automatic acceptance.
- No payment, release, reconciliation, or monetary-audit behavior was added.

### Objective and decision rule

The requested policy is that an applicant who qualifies under at least one of
the seven priority criteria may bypass the qualifying examination and become
a scholar, but only after providing evidence. The implementation separates
the applicant's claim from CAO's verification:

~~~text
One or more criteria selected
  -> criterion-specific proof uploaded
  -> authorized individual review
  -> family and account conflict checks
  -> proof approved
  -> scholar automatically created; examination bypassed
~~~

The supported criteria are highest honors, academic-contest champion, ALS
passer, PWD, child of a PWD, solo parent, and indigenous-group membership.

### Previous and new behavior

Previously, the seven checkboxes contributed up to ten points to policy
`PGCEAP-2026.1`. They did not require evidence and could not independently
create a scholar account. Every manual acceptance still required a passing
latest examination result.

Now, selecting any criterion makes a supporting upload mandatory before the
application can be submitted. The applicant chooses which selected criterion
the proof supports and uploads one PDF, JPG, or PNG file smaller than 6 MB.
The backend independently verifies the declared criterion, file type, decoded
size, and proof key before storing it.

The pending proof appears in Document Reviews even though the person is not
yet a scholar. The review interface explicitly warns that approval causes
automatic acceptance and an examination bypass. Rejection records correction
notes but does not create a scholar.

### Roles and workflow impact

| Role | Impact |
|---|---|
| Applicant | Selects a criterion and supplies criterion-specific evidence during application |
| Moderator | Can securely preview and approve or reject the evidence; approval triggers the configured automatic outcome |
| Super Administrator | Has the same review authority and can investigate blocked account conflicts |
| Billing/Payroll Administrator | No new proof-review permission |
| Scholar | Receives the existing approval email, scholar ID, requirements workflow, and a portal explanation of the verified bypass |

### Automatic-acceptance safeguards

- A checkbox without a proof is rejected at submission.
- A proof key must correspond to a criterion declared `Yes`.
- Only authenticated Moderator and Super Administrator review routes can open
  or decide the private proof.
- The normal review validator requires an explicit approved/rejected decision;
  rejected files require a reason.
- Priority proofs are excluded from Approve All Pending, ensuring the
  acceptance consequence always uses an individual confirmation dialog.
- The system rechecks active scholars' parent identities before approval and
  blocks another scholar from the same family.
- An existing inactive scholar record blocks automatic processing and requires
  Super Administrator review instead of overwriting historical data.
- Database uniqueness protects against duplicate scholar accounts.
- Approval updates the proof, application status, scholar account, scholar
  requirements, and eligibility assessment in one transaction.
- A dedicated `PRIORITY_PROOF_APPROVED_AUTO_ACCEPTED` Activity Log event
  records the operational action without exposing the proof itself.

### Data flow and storage

The browser sends the selected proof as a base64 data URL inside the existing
bounded application request. The backend decodes and validates it. Production
stores the file in the configured private Vercel Blob store under an
eligibility-proof namespace; only metadata and a private reference are stored
in `application_submissions.initial_docs`. Local development retains the
existing database fallback.

The proof uses a criterion-specific requirement key such as `priority_pwd`.
Document review serialization exposes safe metadata but not private Blob URLs
or encoded file content. The existing authenticated streaming endpoint reads
the proof for authorized reviewers with private, no-store response headers.

On approval, the existing `eligibility_assessments` table receives policy
`PGCEAP-PRIORITY-2026.1`, recommendation
`VERIFIED_PRIORITY_BYPASS`, the verified criterion, reviewer, review time,
and a minimized input snapshot. No identity document content is copied into
the assessment.

### API and database impact

- `POST /api/applications` now accepts
  `initialDocs.priorityProof` when a priority criterion is selected and
  requires it for those applications.
- `GET /api/document-reviews` now includes pending priority proofs from
  applicants as well as normal requirements from active scholars.
- Existing file-stream and individual-decision endpoints support the new
  criterion-specific proof definitions.
- The approval response clearly reports automatic acceptance and examination
  bypass.
- No new database table or migration is required; the feature uses existing
  JSON document metadata, scholar, requirement, assessment, and Activity Log
  structures.
- No new environment variables or npm dependencies were added.

### User-interface and accessibility impact

The application form reveals a Supporting Proof panel only when one or more
criteria are selected. It contains a labelled criterion selector, native file
input, format/size guidance, chosen filename, and inline validation. The panel
stacks on small screens.

Document Reviews now refers to applicants and scholars, identifies priority
proofs in its filters, and changes the reviewer checklist and confirmation
copy when approval will cause automatic acceptance. The warning is textual
and does not depend on color.

The scholar timeline marks the examination stage completed with a clear
explanation that CAO verified a priority proof. The official-decision card
labels the result as Verified priority eligibility.

### Security, privacy, and scope impact

Proof files use the existing private-document token and are never public.
File format, decoded size, declared criterion, authenticated role, family
conflicts, and account conflicts are checked server-side. Client claims do not
control the outcome.

The feature changes only eligibility verification, scholar creation, and the
transition into requirements. The in-scope process still ends at generation
of the official payroll list. No fund release, paid/claimed status,
reconciliation, or monetary auditing was introduced.

### Files and system areas changed

| Area | Change |
|---|---|
| `backend/services/priorityEligibility.js` | Added canonical criterion/proof mappings and declaration checks |
| `backend/services/documentReview.js` | Added priority proof definitions, safe queue metadata, and bulk-approval exclusion |
| `backend/controllers/applicationController.js` | Validates and privately stores proof during application submission |
| `backend/controllers/documentReviewController.js` | Loads applicant proofs, permits protected preview, rechecks conflicts, and performs transactional auto-acceptance |
| `backend/services/applicantGuidance.js` | Explains a verified examination bypass in the portal timeline |
| `backend/tests/priorityEligibility.test.js` | Covers mappings and declaration matching |
| `backend/tests/documentReview.test.js` | Covers individual-only priority review metadata |
| `backend/tests/applicantGuidance.test.js` | Covers the completed bypass timeline |
| `frontend/src/components/ApplicationForm.jsx` | Added conditional proof selection, validation, and upload payload |
| `frontend/src/DocumentReviewManagement.jsx` | Added applicant-proof review language and automatic-consequence warning |
| `frontend/src/components/EligibilityAssessmentCard.jsx` | Added the verified-priority outcome label |
| `frontend/src/styles/application.css` | Added responsive proof-upload presentation |

### Validation and limitations

Automated validation covers all seven mapping keys, declaration/proof
matching, exclusion from bulk approval, safe review serialization, and the
examination-bypass timeline. The full backend suite, frontend lint, frontend
production build, backend syntax, and Git whitespace checks must pass before
deployment.

Known limitations:

- The first release accepts one proof for one selected criterion. Additional
  selected criteria do not require separate uploads because one verified
  criterion is sufficient under the requested rule.
- Rejected-proof replacement is not yet available as a self-service portal
  upload; CAO must direct the applicant through its correction procedure.
- Authenticity remains a human review responsibility; the system validates
  file structure and workflow, not the issuing authority's registry.
- The policy applies prospectively and does not automatically reprocess older
  applications that have no stored priority proof.

### Rollback and recommended next work

Rollback can disable the priority proof definitions and automatic branch
without a database rollback. Existing proof metadata and assessment records
should be retained as operational history. Removing private proof files is a
separate data-retention action and must not occur implicitly.

Recommended next work is a secure applicant replacement-upload path for
rejected priority proofs, followed by configurable accepted-document examples
for each criterion and formal CAO approval of policy
`PGCEAP-PRIORITY-2026.1`.

### Production deployment outcome

The verified priority pathway was deployed for controlled real-time testing
from commit `b1403ba` on 2026-08-31.

| Service | Result |
|---|---|
| Vercel frontend | Production deployment completed successfully |
| Render backend | Production deployment completed successfully |
| Database | Render's Prisma deployment step completed the existing additive migration set |
| Live API | `/api/health` returned `healthy` with `database: connected` |
| Workspace hygiene | The user-provided untracked ERD files were not staged or changed |

The live testing entry points remain:

- Frontend: `https://cao-scholar-monitoring-system.vercel.app/`
- API health: `https://cao-scholar-monitoring-api.onrender.com/api/health`

The deployment exposes the proof upload, protected review queue, automatic
acceptance, and examination-bypass workflow. Policy
`PGCEAP-PRIORITY-2026.1` remains subject to formal CAO approval before it is
used for actual scholarship decisions.

## 2026-08-31 — Consolidated System Features and Improvements Reference

### TL;DR

- Added a standalone Markdown reference covering the system's core features, innovations, and improvements.
- Documented role coverage, workflow boundaries, verification status, and known policy limitations.
- No application behavior, database structure, configuration, or deployment behavior changed.

### Objective and outcome

The objective was to provide one concise but comprehensive reference for project
stakeholders, developers, testers, and reviewers. The new
`docs/system-features-innovations.md` consolidates capabilities previously
described across feature and deployment entries.

### Impact and validation

This is a documentation-only change. There is no API, database, configuration,
security, privacy, accessibility, or deployment impact. The document was checked
for the approved payroll-list endpoint and explicitly excludes fund release,
payment claiming, disbursement confirmation, reconciliation, and monetary
auditing. Existing ERD files were not modified.

### Files changed

- `docs/system-features-innovations.md` — new consolidated feature reference.
- `change_log.txt` — concise dated summary.
- `docs/development-change-log.md` — this detailed entry.
