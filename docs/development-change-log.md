# Comprehensive Development Change Log

This document is the detailed engineering record for material PGCEAP system
changes. The root `change_log.txt` remains the concise chronological summary.
Entries here explain what changed, why it changed, how it affects the system,
and how the result was verified.

## 2026-09-11 - Rust-Free Prisma Client for Hostinger Backend Compatibility

### TL;DR

- Replaced the application client's native Prisma Rust query engine with Prisma's GA Rust-free client and PostgreSQL driver adapter.
- Addresses the repeatable `PANIC: timer has gone away` failure and restart loop observed on Hostinger's process-limited Node.js runtime.
- No schema migration or application-data change is included; Render remains the production rollback backend until Hostinger validation passes.
- Prisma generation, a real local PostgreSQL query, dependency audit, syntax checks, and all 82 backend tests pass before deployment.

### Objective and reason

The Hostinger backend started successfully but every database query crashed the
Prisma 5.22 native library engine with `PANIC: timer has gone away`. This drove
the application into repeated termination and restart cycles while the hosting
account remained near its 120-process limit. The existing Render deployment and
the same Prisma PostgreSQL database remained healthy, isolating the failure to
the native query engine inside Hostinger's shared runtime.

### Previous and new behavior

The application database client previously used Prisma 5's default embedded
Rust library engine. It now uses Prisma 6.19.3 with `engineType = "client"` and
`@prisma/adapter-pg`, so queries use Prisma's TypeScript/WASM query compiler and
the JavaScript PostgreSQL driver rather than loading the failing native library.
Controller and service calls continue using the same generated Prisma API.

### Affected users, implementation, and system areas

Once the staged backend is promoted, applicants, scholars, and staff should be
able to use the Hostinger API without native-engine crashes. Prisma client
creation in the runtime configuration, production migration precheck, and the
application-database copy utility now supply a PostgreSQL adapter. Dependencies
and the application Prisma generator were updated together and pinned to the
validated Prisma 6.19.3 release. A backend-local `npm run build` alias generates
that client without reinstalling dependencies, accommodating Hostinger's cached
build-command selector while avoiding the former nested root installation.

### Impact assessment

- **API/user experience:** no endpoint contract or intended workflow change; backend availability on Hostinger is the affected outcome.
- **Database/data:** no schema migration, seed, record update, or database-provider change.
- **Configuration:** existing `DATABASE_URL`, `DIRECT_URL`, `DATABASE_TARGET`, and deployment variables retain their meanings; no new secret is required.
- **Dependencies:** adds `@prisma/adapter-pg`, upgrades the Prisma CLI and client to 6.19.3, and pins a patched `deepmerge-ts` transitive version.
- **Security/privacy:** npm audit reports zero vulnerabilities; credentials remain server-side and no logging of connection strings was added.
- **Accessibility:** no impact.
- **Deployment:** requires one backend-only Hostinger rebuild so the Rust-free generated client is produced; frontend auto-deployment must remain disconnected during the controlled rollout.
- **Product scope:** no scholarship, Billing, payroll-list, payment, or auditing workflow change.

### Validation, limitations, rollback, and next work

Validation includes successful Prisma 6.19.3 client generation, JavaScript
syntax checks, a real `SELECT 1` through the Rust-free client against the local
PostgreSQL target, a zero-vulnerability npm audit, and all 82 backend tests.
Hostinger runtime compatibility cannot be proven locally and must be confirmed
with the deployed `/api/health` endpoint while monitoring process usage. Render
remains the rollback service. If Hostinger validation fails, restore the prior
Prisma lockfile and runtime configuration or continue using Render; do not
change or migrate production data as part of rollback.

## 2026-09-10 - Hostinger Frontend Build Dependency Security Refresh

### TL;DR

- Cleared the high-severity Browserslist and moderate-severity baseline-browser-mapping advisories reported by the Hostinger frontend build.
- Updated only the frontend lockfile to compatible patched dependency versions.
- No interface, application workflow, API, database, environment variable, or user data changed.
- The frontend security audit reports zero vulnerabilities; lint and production build validation are required before deployment.

### Objective and reason

The Hostinger frontend build completed successfully but reported two dependency
advisories. The affected packages are build-tool dependencies rather than
application runtime features, but known advisories must still be removed from
the reproducible installation before the Hostinger deployment is promoted.

### Previous and new behavior

The frontend lockfile previously resolved Browserslist 4.28.4 and
baseline-browser-mapping 2.10.38. It now resolves patched versions 4.28.9 and
2.11.21 respectively, together with compatible current browser-data helper
packages. Application behavior and generated routes remain unchanged.

### Affected users, implementation, and system areas

Deployment operators receive a clean dependency audit during subsequent
frontend builds. Applicants, scholars, and staff receive no visible or workflow
change. The update is confined to `frontend/package-lock.json`; source code and
declared dependency ranges were not changed.

### Impact assessment

- **API/database/configuration:** no impact.
- **Dependencies:** compatible lockfile refresh for frontend build tooling and browser compatibility data.
- **Security:** removes the reported denial-of-service and unbounded-memory/prototype-write advisory ranges from the installed tree.
- **Privacy/accessibility:** no impact.
- **Deployment:** Hostinger and Vercel will install the corrected versions on their next Git deployment.
- **Product scope:** no scholarship, Billing, payroll-list, or monetary-process change.

### Validation, limitations, rollback, and next work

Validation covers `npm audit`, frontend lint, the production Vite build, and Git
whitespace checks. Rollback can restore the prior lockfile but would reintroduce
the known advisory versions and is not recommended. Following deployment, the
Hostinger frontend still requires login, direct-route, authorization, and core
workflow smoke tests against the Hostinger backend before Render is retired.

## 2026-09-10 - Hostinger Build Dependency Security Refresh

### TL;DR

- Cleared the high-severity Nodemailer and moderate-severity qs advisories reported by Hostinger's backend build.
- Updated only resolved lockfile versions within the project's existing dependency ranges.
- No application workflow, API, database, environment variable, or user data changed.
- Backend tests, build preparation, npm audit, and Git checks validate the update before staging promotion.

### Objective and reason

The first Hostinger backend build completed successfully but npm reported two
production dependency advisories. Known production advisories must be resolved
before the Hostinger backend is considered a candidate to replace Render.

### Previous and new behavior

The lockfile previously resolved Nodemailer 9.1.0 and qs 6.15.3, both covered by
published advisories. It now resolves Nodemailer 9.1.1 and qs 6.16.0. Existing
`package.json` ranges already permit these compatible versions, so no declared
dependency or runtime architecture changed.

### Affected users, implementation, and system areas

Deployment operators receive a clean production dependency audit during the
next Hostinger build. Staff, applicants, and scholars receive no visible or
workflow change. `npm audit fix` updated `backend/package-lock.json` only; the
mailer and Express request parser continue to use their existing application
interfaces.

### Impact assessment

- **API/database/configuration:** no impact.
- **Dependencies:** lockfile-only compatible updates to Nodemailer and qs.
- **Security:** removes the reported mail-address parsing/access-control and
  query-string parsing advisories from the installed production dependency tree.
- **Privacy/accessibility:** no impact.
- **Deployment:** the Hostinger and Render builds will install the corrected
  versions on their next Git deployment.
- **Product scope:** no scholarship, Billing, payroll-list, or monetary process
  change.

### Validation, limitations, rollback, and next work

Validation includes `npm audit`, all backend tests, the Hostinger backend build
command, and Git whitespace checks. Rollback can restore the previous lockfile,
but doing so would reintroduce known advisories and is not recommended. The
Hostinger backend still requires runtime health, database, authentication,
document, mail, and workflow testing before frontend cutover; Render remains the
production rollback service.

## 2026-09-10 - Hostinger Monorepo Web-App Build Entry Points

### TL;DR

- Added a root `npm run build` command that Hostinger can detect from the monorepo.
- The command installs frontend dependencies using the existing lockfile and builds only the Vite frontend.
- Added an Apache/LiteSpeed SPA fallback so direct links such as `/login` and `/dashboard` load the React application.
- Added a separate `npm run build:backend` command that installs backend dependencies and generates the application Prisma client without modifying production data.
- Existing Vercel, Render, Prisma Postgres, and Vercel Blob services remain unchanged.
- No application behavior, production data, permissions, or workflow changed.

### Objective and reason

Hostinger's Git deployment interface continued reading scripts from the
repository-root `package.json` even after the `frontend` root directory was
selected. Because the root package exposed only development commands, the UI
offered `npm run dev` choices and no production build. Development servers must
not be used to publish the static frontend. The same root-level detection
requires an explicit backend preparation command for a separate Express app.

### Previous and new behavior

Previously, production frontend builds could be run only from the `frontend`
package. The repository root now exposes `npm run build`, which performs a
frontend dependency installation using the existing lockfile and build-time
development tools, then invokes the existing Vite production build. Its output remains
`frontend/dist`. A public `.htaccess` file is copied into that output and sends
non-file, non-directory requests to `index.html`, matching the existing Vercel
single-page application rewrite. The new backend command installs the backend
package and generates its Prisma client; it intentionally does not seed data or
run production migrations during the first staging deployment.

### Affected users, workflow, and implementation

This affects deployment operators configuring the optional Hostinger frontend
staging deployment. Staff, applicants, and scholars receive no functional
change. Hostinger can select the root production command instead of a Vite
development server. The temporary Hostinger site will continue calling the
existing Render API through the public `VITE_API_BASE` build variable.

### Files and system areas changed

- `package.json`: adds the root production build entry point.
- `package.json`: also adds the separate Hostinger backend preparation command.
- `frontend/public/.htaccess`: provides Hostinger Apache/LiteSpeed fallback
  routing for React Router URLs.
- `change_log.txt` and `docs/development-change-log.md`: document the deployment
  compatibility change and its boundaries.

### Impact assessment

- **API/database:** no endpoint, payload, schema, migration, or data impact.
- **Configuration/dependencies:** no package was added or upgraded; the command
  uses the committed frontend manifest, lockfile, and existing scripts.
- **Security/privacy:** no secret is added. Backend environment files and
  credentials remain excluded from the frontend build.
- **Accessibility:** no interface impact.
- **Deployment:** enables separate static-frontend and Express-backend Hostinger
  staging builds. The existing Vercel frontend and Render backend remain the
  production rollback path until authenticated staging validation passes.
- **Product scope:** no scholarship, Billing, or payroll-list workflow changes.

### Validation, limitations, rollback, and next work

Validation runs both root commands, confirms `.htaccess` is present in the
build output, checks representative direct routes after Hostinger redeploys,
runs frontend lint, and performs Git whitespace checks.
The Hostinger deployment must use repository root `./`, build command
`npm run build`, and output directory `frontend/dist`. This does not solve the
Render Free cold start until the Hostinger backend is validated and selected by
the frontend. The backend staging app must use repository root `./`, build
command `npm run build:backend`, and entry file `backend/server.js`. Rollback
consists of removing the root scripts; no data restoration is required. Next
work is to deploy the temporary backend with production-like secrets, verify it
against Prisma Postgres and Blob storage, then switch only the temporary
Hostinger frontend for authenticated end-to-end testing.

## 2026-09-09 - Billing Queue Amount Clarity and Private Fixture Value

### TL;DR

- Billing and Payroll queues now show the assigned amount for every queued scholar.
- The aggregate labels are now `Total billing amount` and `Total list amount`, making clear that they are sums rather than a separate charge.
- Each unprocessed private-school dummy fixture is set to PHP 5,000 for the requested test scenario.
- Processed fixture totals and all non-fixture scholar records remain unchanged.

### Objective and reason

The previous `Billable amount` footer did not explain which scholar amounts
formed the total. Staff needed a transparent queue that could be checked before
processing, and the private-school workflow fixtures needed a consistent PHP
5,000 test value.

### Previous and new behavior

Previously, the processing queue showed only control number, name, school year,
and semester, followed by one aggregate value. Staff could not verify the
individual amounts without leaving the queue. The queue now includes a labelled
Amount column for every scholar and uses explicit total labels in its footer.
The two unprocessed private fixtures now contribute PHP 5,000 each, so queuing
both produces a PHP 10,000 Billing total.

### Affected users, workflow, and implementation

