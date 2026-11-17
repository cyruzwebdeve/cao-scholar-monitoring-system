# Scholar Certification History: simple testing checklist

Use synthetic Scholars in a test environment with the new migration applied,
the application Prisma client generated, and matching frontend/backend versions.
Sign in as an administrator with Scholars access. Prepare a Private Scholar,
two configured academic periods, and an existing Billing certification record.

This history records a generated PDF. It does not confirm physical issuance or
payment. Browser-only downloads made before this update cannot be recovered.

| Done | Test | Expected output |
| --- | --- | --- |
| [ ] | Open a Private Scholar and click **Download Certification**. | One individual PDF record is saved before its download starts. It appears in **Certification History** with reference, academic year, semester, school and generation date. |
| [ ] | Open the downloaded PDF. | Correct Scholar, course, year level, school, selected period, reference, Philippine date, header and signatory; text fits the page. Existing certificate wording is retained. |
| [ ] | Click **Download Certification** again without changing details. | The same saved PDF and date download; no additional history entry or generation activity event. |
| [ ] | Reload the page, reopen the Scholar and click **Download PDF** in history. | The original saved PDF downloads. No preparation or save request and no new entry. |
| [ ] | Click **Preview** beside Download PDF. | A modal shows the original saved PDF, with its reference and period in the title. Loading/error feedback and an open-in-new-tab link are available. Preview performs only a saved-file read and creates no history record. |
| [ ] | Close Preview with its close button or Escape, then preview another record. | The modal closes, focus returns to Preview, and the next record shows its own saved PDF. Tab/Shift+Tab stay within the modal controls. |
| [ ] | Switch Scholar/period or leave Certification History during a slow preview; also test an authentication refresh in the shared viewer. | The prior preview closes or hides its old result, the old request is canceled/ignored and its object URL is released. Another record never shows the previous file or error. |
| [ ] | Change the synthetic Scholar's course/year level through the existing workflow, then generate again. | A separate version appears. The earlier PDF still contains its original details and date. |
| [ ] | Select another eligible academic period and generate again. | A separate entry has that period. Both periods remain visible, including an archived period. |
| [ ] | Change the test Scholar to a Public school. | Earlier individual/Billing records remain visible and individual PDFs can be downloaded. New Private certification generation is unavailable. |
| [ ] | Compare history with the existing Billing record. | Distinct **Individual certification PDF** and **Billing certification list** labels; the Billing reference, list amount and processed date remain. Individual generation does not add Billing/Payroll membership or alter Reports amounts. |
| [ ] | Double-click the generation button while requests are slow. | One active flow; only one saved record and one download. Buttons re-enable afterward. |
| [ ] | In test request tooling, fail the save request. | Error shown; no PDF download and no success message. Retry can save normally. |
| [ ] | Allow saving, then fail only the saved-file download request. | **Certification saved; download failed** appears. The history entry remains; **Download PDF** retries the saved artifact. |
| [ ] | Slow the history request, generate a certificate, then let the older history response finish. | The newly saved entry stays visible. The refreshed history includes earlier entries without duplicates. |
| [ ] | Switch Scholar/period, close the drawer or leave the page during a slow operation. | No old PDF automatically downloads and no old success/error appears on another Scholar. A save already accepted by the server remains visible when that Scholar is reopened. |
| [ ] | Fail history loading, then click **Retry history**. | Clear error and retry control; existing rows stay visible during retry. Successful retry loads all saved versions. |
| [ ] | Test desktop/mobile widths and keyboard navigation. | History fields wrap, buttons fit, keyboard focus is visible, status/errors are announced, and Download PDF works. |
| [ ] | Attempt all four APIs as an Applicant, Scholar or staff account without Scholars access; try a different Scholar's file ID in an authorized request. | Unauthorized roles/sections are denied. A mismatched Scholar/file pair returns not found. PDF responses stay private and are not cached. |

Record browser, date, tester and any failed row in the test run. Automated tests
use synthetic data and mocks; actual browser rendering and database migration
acceptance still require this checklist in a test environment.
