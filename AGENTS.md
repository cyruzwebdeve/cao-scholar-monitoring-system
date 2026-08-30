# Repository working instructions

## Product scope boundary

The PGCEAP system workflow ends when CAO generates the official payroll list
of scholars. Do not extend the workflow into fund release, payment claiming,
disbursement confirmation, reconciliation, or monetary auditing. Operational
activity logs for system access and record changes remain allowed; they must
not be presented as audits of released money.

When editing older payment-oriented code, treat it as legacy functionality
outside the approved scope and document whether it is retained, disabled, or
removed. Do not silently redefine payroll-list generation as payment release.

## Change documentation

For every material change to application behavior, code, configuration,
database structure, deployment, security controls, or user experience:

1. Add a concise dated summary to `change_log.txt`.
2. Add or update the matching dated entry in
   `docs/development-change-log.md`.
3. Begin every detailed entry with a **TL;DR** of two to five concise bullets
   covering the outcome, affected users, important scope or data impact, and
   verification result.
4. The detailed entry must then describe:
   - the objective and reason for the change;
   - previous and new behavior;
   - affected user roles and workflows;
   - implementation and data flow;
   - files or system areas changed;
   - API, database, configuration, security, privacy, accessibility, and
     deployment impact, explicitly stating when there is no impact;
   - validation performed and its results;
   - known limitations, rollback considerations, and recommended next work.
5. Never include passwords, tokens, private document locations, real personal
   information, or other secrets in change documentation.

Pure formatting, comment-only, or documentation-only corrections may update
only the detailed document when a second summary entry would add no value.