Billing staff can compare each queued scholar's amount with the aggregate before
selecting Process Billing. Payroll staff receive the same visibility before
generating the official payroll list. The frontend formats the existing
period-specific `claimAmount` value; it does not calculate or invent a second
amount. A narrowly scoped SQL migration updates `billing_amount` only for the
two synthetic private-fixture email identifiers while their Billing reference
is still null. This guard preserves amounts already recorded by processing.

### Files and system areas changed

- `frontend/src/BillingPayrollManagement.jsx`: adds the queue Amount column and
  clearer aggregate labels.
- `frontend/src/styles/admin.css`: accommodates the fifth queue column and
  styles its currency value consistently with the administration interface.
- `backend/prisma/migrations/20260909010000_set_private_fixture_amount/migration.sql`:
  applies the guarded PHP 5,000 fixture correction.
- `change_log.txt` and `docs/development-change-log.md`: document the behavior,
  data scope, and verification.

### Impact assessment

- **API:** no endpoint, request, response, or authorization change; the UI uses
  the existing amount field.
- **Database:** updates at most two unprocessed synthetic requirement rows. No
  schema changes, operational scholar updates, deletions, or resets occur.
- **Configuration/dependencies:** no impact.
- **Security/privacy:** no new access path or personal data is introduced; the
  migration keys only on documented synthetic fixture identifiers.
- **Accessibility:** the new visible Amount header identifies every currency
  value, while the footer text distinguishes individual values from totals.
- **Deployment:** both frontend deployment and the additive backend data
  migration are required for the complete change.
- **Product scope:** amounts remain preparation data for Billing and official
  payroll-list generation. No fund release, claiming, disbursement,
  reconciliation, or monetary-audit behavior is added.

### Validation, limitations, rollback, and next work

Frontend lint and production build, the 82-test backend suite, migration-chain
validation in an isolated PostgreSQL schema, and Git whitespace checks are used
to verify the change before deployment. The PHP 5,000 value applies only to the
two private dummy records and is not a general policy for all private-school
scholars. If a fixture has already been processed, its recorded amount is
intentionally retained. Rollback can restore the previous queue columns and
labels; any unprocessed fixture amount can be corrected through a subsequent
data migration. Recommended next work is staff verification that the two
private fixtures show PHP 5,000 individually and PHP 10,000 together before
Process Billing.

## 2026-09-09 - Deployed Billing and Payroll Workflow Fixtures

### TL;DR

- Four clearly named dummy scholars are provisioned for staff testing: two public-school and two private-school records.
- Each fixture is ready for Billing in the current primary active period and can continue to the official Payroll list.
- Fixture portal accounts are disabled, all identity details are synthetic, and no usable uploaded document is represented.
- The migration is idempotent and does not delete, reset, or overwrite processed operational records.

### Objective and reason

Staff needed safe records on the deployed system to verify the complete shared
Billing-to-Payroll workflow without processing real scholars. The objective was
to provide visibly labelled, deterministic fixtures covering both school
classifications and the active academic period.

### Previous and new behavior

Previously, deployed testing depended on whatever scholar records happened to
exist, which risked changing real or previously processed data. After this
migration runs, staff can identify four records by their `PGC-TEST-` control
numbers and `TEST ... SCHOLAR` names. Each begins at Ready for billing with an
assigned test school, academic details, amount, approved requirement markers,
and recorded physical-folder readiness.

### Affected users, workflow, and implementation

Administrators and Billing/Payroll staff can use the fixtures in the ordinary
workflow: select the active period, process the public and private fixtures in
Billing, confirm the generated Billing reference, then generate the official
Payroll list. The records intentionally use the same server validations as
normal scholars; there is no test-only bypass in the application.

The SQL migration selects the primary active period, falling back to the most
recent active period. It creates two clearly labelled test schools, upserts
four synthetic applicants and scholar accounts, creates disabled control
accounts for stable display identifiers, and upserts period-specific
requirements. Re-running the migration preserves any generated Billing
reference and does not return a processed fixture to Ready for billing.

The first deployment attempt exposed a baseline-schema compatibility issue:
tables managed with Prisma `@updatedAt` require an explicit value when rows are
inserted directly through SQL. The fixture migration now supplies
`CURRENT_TIMESTAMP` for every required `updated_at` field. The deployment
runner checks only this named fixture migration for an unfinished failed entry,
marks that entry rolled back, and retries the corrected migration. It does not
automatically resolve any other failed migration.

### Files and system areas changed

- `backend/prisma/migrations/20260909000000_seed_billing_payroll_demo/migration.sql`:
  provisions the idempotent test schools, scholars, and requirement rows.
- `backend/scripts/deploy-migrations.js`: performs narrowly scoped recovery of
  the known rolled-back fixture migration before normal migration deployment.
- `change_log.txt` and `docs/development-change-log.md`: document the fixture
  purpose, data impact, safeguards, and removal considerations.

### Impact assessment

- **API:** no endpoint or payload change; fixtures use the normal Scholar,
  Billing, and Payroll APIs.
- **Database:** adds two test schools, four synthetic applicants, four disabled
  control accounts, four scholar accounts, up to four application rows, and
  four period requirement rows. It does not alter schema or existing records.
- **Configuration/dependencies:** no environment variable or package change.
- **Security:** fixture control accounts have disabled login status and an
  unrecoverable generated password hash. Staff authorization and processing
  validation remain unchanged.
- **Privacy:** names, addresses, contact identifiers, family fields, schools,
  and requirement markers are explicitly synthetic. No real document content
  or private file location is included.
- **Accessibility:** test records use consistent `TEST` names and control
  numbers so they can be located using existing labelled search controls.
- **Deployment:** backend migration deployment is required. The migration is
  idempotent and executes inside the normal Render migration process. Recovery
  is restricted to the specifically named fixture migration and only when its
  migration record is unfinished and not already marked rolled back.
- **Product scope:** the fixtures test Billing and official payroll-list
  generation only; they do not add release, claiming, disbursement,
  reconciliation, or monetary-audit behavior.

### Validation, limitations, rollback, and next work

The existing 82 backend tests, frontend ESLint, frontend production build, and
backend syntax checks passed. Git whitespace validation passed. All 15
application migrations, including the corrected fixture migration, were then
applied from baseline to a fresh isolated PostgreSQL schema. The resulting
schema contained exactly four fixture applicants, and the temporary validation
schema was removed afterward. Final validation must still confirm the Render
migration result and query the records through the deployed authenticated
interface.

The requirement files are readiness markers rather than downloadable files,
so the fixtures are intended for Billing and Payroll processing rather than
document-preview testing. Removal should be performed by a dedicated cleanup
migration keyed to the `billing.workflow.*@pgceap.test` identifiers after staff
finishes testing; processed batches should be handled explicitly rather than
silently deleted. Recommended next work is to process one fixture of each
classification, verify both generated references, and then schedule fixture
cleanup.

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
# 2026-09-11 - Local database schema and Prisma tooling repair

## TL;DR

- Synchronized the localhost application database with the current Prisma schema, resolving the login HTTP 500.
- Made programmatic Prisma CLI launches reliable on Node.js 24 and made schema auditing compatible with the Rust-free PostgreSQL adapter.
- Preserved existing local records; Hostinger and all production services were untouched.
- Verified the local administrator query, expected HTTP 401 behavior for invalid credentials, and an integrity audit with no relationship orphans or audited duplicate groups.

## Objective and reason

Restore reliable local authentication for the local-first development workflow. The API health endpoint was healthy because its simple query did not exercise the missing columns, while administrator login failed when the current Prisma client queried an older local `_v2` schema. The intended schema provisioner was also blocked on Node.js 24 because `require.resolve('prisma')` resolved Prisma's type declaration rather than its executable CLI.

## Previous and new behavior

Previously, the local database accepted health queries but rejected current-model administrator queries with a missing-column error, resulting in `Server error during login.` The local schema provisioner could not run under Node.js 24, and the schema auditor could not deserialize PostgreSQL's native `name` type through the Rust-free adapter. The local schema now matches the current Prisma model, authentication reaches normal credential validation, Prisma utilities resolve the declared CLI binary directly, and audit metadata columns are cast to text.

## Users and workflows affected

Developers and maintainers can again test authentication locally. No production applicant, scholar, staff, Billing, Payroll, or Super Administrator account or workflow was changed. The approved operational scope still ends at official payroll-list generation.

## Implementation and data flow

- Added a shared Prisma CLI resolver based on `prisma/package.json` and its declared `bin.prisma` path.
- Updated application provisioning, clean-database provisioning, Prisma Studio, and production migration utilities to use that resolver.
- Added an explicit `--accept-data-loss` pass-through to the local application provisioner. It remains disabled unless deliberately supplied.
- Cast `information_schema` name-typed values to text in the schema audit for PostgreSQL driver-adapter compatibility.
- Ran the provisioner against the localhost suffixed application database only. Prisma added missing schema elements and the declared uniqueness constraint without deleting existing rows.

## Files and system areas changed

- `backend/scripts/prisma-cli.js`
- `backend/scripts/provision-application-database.js`
- `backend/scripts/provision-clean-database.js`
- `backend/scripts/studio-application-database.js`
- `backend/scripts/deploy-migrations.js`
- `backend/scripts/audit-schema.js`
- Local localhost PostgreSQL `_v2` application schema
- Project change documentation

## Impact

- **API:** no endpoint or response-contract change; local login no longer fails because of schema drift.
- **Database:** local schema synchronized additively with current Prisma declarations; existing records were retained. The new uniqueness constraint was accepted explicitly after the missing period column explained why preflight duplicate inspection could not run.
- **Configuration:** no `.env` value changed.
- **Security and privacy:** no credentials or record contents were logged in documentation. Schema tooling retains its local/production target safeguards, and potential data-loss acceptance requires an explicit flag.
- **Accessibility and UX:** no interface change; the erroneous local login failure is removed.
- **Deployment:** no deployment was performed. Hostinger, DNS, Vercel, Render, and the managed database were untouched. The CLI resolver also prevents the same Node.js 24 resolution failure in future controlled utility runs.

## Validation

- Confirmed local `/api/health` reported `healthy` and database `connected`.
- Reproduced the administrator query's missing-column failure before synchronization.
- Ran the local application provisioner successfully against `scholar_monitoring_v2` and regenerated Prisma Client 6.19.3.
- Confirmed the configured local administrator record can be queried and is active.
- Sent an invalid-password probe and received HTTP 401, proving authentication now follows its normal rejection path instead of returning HTTP 500.
- Schema audit completed with zero logical relationship orphans and zero duplicate groups for every audited unique candidate.

## Limitations, rollback, and recommended next work

Two preserved legacy local payroll-claim rows currently have no academic-period value because schema synchronization does not replay historical data migrations; the field is nullable and this does not affect login. Before testing historical payroll behavior, recreate or deliberately backfill local fixtures through an approved local-only procedure. Code rollback can restore the previous utility resolution, but reverting the additive local schema is unnecessary and could remove data. Run the full automated backend suite before committing these changes.

# 2026-09-11 - Windows-safe combined local launcher

## TL;DR

- Added `start-local.cmd` to launch the frontend and backend together on Windows.
- Developers can run locally even when PowerShell blocks the `npm.ps1` shim.
- Application behavior, database structure, production configuration, and Hostinger are unchanged.
- Verified the frontend returned HTTP 200 and the backend health endpoint reported a connected database.

## Objective and reason

Provide a single, reliable local command for running both application services before any production deployment. The repository already had a cross-platform `npm run dev` orchestrator, but the current Windows environment prevents direct invocation of the PowerShell `npm.ps1` shim under its execution policy.

## Previous and new behavior

Previously, developers could run `npm run dev`, but that command could be blocked before npm started on restricted Windows PowerShell installations. Developers can now run `.\start-local.cmd`; it checks for Node.js and npm, moves to the repository root, and invokes the existing combined launcher through `npm.cmd`. `Ctrl+C` remains the shutdown mechanism for both child services.

## Users and workflows affected

This affects developers and maintainers only. Applicant, scholar, staff, Billing, Payroll, and Super Administrator workflows are unchanged. The approved workflow still ends at official payroll-list generation.

## Implementation and data flow

