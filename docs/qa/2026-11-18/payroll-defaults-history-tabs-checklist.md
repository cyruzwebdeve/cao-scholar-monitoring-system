# Payroll defaults and history tabs - simple testing

Use synthetic records in an authorized test environment.

| Done | Test | Expected result |
| --- | --- | --- |
| [ ] | Generate a Payroll Excel list for a Scholar with missing Tuition and Allowance. | Both cells display **0.00**; the recorded Amount remains unchanged. |
| [ ] | Generate or re-download a list containing saved tuition/allowance values. | Existing zero/nonzero breakdowns remain intact. Empty template rows remain blank. |
| [ ] | Open **Payroll → Payroll history**. | Generated lists and Download Excel appear here. Payroll queue filters and transfer controls are hidden. |
| [ ] | Open **Billing → Billing history**. | Generated lists and Download Word appear here. Billing queue filters and transfer controls are hidden. |
| [ ] | Queue Scholars, switch to History, then return to the queue. | The queue, selections and filters remain; changing tabs does not create a new list or discard the workspace. |
| [ ] | Use Prepare Scholars in Billing and Payout schedules in Payroll. | Both remain available in their existing sections. History/preparation/payout switches are disabled during an active queue operation. |
| [ ] | Open History during initial loading or a failed management read. | Loading appears without a premature No history message. Error/Retry and download success/failure notices remain visible. |
| [ ] | Use keyboard Tab/Enter and check a mobile viewport. | Existing tab buttons and history actions remain usable with the established styles. Browser acceptance remains pending. |

Validation: 24 focused default-value, actual JSX/handler, queue-integration and document-flow checks passed, and five changed source/test files parsed. ExcelJS is missing locally, so serialized workbook tests and actual Excel rendering were not run. React/Vite/ESLint are also missing; full build/lint/browser validation remains pending. No live records were changed during implementation testing.
