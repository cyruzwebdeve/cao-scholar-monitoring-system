# Comprehensive Development Change Log

This document is the detailed engineering record for material PGCEAP system
changes. The root `change_log.txt` remains the concise chronological summary.
Entries here explain what changed, why it changed, how it affects the system,
and how the result was verified.

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