`start-local.cmd` delegates to the root `npm run dev` script. The existing `scripts/dev.js` process starts `frontend` through Vite and `backend` through Nodemon, inheriting the local environment. No new network service, runtime dependency, or data path was introduced.

## Files and system areas changed

- `start-local.cmd`: new Windows launcher.
- `README.md`: documented the launcher and shutdown command.
- `change_log.txt` and `docs/development-change-log.md`: recorded the development-tooling change.

## Impact

- **API:** no endpoint or contract changes.
- **Database:** no schema, migration, or record changes; the local health validation used a read-only connectivity check.
- **Configuration:** no environment-variable changes.
- **Security and privacy:** no secrets are stored or displayed; the launcher uses the existing local environment.
- **Accessibility and UX:** no end-user interface changes; developer startup feedback now includes both local addresses.
- **Deployment:** no Hostinger, Vercel, Render, DNS, or production process changes.

## Validation

- Launched the existing combined development orchestrator through `npm.cmd run dev`.
- Vite started at `http://localhost:5173` and returned HTTP 200.
- Express started at `http://localhost:3601`; `/api/health` reported `healthy` with the database `connected`.
- Both test processes were stopped after validation.

## Limitations, rollback, and recommended next work

The `.cmd` convenience launcher is Windows-specific; macOS and Linux developers should continue using `npm run dev`. Rollback consists of removing `start-local.cmd` and its documentation. Before feature work, confirm the local `.env` intentionally targets the desired development database and never use production credentials casually.

# 2026-09-12 - Application, examination, scholar, billing, and payroll enhancements

## TL;DR

- Strengthened application address entry, guardian/parent identity handling, sibling controls, and mail-delivery feedback for applicants.
- Persisted examination activation and Paper and Pen/Online delivery mode, secured the online question window server-side, restored applicant attendance visibility, and added attendance-list export.
- Tailored scholar requirements by school type, removed the scholar-facing decision explanation, added configurable CAO Facebook access, and provided a printable private-scholar certification template.
- Enforced the private-scholar grant at exactly PHP 5,000 and made official payroll-list generation automatically download a genuine XLSX workbook.
- Applied only the additive examination settings to the localhost database and passed 90 backend tests, frontend lint/build, local API checks, and dependency audits; production remains untouched.

## Objective and reason

Implement the approved feature-fix list in the local development environment before any Hostinger promotion. The work corrects weak location validation, ambiguous guardian/parent identity handling, browser-only examination controls, premature question visibility, incomplete attendance presentation, school-type-specific scholar documents, incorrect private grant amounts, and the absence of an automatic Excel payroll-list export. It also makes a non-configured mailer visible rather than silently appearing successful.

## Previous and new behavior

Previously, Section 2 accepted limited backend municipality values and did not verify that a barangay belonged to its municipality; its free-text address and course fields retained mixed case. The form did not explicitly record whether a guardian was one of the listed parents, sibling selects contained duplicate visual zero options, and email delivery failures were not surfaced on the application confirmation. The existing backend one-family/one-active-sibling rule already rejected matching parent pairs and remains authoritative.

The form now uppercases its Section 2 free-text address and course fields, validates location codes in the browser, and validates the complete municipality/barangay relationship again against repository datasets on the server. Applicants declare whether the guardian is one of the listed parents; when selected, a Father/Mother selector copies that parent's name and occupation, while an unrelated guardian is entered manually. No guardian-address fields are displayed or stored. Sibling counts use one real zero option in each Select.

Examination delivery was previously stored only in one browser's local storage, and the route could render questions before the API established an active test window. Examination enabled state and delivery mode are now singleton database settings. Only authenticated Applicants can route to the question view, and both question rendering and submission require the global examination switch, Online delivery, an active municipality schedule, the Philippine calendar date window, and no earlier result. Paper and Pen remains the safe default. Applicant dashboards again show examination attendance, while administrators can download a municipality attendance CSV containing assigned applicants and recorded attendance states.

Public scholars no longer see the private tuition-receipt requirement; private scholars retain it and receive a printable, pre-filled certification template. The scholar-facing eligibility/official decision explanation block was removed. A direct CAO Facebook post action is supported through `VITE_CAO_FACEBOOK_ANNOUNCEMENT_URL` and remains hidden until the exact official post URL is configured.

Private-scholar billing now resolves to exactly PHP 5,000 in management responses, edits, billing-batch totals, and created claim records regardless of a missing, lower, or higher submitted amount. The private amount field is fixed in the UI, and the backend remains authoritative. Clicking Generate payroll list now creates the official in-scope list and automatically downloads an XLSX workbook with identification, school, location, amount, signature, total, and batch metadata. No fund-release, claiming, disbursement, reconciliation, or monetary-audit function was added.

## Affected users and workflows

- **Applicants:** stricter applicant-address input, explicit guardian/parent selection, accurate sibling selectors, visible email-delivery status, protected examination access, and attendance status.
- **Scholars:** school-type-appropriate public requirements, a cleaner portal, optional official Facebook link, and a private-scholar certification template.
- **Administrators:** persisted examination controls and municipality attendance exports.
- **Billing/Payroll staff:** reliable private-grant values and automatic official payroll-list XLSX output.
- **Developers:** clearer mailer verification diagnostics and local-only schema/test workflow.

## Implementation and data flow

- Repository municipality and barangay JSON files now drive client choices and server-side municipality/barangay relationship validation.
- Guardian identity state is kept in the application draft. Submission stores the resolved guardian name and occupation, the same-as-parent declaration, and the selected Father/Mother role in the existing family JSON and legacy guardian JSON projection; no guardian address is collected.
- `application_settings` gained `examination_enabled` and constrained `exam_delivery_mode` fields through an additive migration. A protected settings API reads and updates them, and an examination-access service resolves safe defaults and Philippine date-window eligibility.
- The applicant application response contains examination access and attendance state; the online examination page refuses to mount question content when access is not allowed. Submission repeats the same authoritative server checks.
- Applicant-management responses expose attendance status and timestamp for the administrative CSV export.
- Scholar application responses include resolved school classification. The frontend filters tuition receipt accordingly and constructs the print-only certification document locally without uploading a new private file.
- The CAO post link comes only from a public frontend environment value; no URL was guessed or hard-coded.
- A centralized billing grant resolver returns PHP 5,000 for every private-school classification and preserves valid configured public amounts.
- ExcelJS is loaded dynamically only when a payroll list is successfully generated; it produces the XLSX locally from the exact submitted queue and returned batch metadata.
- Mail delivery remains non-transactional so a provider outage cannot roll back an application. The response now exposes a safe delivery state, the confirmation tells applicants to save displayed credentials when delivery fails, and the verification command lists missing variable names without their values.

## Files and system areas changed

- Application UI and validation: `frontend/src/components/ApplicationForm.jsx`, `backend/middleware/validators.js`, `backend/controllers/applicationController.js`.
- Examination controls and security: `backend/services/examinationAccess.js`, `backend/controllers/applicationSettingsController.js`, `backend/routes/applicationRoutes.js`, `frontend/src/SettingsManagement.jsx`, `frontend/src/ExamPage.jsx`, `frontend/src/App.jsx`, `frontend/src/ApplicantDashboard.jsx`, and `frontend/src/Dashboard.jsx`.
- Database: `backend/prisma/schema.application.prisma` and `backend/prisma/migrations/20260912000000_add_examination_controls/migration.sql`.
- Scholar portal: `frontend/src/ScholarDashboard.jsx` and `frontend/.env.example`.
- Billing/payroll: `backend/services/billingGrant.js`, `frontend/src/BillingPayrollManagement.jsx`, `frontend/package.json`, and `frontend/package-lock.json`.
- Mail diagnostics: `backend/scripts/verify-mailer.js`.
- Tests: `backend/tests/examinationAccess.test.js`, `backend/tests/billingGrant.test.js`, and `backend/tests/applicationGuardian.test.js`.
- Project change documentation.

## Impact

- **API:** added authenticated GET/PUT `/api/examination-settings`; enriched `/api/applications/me` with school classification, examination access, and attendance; enriched applicant-management attendance fields; application creation reports a safe mail-delivery reason. Existing mutation authorization and rate limits remain in place.
- **Database:** additive boolean and constrained delivery-mode columns on singleton `application_settings`; no applicant, scholar, billing, payroll, document, or legacy payment record was deleted or rewritten. Local schema synchronization retained existing records.
- **Configuration:** added optional public `VITE_CAO_FACEBOOK_ANNOUNCEMENT_URL`. Gmail API or SMTP variables remain required for actual sending. Secrets must stay in untracked local/host settings.
- **Security:** online question views are protected at route, read, and submission layers; forged municipality/barangay pairs are rejected server-side; XLSX and CSV exports are initiated only in authenticated staff workspaces. The printable certificate escapes record values before writing its isolated document.
- **Privacy:** no additional guardian address is collected. Guardian identity/occupation remains in the existing restricted application/family record. Attendance exports contain applicant identity/contact details and must be handled as restricted operational records. No private URL or credential is embedded in documentation.
- **Accessibility:** new switches and actions use labelled native inputs/buttons, locked examination access has a clear return path, and attendance state is presented in text. The certification template supports browser print/save-to-PDF.
- **Deployment:** no Hostinger, Render, Vercel, DNS, or managed-database deployment occurred. A future deployment must run the additive migration before the new backend starts and configure the optional official Facebook URL.
- **Approved scope:** payroll behavior ends at generating and exporting the official payroll list. Older payment/release-oriented code remains legacy and unchanged; this work does not validate, release, claim, reconcile, or audit money.

## Validation performed

- Synchronized `scholar_monitoring_v2` on localhost with the application Prisma schema and regenerated Prisma Client 6.19.3.
- Passed all 90 backend tests, including new examination-window/default, private-grant, and guardian/parent identity validation tests.
- Passed frontend ESLint and the Vite production build (493 modules transformed), including the corrected guardian/parent selector UI.
- Confirmed local API health was healthy with PostgreSQL connected.
- Authenticated locally and round-tripped examination settings from inactive Paper and Pen to active Online and back to the safe inactive Paper and Pen default.
- Confirmed both frontend and backend npm audits report zero vulnerabilities.
- `git diff --check` reported only the repository's existing Windows line-ending notices and no whitespace errors.

## Known limitations, rollback, and recommended next work

Actual email delivery is not locally testable until the maintainer configures one complete Gmail API or Gmail App Password method in `backend/.env` and runs `npm --prefix backend run mailer:verify`; credentials must never be pasted into source control or change logs. The CAO Facebook action also requires the exact official post URL in the frontend environment variable. The generated certification is a working template and should receive CAO approval for final wording/signatories before operational use.

Rollback can remove the new UI/API behavior and leave the two additive examination columns harmlessly in place. Do not drop them during an emergency rollback because destructive schema changes are unnecessary. Before production promotion, complete role-based browser testing for application submission, applicant exam lock/open/close behavior, public/private scholar views, attendance export, private billing processing, and XLSX opening in Microsoft Excel or LibreOffice; then obtain explicit deployment approval.

# 2026-09-12 - Windows local launcher process-tree cleanup

## TL;DR

- Corrected the combined Windows launcher so Ctrl+C terminates launcher-owned Vite, nodemon, and API descendants.
- Removed stale local processes that were serving obsolete frontend/backend code on ports 5173 and 3601.
- Verified the clean API accepts the valid Santa Elena/San Lorenzo location pair and proceeds to the current guardian validation.
- No database records, production services, or Hostinger resources were changed.

## Objective and reason

Prevent outdated local code from continuing to serve after the combined development launcher is stopped. On Windows, terminating only each immediate npm wrapper could leave its Node descendants alive. Those stale processes retained the expected ports, causing later launches to move Vite to another port or silently leave the browser connected to an obsolete API validator.

## Previous and new behavior

Previously, the root launcher called `child.kill()` on the two immediate npm child processes. Windows npm and nodemon process trees could outlive those wrappers, so `localhost:5173` or `localhost:3601` could still serve an earlier code version. The launcher now uses Windows `taskkill` with tree termination for only the child process IDs it created. Other platforms retain signal-based child termination.

## Affected users and workflows

- **Developers/testers:** stopping the combined local session now releases its standard frontend and backend ports reliably.
- **Applicants and staff:** no deployed or production workflow changes; this affects only local testing.

