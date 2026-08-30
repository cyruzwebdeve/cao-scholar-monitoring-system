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
