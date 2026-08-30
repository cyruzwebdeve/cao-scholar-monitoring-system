# Payroll-List Scope Boundary Audit

Date: 2026-08-30

## Approved boundary

The PGCEAP system ends after it generates the official payroll list of
scholars. It may determine list readiness, create list records, display the
generated list, and export it for authorized administrative use.

The system must not release funds, mark scholars as paid, record receipt or
claiming of money, reconcile disbursements, or audit released money.

## Current in-scope endpoint

`POST /api/billing/process` currently validates selected scholars and creates
the payroll batch and scholar list records. This is the closest existing
implementation of the approved terminal event. Its user-facing naming should
ultimately be simplified to payroll-list generation rather than a handoff to
a later payment-processing stage.

## Legacy out-of-scope surfaces found

| Area | Existing behavior | Why it is outside scope | Recommended treatment |
|---|---|---|---|
| `PUT /api/applications/:id/paid` | Marks an individual record paid | Records post-list payment | Remove route and controller export after confirming no client dependency |
| `PUT /api/payroll/billing-batch/:id/release` | Releases a payroll batch and finalizes payouts | Represents fund release | Remove route and controller path |
| `POST /api/payroll/process` | Marks claims paid, creates payment references, notifications, and emails | Performs post-list payment processing | Disable and replace Payroll UI action with list review/export |
| `BillingPayrollManagement.jsx` | Filters Paid/Not paid, accepts payment references, and processes payment completion | Manages payment state after list generation | Convert Payroll mode to generated-list review and CSV export |
| Scholar portal allowance card | Displays amount, claimed date, release status, and payment reference | Exposes post-list payment tracking | Replace with payroll-list inclusion status without payment details |
| Payroll-completed email and notification | Announces processed allowance and payment reference | Communicates post-list disbursement state | Remove or replace with a payroll-list-inclusion notice if CAO requires one |
| Lifecycle reports | Counts paid claims and exposes financial lifecycle summaries | Audits post-list monetary state | Stop the funnel at payroll-list inclusion; retain non-financial operational metrics |
| Dashboard copy and sample metrics | Describes paid counts, releases, and payment progress | Presents out-of-scope functionality as part of the product | Rename to payroll-list readiness, generated lists, and included scholars |
| Database fields | Stores `claimed_date`, `claimed_notes`, released batch state, and notification amounts | Supports legacy payment tracking | Retain temporarily for compatibility; deprecate before a later additive cleanup migration |
| Mailer service | Sends allowance-processed messages with amount and payment reference | Sends post-list payment information | Remove call path and then delete unused template after tests are updated |

## Operational audit distinction

The existing Activity Logs workspace is not automatically out of scope. It is
an operational security and accountability control that records sign-ins and
record changes. It may remain if its reports and descriptions do not claim to
audit released money or financial disbursements.

Database integrity checks, backup verification, and security anomaly review
also remain in scope because they protect the scholarship system rather than
audit the movement of funds.

## Safe cleanup order

1. Rename the terminal action and user interface to “Generate payroll list.”
2. Make the Payroll workspace a read-only list review and export screen.
3. Remove or disable payment-processing controls in the frontend.
4. Remove the three post-list mutation routes after checking all callers.
5. Remove allowance/payment notifications and mail delivery calls.
6. Update reports, dashboards, exports, tests, and documentation.
7. Deprecate legacy payment columns without deleting historical data during
   the first cleanup deployment.
8. Consider a later data-retention migration only after backups and stakeholder
   approval.

## Not changed during this clarification

This clarification did not delete legacy routes, database columns, historical
records, or payment-oriented screens. Only the newly added guidance lifecycle
was corrected immediately. The remaining work is intentionally isolated so
it can be implemented and verified as a dedicated scope-alignment change.