## Implementation and data flow

`scripts/dev.js` now imports `spawnSync` and, during Windows shutdown, terminates each launcher-owned npm process tree before the launcher exits. It does not enumerate or terminate unrelated system processes during normal operation.

## Impact

- **Files:** `scripts/dev.js` and change documentation.
- **API/database/configuration:** no contract, schema, data, environment-variable, or credential changes.
- **Security/privacy/accessibility:** no production security, personal-data, or user-interface impact.
- **Deployment:** local development only; no Hostinger or other deployment occurred.
- **Approved scope:** no payroll, fund-release, payment, or monetary-audit behavior changed.

## Validation performed

- Identified stale Node listeners created on September 11 and confirmed the obsolete API returned `Municipality is invalid.` for Santa Elena/San Lorenzo.
- Removed the stale listeners and started exactly one current frontend on port 5173 and one current backend on port 3601.
- Repeated a non-persisting validation request: the same location pair passed and the API correctly reached the intentionally failing guardian-detail validation.
- Passed JavaScript syntax validation for the updated launcher.

## Known limitations, rollback, and recommended next work

Forced Windows tree termination interrupts in-flight local requests, which is expected when a developer explicitly stops the development session. Rollback consists of restoring signal-only termination, but doing so may recreate orphaned Node processes. Continue using the root launcher rather than opening duplicate frontend/backend sessions separately.

# 2026-09-12 - Examination setting spacing and save-result modal

## TL;DR

- Added consistent internal spacing, a separated action footer, and a visible gap between Examination Settings and System Health.
- Added an accessible modal confirming the saved activation state and Paper/Online delivery mode.
- Save failures now also open a clearly labelled failure modal while retaining the inline retry message.
- Passed frontend lint and the production build; no API, database, or deployment changes were needed.

## Objective and reason

Improve the visual hierarchy of the examination controls and provide unmistakable feedback when an administrator presses **Save examination setting**. The previous card placed controls and the save button in a comparatively flat sequence, while successful saves appeared only as a short-lived page-heading badge that could be missed.

## Previous and new behavior

Previously, the activation panel followed the card heading without dedicated spacing, the two delivery choices and save button shared generic margins, and successful feedback appeared briefly near the page title. The card now has explicit spacing between the heading, activation panel, delivery choices, and a bordered save-action footer. An explicit sibling margin also separates its bottom border from the differently classed System Health panel. A successful save opens a modal describing whether Examination Mode is active or inactive and whether Paper and Pen or Online Examination was persisted. A failed save opens a failure modal and preserves the existing inline error/retry control.

## Affected users and workflows

- **Super Administrators and Administrators:** receive clear visual confirmation after saving examination controls.
- **Applicants:** no workflow change; the already-authoritative saved setting continues to control examination access.
- **Other staff:** examination controls remain read-only according to existing permissions.

## Implementation and data flow

`SettingsManagement` stores a transient save-result object after the existing PUT request finishes. The modal renders only from that response result, displays the server-returned activation and delivery values on success, supports Escape/backdrop/button dismissal, and moves initial focus to its close action. Responsive CSS stacks the explanatory note and save button on narrow screens.

## Files and system areas changed

- `frontend/src/SettingsManagement.jsx`
- `frontend/src/styles/admin.css`
- `frontend/src/styles/admin-responsive.css`
- Project change documentation

## Impact

- **API:** no endpoint or payload changes; the existing PUT `/api/examination-settings` response drives the modal.
- **Database/configuration:** no schema, records, environment variables, or secrets changed.
- **Security/privacy:** existing role authorization remains unchanged; the modal contains only examination configuration status and no personal data.
- **Accessibility:** modal semantics, labelled title/description, keyboard dismissal, initial button focus, and textual success/failure states were added.
- **Deployment:** local source only; nothing was deployed to Hostinger or another environment.
- **Approved scope:** no Billing, Payroll, payment, fund-release, or monetary-audit behavior changed.

## Validation performed

- Frontend ESLint passed.
- Vite production build passed with 493 transformed modules.
- Git whitespace validation reported no errors; only the repository's existing Windows line-ending notices appeared.

## Known limitations, rollback, and recommended next work

The save result is intentionally modal and must be dismissed before continuing. Rollback consists of removing the save-result state/modal and examination-specific spacing rules; the persisted setting and API remain unaffected. Complete a browser check at desktop and narrow viewport widths before any approved deployment.

# 2026-09-12 - School Catalog consolidated into Settings

## TL;DR

- Moved the complete School Catalog interface into the Super Administrator Settings workspace.
- Removed the redundant School Catalog sidebar destination while preserving stale-navigation compatibility.
- Preserved catalog refresh, metrics, search, classification filters, classification editing, and authorization.
- Passed frontend lint and production build; no API, database, or deployment behavior changed.

## Objective and reason

Consolidate system-wide configuration in one Settings workspace rather than presenting School Catalog as a separate top-level administration destination. School classification controls are configuration data used by application, scholar, Billing, and Payroll list-generation logic, making Settings the clearer operational location.

## Previous and new behavior

Previously, Super Administrators opened School Catalog from a dedicated sidebar item and Settings contained application, period, examination, and health controls. School Catalog is now rendered as an embedded Settings card for Super Administrators, between Examination Settings and System Health. Its complete interface and classification modal remain operational. The standalone sidebar item was removed. If an existing in-memory navigation state still names School Catalog, the dashboard renders Settings instead of a dead or generic page.

## Affected users and workflows

- **Super Administrators:** manage the school catalog from Settings instead of a separate sidebar page.
- **Regular and Billing/Payroll Administrators:** retain their previous permissions; the embedded catalog is not exposed to them.
- **Applicants and scholars:** school choices and stored classifications behave exactly as before.

## Implementation and data flow

`SettingsManagement` conditionally mounts `SchoolCatalogManagement` only for the Super Administrator role. The catalog component accepts an embedded presentation flag but continues using the same authenticated catalog GET and classification PUT requests. Dashboard routing keeps a compatibility path from the retired section name to Settings, and the sidebar no longer advertises the standalone destination.

## Files and system areas changed

- `frontend/src/components/Sidebar.jsx`
- `frontend/src/Dashboard.jsx`
- `frontend/src/SettingsManagement.jsx`
- `frontend/src/SchoolCatalogManagement.jsx`
- `frontend/src/styles/school-catalog.css`
- Project change documentation

## Impact

- **API/database/configuration:** no endpoint, payload, schema, record, or environment-variable changes.
- **Security:** the existing Super Administrator-only visibility and server authorization are preserved.
- **Privacy:** no new personal information is displayed or stored.
- **Accessibility:** existing labelled search/filter controls and classification modal are preserved; responsive embedded layout avoids nested narrow-screen width reduction.
- **Deployment:** local source only; nothing was deployed to Hostinger or another environment.
- **Approved scope:** school classification continues to inform in-scope Billing and official payroll-list generation only; no fund-release, payment, claiming, reconciliation, or monetary-audit feature was added.

## Validation performed

- Frontend ESLint passed.
- Vite production build passed with 493 transformed modules.
- Git whitespace validation reported no errors beyond existing Windows line-ending notices.

## Known limitations, rollback, and recommended next work

The Settings page is longer for Super Administrators because it now contains the catalog directory. Search and classification filters remain available to manage that length. Rollback consists of restoring the sidebar route/import and removing the embedded render and styles; no data rollback is required. Complete a desktop and mobile browser check before any approved deployment.

# 2026-09-12 - Examination modal action alignment

## TL;DR

- Rebuilt the attendance-download and exam-activation controls as a consistent action group.
- Prevented the attendance label from collapsing into multiple narrow lines.
- Added two-column tablet/mobile behavior and single-column behavior on very narrow screens.
- Preserved existing CSV export and examination activation logic.

## Objective and reason

Correct the visually broken action area in the municipality examination applicant modal. The unclassified attendance button was compressed between the activation description and fixed-width activation button, causing `Download Attendance List` to wrap into an awkward narrow column.

## Previous and new behavior

Previously, three direct flex children competed for the modal width and only the activation button had dedicated styling. Both actions are now grouped, share consistent height, typography, spacing, alignment, and non-wrapping labels, while retaining distinct secondary and primary visual treatments. On smaller screens the group uses two equal columns, then stacks below 440 pixels.

## Affected users and workflows

- **Administrators managing examinations:** receive clearer, easier-to-select attendance and activation actions.
- **Applicants:** no access or examination behavior changed.

## Implementation and data flow

The existing event handlers remain attached to their respective buttons. Only the JSX grouping, concise attendance label, CSS presentation, and responsive layout changed.

## Files and system areas changed

- `frontend/src/Dashboard.jsx`
- `frontend/src/styles/admin.css`
- Project change documentation

## Impact

- **API/database/configuration/security/privacy:** no changes.
- **Accessibility:** larger consistent targets and stable text labels improve readability and operability.
- **Deployment:** local source only; nothing was deployed.
- **Approved scope:** no Billing, Payroll, payment, fund-release, or monetary-audit behavior changed.

## Validation performed

- Frontend ESLint passed.
- Vite production build passed with 493 transformed modules.
- Git whitespace validation reported no errors beyond existing Windows line-ending notices.

## Known limitations, rollback, and recommended next work

The modal retains its existing maximum width; exceptionally long translations may require future localization-specific sizing. Rollback consists of restoring the previous inline buttons and removing the action-group CSS. Perform a quick browser check at desktop, tablet, and phone widths before deployment.

# 2026-09-12 - Applicant examination-state synchronization

## TL;DR

- Corrected the Applicant Portal to recognize the persisted `paper` and `online` delivery modes.
- Made global examination deactivation override municipality activation in applicant schedule presentation and guidance.
- Added prompt same-tab/cross-tab refresh plus focus, visibility, and 15-second visible-tab synchronization against the server.
- Passed 91 backend tests, frontend lint, and production build; no database migration or deployment occurred.

## Objective and reason

Ensure examination activation and delivery changes made by administrators are accurately reflected in the Applicant Portal. The portal contained a stale comparison against `face-to-face` even though the persisted contract now returns `paper` or `online`, loaded application state only once, and presented an active municipality schedule without consistently considering the global examination switch.

## Previous and new behavior

Previously, Paper and Pen details could fail to render because the client expected the obsolete mode string. An Applicant Portal tab already open during an administrative change retained its initial data until manually reloaded. The announcement used municipality `isActive` directly, so a globally disabled examination could still appear published. Applicant guidance likewise considered the municipality schedule without the global switch.

The portal now uses `paper` and `online`, labels the saved delivery mode, shows the venue for Paper and Pen or Applicant Portal delivery for Online Examination, and treats global plus municipality activation as a combined requirement. It requests uncached `/applications/me` data whenever the tab gains focus or visibility, after same-tab save events, after cross-tab revision events, and every 15 seconds while visible. Server-generated guidance also receives the persisted global setting and remains in the waiting state while examination access is globally disabled.

## Affected users and workflows

- **Applicants:** see current examination state and correct Paper/Online instructions without requiring a full browser reload.
- **Super Administrators and Administrators:** saved global settings propagate to applicant tabs.
- **Authorized examination staff:** persisted municipality activation changes propagate after the save request succeeds.

## Implementation and data flow

- Successful examination-settings and schedule writes publish non-sensitive timestamp revision keys for same-origin cross-tab synchronization and dispatch same-tab events.
- Applicant Dashboard listeners trigger a fresh authenticated, no-cache application request; a visible-tab polling fallback covers other browsers/devices.
- The backend feeds resolved examination settings into applicant guidance, so presentation and recommended actions follow the same global activation rule as the access payload.
- Online question access remains additionally constrained by the active Philippine-date examination window and prior-submission checks.

## Files and system areas changed

- `frontend/src/SettingsManagement.jsx`
- `frontend/src/Dashboard.jsx`
- `frontend/src/ApplicantDashboard.jsx`
- `backend/controllers/applicationController.js`
- `backend/services/applicantGuidance.js`
- `backend/tests/applicantGuidance.test.js`
- Project change documentation

## Impact

- **API:** no endpoint or payload shape changed; `/applications/me` guidance now consistently respects the already-returned examination setting.
- **Database/configuration:** no schema, records, environment variables, or credentials changed.
- **Security:** access remains server-authoritative; refresh events contain only timestamps, never tokens or applicant data.
- **Privacy:** no new personal information is collected, cached, or broadcast.
- **Accessibility:** applicants receive explicit textual Paper and Pen/Online labels and delivery descriptions.
- **Deployment:** local source only; nothing was deployed to Hostinger or another environment.
- **Approved scope:** no Billing, Payroll, payment, fund-release, or monetary-audit behavior changed.

## Validation performed

- Added and passed a backend test proving global deactivation keeps an otherwise active municipality schedule in the applicant waiting state.
- Passed all 91 backend tests.
- Passed frontend ESLint and the Vite production build with 493 transformed modules.
- Git whitespace validation reported no errors beyond existing Windows line-ending notices.

## Known limitations, rollback, and recommended next work

Cross-device updates rely on the 15-second visible-tab poll, while same-browser tabs update immediately after a successful persisted save. Online question access will correctly remain locked outside the configured Philippine-date window even when both activation switches are on. Rollback consists of removing the refresh listeners/revision signals and restoring the prior display checks, but would reintroduce stale portal state. Browser-test global on/off, municipality on/off, Paper and Pen, Online inside the date window, and Online outside the window before deployment.

# 2026-09-12 - Examination guidance icon correction

## TL;DR

- Replaced the generic checklist icon on the examination-schedule action with a calendar-check icon.
- Improved visual recognition for applicants without changing navigation or examination access.
- Frontend lint and production-build verification completed successfully.

## Objective and reason

Make the `Review your examination schedule` action visually match its purpose. The generic checklist symbol did not clearly communicate that the card opens a scheduled examination.

## Previous and new behavior

Previously, every personalized guidance action displayed the same checklist icon. Examination actions now display a calendar with a check mark, while non-examination actions continue using the existing checklist icon.
The icon container now also uses a more specific grid rule and zero line-height so the shared action-span styling cannot override its centering; the SVG is aligned consistently in both axes.

## Affected users and workflows

Applicants receive a clearer visual cue when reviewing their assigned examination schedule. The action destination and all administrative workflows remain unchanged.

## Implementation and data flow

`PortalGuidance` selects the Lucide `CalendarCheck2` component when an action has the existing `examination` type and falls back to `ListChecks` for other action types. No data flow changed.

## Files and system areas changed

- `frontend/src/components/PortalGuidance.jsx`
- Project change documentation

## Impact

- **API/database/configuration/security/privacy:** no impact.
- **Accessibility:** the icon remains decorative and hidden from assistive technology; the existing descriptive text remains authoritative.
- **Deployment:** local source only; nothing was deployed.
- **Approved scope:** no Billing, Payroll, payment, fund-release, or monetary-audit behavior changed.

## Validation performed

- Frontend ESLint passed.
- Vite production build passed.

## Known limitations, rollback, and recommended next work

The icon is selected from the action type, so future examination actions automatically receive the same visual. Rollback consists of restoring the single checklist icon. Confirm the card visually in the Applicant Portal before the next approved deployment.

# 2026-09-12 - Attendance-gated online examination access

## TL;DR

- Replaced misleading schedule-action wording with state-specific examination instructions.
- Online questions remain locked until authorized staff mark the applicant `Present` in Examination Attendance.
- Added persisted Pending and Present attendance controls with server authorization and activity logging; Absent is not selectable.
- Passed all 93 backend tests, frontend ESLint, and the production build; no schema migration or deployment occurred.

## Objective and reason

Align the Applicant Portal action with its actual destination and prevent applicants from viewing online questions before staff confirm their physical attendance. The previous `Review your examination schedule` action could open the questionnaire, and access relied only on global mode, municipality activation, and the date window.

## Previous and new behavior

Previously, an eligible online applicant could open the question view during an active schedule even while attendance was Pending, and submitting the examination automatically changed attendance to Present. Administrators could view attendance but had no control for recording it.

Now, Pending online applicants see `Wait for attendance confirmation` without an Open link. Once authorized staff select Present, the guidance becomes `Start your online examination` and links to the secured question view. Paper-and-Pen guidance says `Attend your qualifying examination` and does not imply that it opens online questions. Both the application-access response and the submission endpoint require an existing Present exam assignment; submission no longer self-confirms attendance.

## Affected users and workflows

- **Applicants:** cannot view or submit online questions until attendance is explicitly Present and all existing activation/date conditions are satisfied.
- **Super Administrators, Administrators, and authorized examination staff:** can record Pending or Present from the assigned-applicant list.
- **Paper-and-Pen applicants:** receive accurate venue-attendance wording rather than an online-question action.

## Implementation and data flow

The Examination Management applicant list sends an authenticated attendance update containing only the selected Pending or Present status and route identifiers. The server rejects Absent and all other status values, then verifies the active-period examination, the applicant's existing assignment, role, and Examination section access before updating `exam_slots`. Completed examinations cannot be changed away from Present. Applicant data refresh then exposes the stored status. A shared access helper requires global Online mode, an active in-window municipality schedule, no prior result, and `examSlot.appeared === true`. The submission endpoint performs its own Present check to prevent client-side bypass.

## Files and system areas changed

- `backend/services/examinationAccess.js`
- `backend/services/applicantGuidance.js`
- `backend/controllers/applicationController.js`
- `backend/routes/applicationRoutes.js`
- `backend/middleware/activityAudit.js`
- `backend/tests/examinationAccess.test.js`
- `backend/tests/applicantGuidance.test.js`
- `frontend/src/Dashboard.jsx`
- `frontend/src/ApplicantDashboard.jsx`
- `frontend/src/ExamPage.jsx`
- `frontend/src/styles/admin.css`
- Project change documentation

## Impact

- **API:** added authenticated `PUT /examinations/:examId/attendance/:applicantId`; the existing `/applications/me` access decision is stricter without changing its shape.
- **Database:** no schema migration; existing `exam_slots.appeared`, `appeared_at`, and `forfeited_at` fields store the status.
- **Configuration:** no environment or configuration changes.
- **Security:** server-side access and submission checks prevent direct-route and crafted-request bypass; role and section-access middleware protect attendance changes.
- **Privacy:** no new personal information is collected or returned.
- **Accessibility:** each attendance selector has an applicant-specific accessible label; guidance remains textually explicit without relying on color or icons.
- **Deployment:** local source only; nothing was deployed.
- **Approved scope:** no Billing, Payroll, payment, fund-release, or monetary-audit behavior changed.

## Validation performed

- Added tests proving Pending attendance blocks access, Present permits access during the valid window, completed examinations remain blocked, and guidance removes the route until attendance confirmation.
- Passed all 93 backend tests and backend syntax checks.
- Passed frontend ESLint and the Vite production build with 494 transformed modules.

## Known limitations, rollback, and recommended next work

Applicant tabs on another device may take up to the existing 15-second visible-tab refresh interval to reflect a newly recorded status. Attendance cannot be recorded when no exam assignment exists, which intentionally protects against cross-examination changes. Rollback requires removing the attendance endpoint/control and Present checks together; removing only the UI would leave applicants permanently locked. Before deployment, browser-test Pending and Present transitions with separate staff and applicant sessions, verify that crafted Absent updates are rejected, and test direct URL and submission attempts while Pending.

# 2026-09-12 - White long folder requirement retirement

## TL;DR

- Removed the White Long Folder with Fastener from scholar-facing and staff-facing requirement screens.
- Removed the folder from guidance, completion calculations, and Billing eligibility checks.
- Retired the physical-folder receipt API without deleting historical values or database columns.
- Passed all 93 backend tests, frontend ESLint, and the production build; no deployment occurred.

## Objective and reason

Remove the white long folder as an active PGCEAP scholar requirement so scholars are not instructed to submit it and staff do not need to record a receipt before Billing preparation.

## Previous and new behavior

Previously, the Scholar Portal listed a White Long Folder with Fastener, applicant guidance generated a physical-folder action, Document Reviews included a receipt directory, and missing receipt state blocked Billing eligibility. The application and scholar-management requirement summaries also exposed the item.

The active workflow now contains only applicable online document requirements. Requirement completion depends exclusively on approval of those files, guidance never requests a folder, Document Reviews no longer displays or updates folder receipts, and legacy folder state cannot block Billing.

## Affected users and workflows

- **Scholars:** no longer see or receive reminders for a white long folder.
- **Billing and document-review staff:** no longer record physical-folder receipts or treat them as a Billing prerequisite.
- **Administrators:** scholar requirement summaries no longer include the folder.

## Implementation and data flow

The shared requirement snapshot and Billing evaluator ignore physical-folder fields. Applicant guidance derives completion and actions only from applicable online requirements. Scholar Portal rendering, notifications, counts, and completion messaging no longer consume folder state. The Document Reviews response no longer queries or returns physical-folder entries, and its receipt mutation route was removed. Existing `folder_physical_submitted` values are not read by the active workflow.

## Files and system areas changed

- `backend/services/lifecycleIntegrity.js`
- `backend/services/applicantGuidance.js`
- `backend/controllers/applicationController.js`
- `backend/controllers/documentReviewController.js`
- `backend/routes/applicationRoutes.js`
- `backend/middleware/activityAudit.js`
- `backend/tests/lifecycleIntegrity.test.js`
- `backend/tests/applicantGuidance.test.js`
- `frontend/src/ScholarDashboard.jsx`
- `frontend/src/DocumentReviewManagement.jsx`
- `frontend/src/styles/scholar-portal.css`
- `frontend/src/styles/document-reviews.css`
- Project change documentation

## Impact

- **API:** removed `PUT /document-reviews/:applicantId/physical-folder` and the `physicalFolders` collection from Document Reviews; `/applications/me` no longer returns the folder-only `scholarRequirements` object.
- **Database:** no schema or data migration. Legacy folder columns and historical values are retained but disabled to avoid destructive data loss.
- **Configuration:** no impact.
- **Security/privacy:** removes an obsolete write surface and unnecessary folder-status exposure; no personal data was added or migrated.
- **Accessibility:** requirement lists and status messaging are shorter and no longer contain an unavailable physical action.
- **Deployment:** local source only; nothing was deployed.
- **Approved scope:** Billing readiness changed only by removal of this document prerequisite; payroll-list generation and the boundary excluding release/payment workflows remain unchanged.

## Validation performed

- Updated eligibility coverage to prove both true and false legacy folder values have no effect.
- Updated guidance coverage to prove only applicable online-document actions are produced.
- Passed all 93 backend tests and backend syntax checks.
- Passed frontend ESLint and the Vite production build with 494 transformed modules.

## Known limitations, rollback, and recommended next work

The legacy database columns remain intentionally available for historical compatibility but are unused. Rollback would restore the UI, endpoint, guidance action, and eligibility blocker; retained values allow that without reconstructing data. Before deployment, browser-test Scholar requirements, Document Reviews, Scholar Management, and Billing readiness for both public- and private-school scholars.

# 2026-09-12 - Expanded Applicant Record details

## TL;DR

- Expanded the Applicant Record drawer with existing personal, address, academic, family, examination, and account information.
- Uses the latest active application plus applicant and account records; no new information is collected or stored.
- Keeps passwords, uploaded document contents, and authentication data out of the response and interface.
- Passed all 93 backend tests, frontend ESLint, and the production build; no deployment occurred.

## Objective and reason

Give authorized administrators a sufficiently complete applicant profile from the Applicant directory without requiring them to cross-reference the original form or unrelated workspaces.

## Previous and new behavior

Previously, the drawer showed only email, a derived username, municipality, barangay, school year, registration time, and last login. It omitted most of the submitted application information.

The drawer now groups available data into Contact Information, Personal Information, Residential Address, Academic Information, Parent and Guardian Information, Examination Information, and Account Activity. Missing values are explicitly labelled `Not provided`, `Not assigned`, or `Not scheduled`. The username now comes from the actual control-account record rather than being reconstructed from the applicant's name.

## Affected users and workflows

- **Super Administrators, Administrators, and authorized applicant-management staff:** can review a fuller applicant record from the existing View action.
- **Applicants and scholars:** no portal workflow or stored information changes.

## Implementation and data flow

The existing protected applicant-management query selects additional non-secret applicant columns and identity, address, school-plan, and family JSON from the latest non-withdrawn application. The server normalizes these values into the existing applicant record response. A dedicated drawer component renders compact labelled groups and retains the existing scrolling, close control, backdrop behavior, and responsive width.

## Files and system areas changed

- `backend/controllers/applicationController.js`
- `frontend/src/Dashboard.jsx`
- Project change documentation

## Impact

- **API:** the existing `/applicants/management` applicant objects gained additional fields; no endpoint or existing field was removed.
- **Database/configuration:** no schema, migration, stored-data, or environment change.
- **Security:** the endpoint retains authentication, role checks, and Applicants section authorization. Password hashes, reset tokens, document bodies, and other credentials are not selected or returned.
- **Privacy:** more already-collected applicant information is visible in the authorized staff drawer; access scope is unchanged and no information is exposed publicly.
- **Accessibility:** information is grouped under descriptive headings with semantic definition lists and explicit missing-value text.
- **Deployment:** local source only; nothing was deployed.
- **Approved scope:** no Billing, Payroll, payment, fund-release, or monetary-audit behavior changed.

## Validation performed

- Backend controller syntax validation passed.
- All 93 backend tests passed.
- Frontend ESLint passed.
- Vite production build passed with 494 transformed modules.

## Known limitations, rollback, and recommended next work

Older applicant records may legitimately show missing values where historical application JSON did not contain the newer fields. The drawer intentionally does not display uploaded document contents or raw eligibility proof data. Rollback consists of returning the management query and drawer to their smaller field set. Browser-check a recent and a legacy applicant at desktop and mobile widths before deployment.

# 2026-09-12 - Administrator-managed Facebook links for announcements

## TL;DR

- Administrators can attach an optional exact official CAO Facebook post URL while creating or editing an announcement.
- Scholars see a `View official Facebook post` action only when the currently published announcement contains a validated link.
- Replaced the single build-time Facebook URL with a per-announcement database field; existing announcements remain valid with no link.
- Validation accepts HTTPS Facebook hosts only; local backend tests, frontend lint/build, Prisma generation, and migration checks passed.

## Objective and reason

Allow scholarship-related posts from the official CAO Facebook Page to be represented in the Scholar Portal without Facebook Page administration or Meta API credentials. The workflow deliberately uses administrator review and manual entry rather than unreliable public-page scraping.

## Previous and new behavior

Previously, the Scholar Portal could show one static Facebook link supplied through `VITE_CAO_FACEBOOK_ANNOUNCEMENT_URL`. It was independent of Announcement Management and could not associate a source post with a particular notice.

Announcement Management now provides an optional Official Facebook post field. The URL is saved with the announcement and returned through the existing audience-aware announcement API. When that announcement is the scholar's latest visible notice, its card opens the official post in a new tab. Announcements without a Facebook URL retain the existing requirements action. The obsolete static environment variable and duplicate standalone card were removed.

## Affected users and workflows

- **Authorized announcement administrators:** paste and review the exact Facebook post link before publishing or scheduling a notice.
- **Scholars:** open the official source directly from the matching portal announcement.
- **Applicants:** announcement selection and content remain unchanged; this new call-to-action is limited to the Scholar Portal.

## Implementation and data flow

The announcement editor sends `externalUrl` with the existing payload. Backend middleware and controller normalization independently require HTTPS and an exact supported Facebook hostname, remove URL fragments, and reject deceptive look-alike domains. Prisma stores the normalized value in nullable `announcements.external_url`. Serialization returns it as `externalUrl`; the Scholar Portal renders it with a new-tab link protected by `noopener noreferrer`.

## Files and system areas changed

- Announcement Prisma schemas and additive migration
- Announcement controller, validator, URL normalization service, and tests
- Announcement Management editor and preview
- Scholar Portal announcement action and administration styling
- Frontend environment example and project change documentation

## Impact

- **API:** announcement request and response objects gained the optional `externalUrl` field; existing consumers and records remain compatible.
- **Database:** additive nullable `VARCHAR(2048)` column only; no existing rows are rewritten or deleted.
- **Configuration:** removed obsolete `VITE_CAO_FACEBOOK_ANNOUNCEMENT_URL`; no Facebook token or API credential is required.
- **Security:** server validation permits HTTPS links only on exact Facebook hosts and rejects credentials, non-HTTPS URLs, malformed values, and look-alike domains. Existing authentication, role, section-access, and rate-limit controls remain.
- **Privacy:** no Facebook account data, tracking token, applicant information, or scholar information is sent to Facebook until a scholar deliberately opens the external link.
- **Accessibility:** the optional field has a visible label and helper text; the scholar action has descriptive link text and keyboard-native behavior.
- **Deployment:** local source and local database only; Hostinger and production were not changed.
- **Approved scope:** no Billing, Payroll, fund-release, payment-claiming, reconciliation, or monetary-audit behavior changed.

## Validation performed

- URL unit coverage verifies supported Facebook hosts, fragment removal, optional empty values, HTTPS enforcement, and rejection of deceptive domains.
- Prisma Client generation and the additive local migration completed successfully.
- Full backend tests, frontend ESLint, Vite production build, and Git whitespace validation passed.

## Known limitations, rollback, and recommended next work

The system does not automatically read or mirror Facebook posts because CAO Page/API access is unavailable. Administrators must enter the title, message, optional image, and exact official URL manually. Facebook may require visitors to sign in when opening a post. Rollback removes the UI/action and application use of `external_url`; leaving the nullable database column in place is harmless, while dropping it would discard saved links. Browser-test create, edit, schedule, publish, expiration, and Scholar Portal opening before any deployment.

# 2026-09-12 - Local Public-scholar fixture for Payroll Excel testing

## TL;DR

- Added one clearly labelled local-only Public scholar ready for direct Payroll-list generation.
- The fixture amount is exactly PHP 3,000 and includes the school, municipality, control number, and period data needed for workbook verification.
- Corrected and removed the obsolete pending Private-to-Payroll test state; the fixture login remains disabled and cloud/production execution is blocked.
- Local state verification, backend syntax/tests, frontend lint/build, and Git whitespace checks passed; no deployment occurred.

## Objective and reason

Provide a safe record for testing the automatic official-payroll `.xlsx` download without selecting an operational scholar, while following the authoritative rule that only Public-school scholars enter Payroll.

## Previous and new behavior

The first local fixture incorrectly represented a Private scholar as already billed and waiting for Payroll. It has been corrected in place to `PAYROLL TEST, EXCEL, PUBLIC`, control number `PGC-TEST-XLSX`, in the current primary period. Its obsolete dummy Billing claim and Billing batch were removed, its amount is PHP 3,000, and it now waits directly in the Public Payroll queue.

## Affected users and workflows

- **Local Super Administrators and Billing/Payroll staff:** can select the labelled Public fixture in Payroll and generate one official test list.
- **Applicants and scholars:** no operational account or portal workflow is affected; the fixture account cannot sign in.

## Implementation and data flow

The guarded seed resolves the active period, upserts a test-only Public school, applicant, disabled control account, application, active scholar record, and approved applicable requirement snapshot. It deliberately creates no Billing claim: Payroll generation creates the official Payroll batch and listed claim. If the test scholar has already been included in a generated list, the seed refuses to reset it.

## Files and system areas changed

- `backend/scripts/seed-local-payroll-fixture.js`
- `backend/package.json`
- Local application database test records
- Project change documentation

## Impact

- **API:** no endpoint or contract change from the fixture itself.
- **Database:** corrected explicitly labelled test records only in the local `_v2` database; removed only the fixture's obsolete pending Billing claim and its empty test batch. No operational row was changed.
- **Configuration:** the local command remains `npm run seed:local-payroll-test`; no secret or environment variable was added.
- **Security/privacy:** execution is rejected for cloud/production targets; all identity and address values are conspicuous fictitious test data and the login is disabled.
- **Accessibility:** no interface structure changed; the name and control number make the fixture searchable.
- **Deployment:** no Hostinger, managed database, or production deployment occurred.
- **Approved scope:** the fixture stops at official payroll-list generation and does not model release, claiming, disbursement, reconciliation, or monetary audit.

## Validation performed

- Seed syntax and local execution passed.
- Database verification confirmed `public` classification, PHP 3,000, no Billing reference, and zero current-period Payroll records before testing.
- The full 97-test backend suite, frontend ESLint, and Vite production build passed.

## Known limitations, rollback, and recommended next work

The fixture supports one Payroll generation in the selected period and intentionally refuses to erase generated-list history. For another test, use a newly active period or a separately labelled fixture. Rollback removes the local-only fixture in dependency-safe order. Verify the success/error notice before attempting another generation if the browser download is interrupted.

# 2026-09-12 - Restored school-classification Billing and Payroll routing

## TL;DR

- Private-school scholars now remain exclusively in Billing for the PHP 5,000 tuition certification list.
- Public-school scholars bypass Billing and enter Payroll directly for the PHP 3,000 official payroll list.
- Both server mutations independently reject the wrong school classification; interface lists, statuses, metrics, guidance, and exports follow the same routing.
- Passed 97 backend tests, frontend ESLint, production build, local fixture verification, and API/database health checks; nothing was deployed.

## Objective and reason

Restore the CAO-approved classification workflow after the shared Billing-to-Payroll path incorrectly routed both school types through Billing. Private grants support tuition through the school and belong in the certification-list workflow; Public grants belong in the official scholar Payroll list.

## Previous and new behavior

Previously, all scholars entered Billing and only billed records appeared in Payroll. That incorrectly permitted Private scholars to progress to Payroll and required Public scholars to pass through Billing.

Billing now displays and processes only Private scholars, fixes their amount at PHP 5,000, and generates a tuition certification-list record. Payroll displays and processes only Public scholars, requires no Billing prerequisite, fixes their amount at PHP 3,000, and generates the official `.xlsx` payroll list. Private records cannot be submitted to Payroll, and Public records cannot be submitted to Billing even through a crafted API request.

## Affected users and workflows

- **Billing staff:** review and list eligible Private scholars for tuition certification only.
- **Payroll staff:** generate official payroll lists directly for eligible Public scholars.
- **Private scholars:** remain outside the Payroll queue.
- **Public scholars:** bypass Billing and appear directly in Payroll when their applicable requirements are approved.

## Implementation and data flow

School Catalog classification resolves each scholar's authoritative route. The management API returns `processRoute` from that classification rather than deriving it from prior processing state. Billing validates Private classification, applicable documents, active status, and duplicate prevention before creating a PHP 5,000 certification batch record. Payroll validates Public classification, applicable non-tuition documents, active status, and current-period uniqueness before atomically creating a PHP 3,000 official list and claim records. The frontend independently filters and queues records by `processRoute`; exported workbooks use the server-resolved amounts.

## Files and system areas changed

- `backend/controllers/applicationController.js`
- `backend/services/billingGrant.js`
- `backend/middleware/activityAudit.js`
- Related backend grant and activity-log tests
- `frontend/src/BillingPayrollManagement.jsx`
- Local Payroll test fixture and project change documentation

## Impact

- **API:** `POST /billing/process` now rejects Public scholars and `POST /payroll/process` now rejects Private scholars or duplicate current-period records. Scholar management route/status fields again reflect classification.
- **Database:** no schema migration. New list records retain existing tables but are classification-scoped. Only the known local dummy fixture was corrected; no operational data was migrated or deleted.
- **Configuration:** no new setting or secret.
- **Security:** server-side classification checks prevent client filtering from being bypassed; existing authentication, role, section access, rate limits, and atomic duplicate controls remain.
- **Privacy:** no additional personal information is collected or exposed.
- **Accessibility:** queue status text distinguishes `Ready for certification` from `Ready for payroll`, and controls retain native keyboard behavior and descriptive labels.
- **Deployment:** local source/database only; Hostinger and production remain untouched.
- **Approved scope:** both processes end at generating their official lists. Legacy release, paid, claim, and payout-completion code remains retained for compatibility but is outside the active workflow and was not expanded or redefined as fund release.

## Validation performed

- Updated amount tests prove Private always resolves to PHP 5,000 and Public always resolves to PHP 3,000.
- Updated activity-log coverage describes Public Payroll-list generation without asserting payment completion.
- Passed all 97 backend tests and controller/seed syntax checks.
- Passed frontend ESLint and the Vite production build with 494 transformed modules.
- Verified the local Public fixture has PHP 3,000, no Billing reference, and no generated Payroll record before manual testing.

## Known limitations, rollback, and recommended next work

Historical list records are preserved and may reflect the earlier workflow; this change does not silently rewrite real history. Legacy payment/release endpoints and fields remain in the codebase for compatibility but are not part of the approved active process and should be separately disabled or removed under a reviewed migration. Rollback would restore the shared route, which is not recommended because it conflicts with the clarified policy. Browser-test one eligible Private scholar in Billing and the Public `PGC-TEST-XLSX` fixture in Payroll before deployment.

# 2026-09-12 - Ten local Private and Public workflow fixtures

## TL;DR

- Added five Private-school Billing fixtures and five Public-school Payroll fixtures to the active local academic period.
- Every fixture is fully eligible, unprocessed, assigned the correct fixed amount, and uses a disabled login with fictitious data.
- The repeatable seed refuses cloud/production targets and refuses to reset a fixture already included in a generated list.
- Controller verification, all 97 backend tests, frontend ESLint, and the production build passed; nothing was deployed.

## Objective and reason

Provide enough fresh local-only records to test both approved school-classification workflows without reusing a scholar that has already entered a generated list. Private fixtures test tuition certification-list generation, while Public fixtures test official Payroll-list generation and automatic workbook download.

## Previous and new behavior

Previously, local testing had one corrected Public fixture, which could be consumed by a single Payroll generation. The seed now creates ten deterministic test scholars: `PGC-BILL-001` through `PGC-BILL-005` are Private and route only to Billing at PHP 5,000; `PGC-PAY-001` through `PGC-PAY-005` are Public and route only to Payroll at PHP 3,000. No claim or batch is pre-created, so all ten begin available for their respective queues.

## Affected users and workflows

- **Local Billing staff:** can test Private scholar selection and certification-list generation with five independent records.
- **Local Payroll staff:** can test Public scholar selection, official list generation, and `.xlsx` download with five independent records.
- **Applicants and scholars:** no real account is affected; fixture portal logins are disabled.

## Implementation and data flow

The guarded seed resolves the active academic period, upserts one labelled Private test school and one labelled Public test school, then upserts fictitious applicant, disabled control-account, application, active scholar, and approved applicable-document records. Private records include the tuition receipt required by their route; Public records deliberately omit it because it is not applicable. Before updating an existing deterministic fixture, the seed checks for a current-period generated-list claim and stops rather than deleting history.

## Files and system areas changed

- `backend/scripts/seed-local-payroll-fixture.js`
- Local application database test records
- Project change documentation

## Impact

- **API:** no endpoint or response contract changed.
- **Database:** ten explicitly labelled local dummy records and two local test schools were upserted; no schema changed and no claim or batch was generated.
- **Configuration:** the existing command remains `npm run seed:local-payroll-test`; no environment variable or secret was added.
- **Security:** production and cloud execution are rejected, fixture login accounts are disabled, and generated-list history is not reset.
- **Privacy:** all names, addresses, email addresses, and document markers are fictitious test data; no real personal data is used.
- **Accessibility:** no interface structure changed; deterministic control numbers make the test records searchable.
- **Deployment:** local source and local database only; Hostinger and production were not touched.
- **Approved scope:** fixtures support only Billing certification-list and official Payroll-list generation. They do not model fund release, claims, disbursement, reconciliation, or monetary auditing.

## Validation performed

- Script syntax and local seed execution passed for all ten records in school year 2026-2027, 1st Semester.
- Management-controller verification returned ten records with no eligibility blockers: five `Private / billing / PHP 5,000` and five `Public / payroll / PHP 3,000`.
- All records reported `billed: false` and `inPayroll: false` before manual testing.
- All 97 backend tests passed.
- Frontend ESLint and Vite production build passed with 494 transformed modules; the existing large ExcelJS chunk warning remains non-blocking.

## Known limitations, rollback, and recommended next work

The seed intentionally refuses to recycle a fixture after official-list generation in the active period. Use remaining fixture controls or activate a new test period rather than erasing list history. Rollback may delete only these deterministic local records in dependency-safe order; it must not target operational data. Manually test one Private and one Public record first, confirm the success or error message before retrying, and preserve unused records for later cases.

# 2026-09-12 - Private certification-list Excel download

## TL;DR

- `Generate certification list` now downloads the generated Private-scholar list as an `.xlsx` workbook after the server succeeds.
- The workbook includes its batch and academic period, Private scholar details, fixed PHP 5,000 grant amounts, signature space, and total.
- Preserved the five dummy records already included in a certification list and added five fresh Private records, `PGC-BILL-006` through `PGC-BILL-010`, for retesting.
- Frontend ESLint/build, fixture syntax/execution, and management-controller readiness verification passed; nothing was deployed.

## Objective and reason

Correct the Billing action that generated the server-side certification batch but did not download a file. The parallel Payroll action already produced an Excel workbook, so Billing staff reasonably expected the certification action to do likewise.

## Previous and new behavior

Previously, the Private certification request succeeded and marked selected records as listed, but only the Payroll branch called the Excel download helper. The Billing branch now creates and downloads a dedicated tuition certification workbook immediately after a successful response. Download failure is reported separately without falsely implying that the database operation failed.

The first five Private fixtures were already processed during discovery and remain immutable history. Five new unprocessed Private fixtures were added for the corrected download test. Repeat seeding skips fixtures with generated-list claims and never erases or recreates their processing history.

## Affected users and workflows

- **Billing staff:** receive the official working `.xlsx` file immediately after generating a Private-scholar certification list.
- **Local testers:** can use `PGC-BILL-006` through `PGC-BILL-010` without altering the first generated test batch.
- **Public Payroll staff:** retain the existing automatic Payroll workbook behavior.

## Implementation and data flow

After the authenticated Billing API atomically creates its certification batch, the frontend builds an ExcelJS workbook from the exact records submitted and the batch/period returned by the server. It then triggers a browser download whose filename contains the batch reference. The object URL is revoked after a short delay to avoid prematurely invalidating the browser download. Database processing remains server-authoritative and occurs only once.

## Files and system areas changed

- `frontend/src/BillingPayrollManagement.jsx`
- `backend/scripts/seed-local-payroll-fixture.js`
- Local application database dummy records
- Project change documentation

## Impact

- **API:** no endpoint or contract change.
- **Database:** five additional clearly labelled local Private dummy records were added; previously generated test claims were preserved. No schema changed.
- **Configuration:** no new environment variable or secret.
- **Security:** existing authentication, section permissions, server validation, duplicate protection, and cloud/production seed guard remain. Spreadsheet values come from authorized management data.
- **Privacy:** no new information is collected; the replacement records are fictitious and have disabled logins.
- **Accessibility:** the existing button and visible success/error notice remain keyboard accessible; no new interactive control was introduced.
- **Deployment:** local source/database only; Hostinger and production were not changed.
- **Approved scope:** this generates a certification list only and does not represent tuition payment, release, disbursement, reconciliation, or monetary auditing.

## Validation performed

- Frontend ESLint passed.
- Vite production build passed with 494 transformed modules; the existing lazy ExcelJS chunk-size warning remains non-blocking.
- Fixture script syntax and execution passed; generated test records were skipped rather than reset.
- Controller verification confirmed `PGC-BILL-006` through `PGC-BILL-010` are Private, routed to Billing, fully eligible, unprocessed, and fixed at PHP 5,000.

## Known limitations, rollback, and recommended next work

If a browser blocks or interrupts the download after the API succeeds, the batch still exists and must not be regenerated with the same scholars. The current workspace does not yet expose historical certification-batch re-download; that would require a separately reviewed read-only history feature. Rollback can remove the workbook helper while preserving generated database history, although that would restore the original defect. Retest with one fresh fixture before selecting all five.

# 2026-09-12 - Billing Reference quick filter

## TL;DR

- Added a dedicated Billing Reference selector to the Billing and Payroll quick-filter panel.
- Staff can select all references, no reference, or an exact generated certification-list reference.
- Exact-reference selection automatically narrows the status to Billed, and Billing Reference is now available in custom CSV exports.
- Frontend ESLint and the production build passed; no backend, database, or deployment change occurred.

## Objective and reason

Allow staff to find every scholar belonging to a specific Private-school certification batch without manually searching individual control numbers or names.

## Previous and new behavior

Previously, the quick filters exposed only a legacy Pay Reference selector, even though Billing records have their own generated Billing reference. The panel now includes a separate Billing Reference selector populated from authorized scholar-management records. It supports `All Billing References`, `No billing reference`, and exact reference values. Selecting an exact value also selects `Billed` to avoid contradictory filters; Clear filters restores the workspace default.

## Affected users and workflows

- **Billing staff and authorized administrators:** can isolate a generated Private certification batch by its Billing reference.
- **Payroll staff:** retain their existing filters; the shared workspace also exposes the additive reference selector.
- **Applicants and scholars:** no portal behavior changes.

## Implementation and data flow

The frontend derives a unique sorted reference list from the existing `billingReference` field returned by Scholar Management, applies the chosen value during in-memory filtering, and includes that field among optional CSV columns. No additional request or persistence occurs.

## Files and system areas changed

- `frontend/src/BillingPayrollManagement.jsx`
- Project change documentation

## Impact

- **API:** none; the existing `billingReference` response field is reused.
- **Database:** none.
- **Configuration:** none.
- **Security/privacy:** no new data is exposed and existing authenticated management access remains authoritative.
- **Accessibility:** the filter uses a labelled native select and remains keyboard operable.
- **Deployment:** local source only; nothing was deployed.
- **Approved scope:** this is list discovery only and does not represent payment release, claiming, reconciliation, or monetary auditing.

## Validation performed

- Frontend ESLint passed.
- Vite production build passed with 494 transformed modules; the existing ExcelJS chunk-size warning remains non-blocking.

## Known limitations, rollback, and recommended next work

The options reflect references present in the currently loaded authorized records and selected processing-period dataset. Removing the selector and its in-memory predicate cleanly rolls back the change without affecting stored records. Browser-test exact-reference and no-reference selection after the next certification-list generation.

# 2026-09-12 - Payroll Reference filter correction

## TL;DR

- Fixed generated Payroll references showing an empty scholar list.
- Exact Payroll Reference selection now removes conflicting Billing and legacy payment-status filters.
- Renamed the filter and options consistently to Payroll Reference.
- Frontend ESLint/build passed; no API, database, or deployment change occurred.

## Objective and reason

Ensure a generated Payroll-list reference displays the scholars belonging to that list. The old selector silently required Billed and Paid states, although Public scholars bypass Billing and official-list generation does not mean payment.

## Previous and new behavior

Previously, selecting a valid `PAYROLL-*` reference could produce zero results because contradictory filters were applied. Exact reference selection now makes the Billing and legacy payment-status filters unrestricted, then filters by the selected Payroll reference itself.

## Affected users and workflows

Authorized Payroll staff can locate generated official-list members by reference. Billing, applicant, and scholar workflows are unchanged.

## Implementation and data flow

This is an in-memory frontend filter correction using the existing authorized `payReference` value. It does not create, delete, or reinterpret list records.

## Files and system areas changed

- `frontend/src/BillingPayrollManagement.jsx`
- Project change documentation

## Impact

- **API, database, and configuration:** no impact.
- **Security/privacy:** existing authenticated data and permissions are unchanged.
- **Accessibility:** the labelled native selector remains keyboard operable and now uses accurate terminology.
- **Deployment:** local source only; nothing was deployed.
- **Approved scope:** Payroll Reference identifies official list generation, not fund release, payment, reconciliation, or monetary audit.

## Validation performed

Frontend ESLint and the Vite production build passed with 494 transformed modules. The existing ExcelJS chunk-size warning remains non-blocking.

## Known limitations, rollback, and recommended next work

The selector lists references contained in the currently loaded authorized records. Rolling back restores the contradictory-filter defect. Manually select the displayed `PAYROLL-*` reference and confirm its scholars now appear.

# 2026-09-12 - Quick-filter layout alignment

## TL;DR

- Placed Billed and Paid status selectors side by side so the three quick-filter columns have a balanced vertical orientation.
- Billing and Payroll reference selectors retain full-width rows for readable batch values.
- Frontend ESLint/build passed; behavior and stored data are unchanged.

## Objective and reason

Correct the uneven Quick Filters card after adding Billing Reference. The middle group had four full-width rows while the adjacent groups had three, creating an unnecessarily tall and visually unbalanced panel.

## Previous and new behavior

Billed and Paid previously occupied separate full-width rows. They now share one responsive two-column row, followed by full-width Billing Reference and Payroll Reference selectors.

## Affected users and workflows

Authorized Billing and Payroll users receive a more compact, aligned filter panel. Filter values and results are unchanged.

## Implementation and data flow

The two status labels are grouped in a CSS grid row. No data flow changed.

## Files and system areas changed

- `frontend/src/BillingPayrollManagement.jsx`
- `frontend/src/styles/admin.css`
- Detailed development documentation

## Impact

- **API, database, configuration, security, and privacy:** no impact.
- **Accessibility:** native labelled selectors and keyboard behavior are preserved.
- **Deployment:** local source only; nothing was deployed.
- **Approved scope:** no financial workflow behavior changed.

## Validation performed

Frontend ESLint and the Vite production build passed with 494 transformed modules. The existing ExcelJS chunk-size warning remains non-blocking.

## Known limitations, rollback, and recommended next work

Very narrow displays continue to use the existing stacked filter-group layout. Removing the wrapper and its grid rule restores the previous orientation. Visually verify the card at desktop and mobile widths.

# 2026-09-12 - Examination Attendance modal clipping fix

## TL;DR

- Fixed applicant attendance rows being cut off by the bottom edge of the Examination Management modal.
- The modal now uses a bounded column layout with an independently scrolling applicant list.
- Removed accidental responsive padding from the modal container while preserving its intended inner spacing.
- Frontend ESLint/build passed; application behavior and data are unchanged.

## Objective and reason

Keep the attendance selector and applicant row fully visible when the modal content exceeds the available viewport height.

## Previous and new behavior

The modal hid overflow while its applicant list used a separate fixed maximum height, allowing their combined height to exceed the modal and clip the last visible row. The modal is now a flex column, and the list consumes only remaining space and scrolls internally.

## Affected users and workflows

Examination administrators can view and operate every Pending/Present selector without content being covered. Attendance rules and persistence are unchanged.

## Implementation and data flow

CSS now gives the modal a vertical flex layout, gives its list `min-height: 0` and flexible remaining height, and retains vertical overflow on the list. A mobile rule no longer applies container padding that conflicted with child spacing.

## Files and system areas changed

- `frontend/src/styles/admin.css`
- `frontend/src/styles/admin-responsive.css`
- Detailed development documentation

## Impact

- **API, database, configuration, security, and privacy:** no impact.
- **Accessibility:** attendance controls remain visible and keyboard operable within a predictable scroll region.
- **Deployment:** local source only; nothing was deployed.
- **Approved scope:** no examination or financial workflow logic changed.

## Validation performed

Frontend ESLint and the Vite production build passed with 494 transformed modules. The existing ExcelJS chunk-size warning remains non-blocking.

## Known limitations, rollback, and recommended next work

The list still depends on the viewport height and scrolls when necessary, by design. Reverting the flex and list sizing rules restores the clipping defect. Visually verify the first and last attendance rows at desktop and narrow viewport heights.

# 2026-09-12 - Deployment-aware Hostinger backend build

## TL;DR

- Made the standard backend `npm run build` safe for Hostinger's configured build command.
- Production/cloud builds now generate Prisma Client and apply committed migrations before the server starts.
- Local builds generate the client but explicitly skip production migration deployment.
- Local build verification passed without contacting or changing the managed database.

## Objective and reason

Prevent deployment of application code that expects the new examination-control and announcement external-link columns before those additive migrations exist in the hosted database. Hostinger is configured to invoke the standard backend build script rather than the Render-specific build alias.

## Previous and new behavior

Previously, `npm run build` generated Prisma Client only, so a successful Hostinger build could still start against an outdated schema. The build now detects `NODE_ENV=production` or `DATABASE_TARGET=cloud`, then invokes the guarded committed-migration runner. Development builds remain unable to accidentally deploy production migrations.

## Affected users and workflows

- **Deployment operators:** receive a fail-fast build if hosted migrations cannot be applied.
- **Administrators, applicants, and scholars:** avoid runtime failures caused by application/schema mismatch.
- **Local developers:** retain normal Prisma generation without managed-database mutation.

## Implementation and data flow

The new build orchestrator resolves the installed Prisma CLI, generates the application client, inspects deployment-target environment variables, and conditionally executes the existing migration runner. The runner uses `DIRECT_URL` when available and otherwise `DATABASE_URL`, and Prisma applies only unapplied committed migrations transactionally according to its migration ledger.

## Files and system areas changed

- `backend/package.json`
- `backend/scripts/build.js`
- Existing migration runner and committed migrations are reused
- Project change documentation

## Impact

- **API:** no endpoint or response-contract change.
- **Database:** hosted deployments may apply only the two committed additive migrations; local verification applied none. Existing rows are preserved and receive safe defaults where required.
- **Configuration:** Hostinger must provide `DATABASE_URL` and production targeting through `NODE_ENV=production` or `DATABASE_TARGET=cloud`; `DIRECT_URL` remains preferred but the guarded runner can use `DATABASE_URL`.
- **Security:** database credentials remain server-side, are not logged, and migration failure prevents startup with a mismatched schema.
- **Privacy:** no personal information is added to build output or configuration.
- **Accessibility:** no interface impact.
- **Deployment:** standard Hostinger backend builds now include migration deployment; Render retains its existing explicit build sequence.
- **Approved scope:** no Billing/Payroll business workflow is extended beyond official list generation.

## Validation performed

Local `npm run build` generated Prisma Client 6.19.3 successfully and reported that production migration deployment was skipped. The build script contains no managed credentials and did not contact the hosted database.

## Known limitations, rollback, and recommended next work

The hosted database account must have permission to apply the committed additive migrations. A failure intentionally blocks deployment rather than starting incompatible code. Rollback restores the former generate-only build, but doing so requires migrations to be applied manually before application startup. Verify the hosted health endpoint and the two new settings after deployment.

# 2026-09-12 - Hostinger backend validation-data startup hotfix

## TL;DR

- Diagnosed the post-deployment API 503 as a missing `../../municipality.json` runtime import.
- Added municipality and barangay validation datasets inside the independently packaged `backend` deployment root.
- Updated backend runtime and test imports while retaining the root datasets required by the separate frontend build.
- Production migrations had already succeeded and were not rolled back; no hosted application records were deleted or reset.

## Objective and reason

Restore the Hostinger API after the backend build and additive migrations succeeded but application startup repeatedly failed. Hostinger packages the configured `backend` root into its Node runtime, so files located above that root are unavailable even when they exist in the repository.

## Previous and new behavior

The new strict address validator loaded municipality and barangay datasets from the repository root using `../../`. This worked in the full local checkout but failed in Hostinger's isolated backend artifact. Equivalent deployable datasets now live in `backend/data`, and backend code imports only from within its deployment boundary.

## Affected users and workflows

- **All hosted users:** API availability is restored once the hotfix is redeployed.
- **Applicants:** strict municipality/barangay validation retains the same accepted values.
- **Local developers:** frontend and backend builds continue using their respective packaged dataset copies.

## Implementation and data flow

The JSON datasets are static non-secret reference data. Middleware loads them from `backend/data` at process startup and uses them for the same municipality/barangay membership checks. No request, response, or persistence logic changed.

## Files and system areas changed

- `backend/data/municipality.json`
- `backend/data/brgy.json`
- `backend/middleware/validators.js`
- `backend/tests/applicationGuardian.test.js`
- Project change documentation

## Impact

- **API:** restores startup; endpoint contracts are unchanged.
- **Database:** no new migration or record change. The previously deployed additive examination and announcement migrations remain applied.
- **Configuration:** no environment-variable change.
- **Security/privacy:** datasets contain public geographic reference names only; no credentials or personal information.
- **Accessibility:** no interface impact.
- **Deployment:** requires one backend redeployment after the hotfix push; the already deployed frontend need not be rebuilt for this fix.
- **Approved scope:** no Billing/Payroll workflow extension.

## Validation performed

The Hostinger runtime log consistently identified the missing parent-directory module as the startup blocker. Local validation must confirm middleware import, backend tests/build, and then the public health endpoint after redeployment.

## Known limitations, rollback, and recommended next work

The frontend and backend now contain separate copies of the same static datasets because they are deployed from independent roots; future geographic-data updates must keep them synchronized. Removing the backend copies restores the Hostinger startup failure. After pushing, redeploy only `api.cnpgceap-sms.com` and verify `/api/health` before further changes.

# 2026-09-12 - Controlled Hostinger release completion

## TL;DR

- Deployed the tested feature release to the Hostinger frontend and backend applications.
- Applied the two additive production migrations successfully; the follow-up backend build found all 18 migrations recorded and none pending.
- Resolved the temporary API 503 with the packaged validation-data hotfix and verified public health as `healthy` with `database: connected`.
- Preserved hosted records and generated-list history; no destructive migration, reset, or rollback occurred.

## Objective and reason

Promote the locally verified application, examination, scholar, Billing, Payroll, announcement, and interface improvements while preserving the existing Hostinger installation and managed PostgreSQL data.

## Previous and new behavior

Hostinger initially continued serving the previous frontend until manual redeployment. The frontend then published the new hashed bundle. The first backend release built and migrated correctly but returned 503 because runtime validation datasets were outside its isolated deployment root. Hotfix `e84cf30` packaged those datasets inside the backend, after which the service started normally.

## Affected users and workflows

All hosted roles now receive the released behavior documented in this change set. The temporary backend interruption ended after the hotfix; existing accounts, applications, examination records, scholar records, and generated lists were retained.

## Implementation and data flow

Git commit `011b8fa` delivered the feature release and deployment-aware migration build. Commit `e84cf30` corrected the isolated backend runtime path. Hostinger built each configured project independently; the backend applied committed Prisma migrations before startup and connected to the existing managed database.

## Files and system areas changed

- GitHub `main` release commits `011b8fa` and `e84cf30`
- Hostinger frontend `cnpgceap-sms.com`
- Hostinger backend `api.cnpgceap-sms.com`
- Managed PostgreSQL migration ledger and two additive columns
- Project change documentation

## Impact

- **API:** released the documented additive behavior and restored healthy production availability.
- **Database:** added examination activation/delivery fields and optional announcement external URL; all 18 migrations are applied. No table or operational row was deleted.
- **Configuration:** existing Hostinger roots, entry files, environment variables, and domains were retained.
- **Security:** server-side validation, authorization, attendance gating, URL allow-listing, and classification enforcement are active; no secret was committed or logged.
- **Privacy:** no hosted personal data was copied into source control or deployment documentation.
- **Accessibility:** released labelled controls, modal feedback, responsive layouts, and clipping corrections described in the preceding entries.
- **Deployment:** frontend and backend deployments completed; the API startup hotfix required one backend-only redeployment.
- **Approved scope:** Billing and Payroll continue to end at certification-list and official payroll-list generation, without fund-release, claiming, disbursement, reconciliation, or monetary-audit functionality.

## Validation performed

- Pre-deployment: 97 backend tests, backend Prisma build, schema audit with zero logical orphans/duplicate candidates, frontend ESLint/build, Git whitespace check, and staged secret scan passed.
- Production database: the two new migrations applied successfully; the hotfix build subsequently reported 18 migrations and no pending work.
- Production frontend: HTTP 200 and new asset `assets/index-9w2jwiCi.js` confirmed.
- Production backend: `/api/health` reported `status: healthy`, `database: connected`, and 119.3 ms database latency at verification time.

## Known limitations, rollback, and recommended next work

Hostinger auto-deployment was not active, so both initial releases required manual redeployment. The PostgreSQL driver emitted a future SSL-mode compatibility warning; current certificate verification remains the stronger behavior, and dependency upgrades should be handled separately rather than during this release. Keep the frontend/backend geographic datasets synchronized, enable reviewed auto-deployment only if desired, and perform a short authenticated production smoke test of login, settings, examination attendance, announcements, Billing certification export, and Payroll export.
