# Batch Scholar Billing - simple testing checklist

Use synthetic Scholars in a test environment. Sign in as staff with Scholars and Billing access. Choose an active Academic Year and Semester containing Private Scholars assigned to Billing. Initial-period and redirected Private Scholars use Payroll.

| Done | Test | Expected result |
| --- | --- | --- |
| [ ] | Open **Scholars → Batch Billing**. | Academic Year, Semester, Scholar selection, tuition amounts, allowances and receipt previews appear. |
| [ ] | Change Academic Year or Semester. | The table loads that period's records; amounts and selections from another period are not submitted. |
| [ ] | Search or filter by School, then select several Scholars. | Matching Scholars appear; selected count updates. Select visible adds eligible rows up to the 100-row limit. |
| [ ] | For two PHP 5,000 grants, enter tuition of PHP 3,500 and PHP 0. | Allowances show PHP 1,500 and PHP 5,000. Configured grant overrides use their own totals. |
| [ ] | Leave tuition blank, or enter a negative amount, more than the total, or more than two decimal places. | Saving is blocked with a row message. Explicit zero is accepted. |
| [ ] | Click **View receipt** for different Scholars. | The authenticated preview opens that Scholar's selected-period receipt. An absent receipt shows an error; another period's receipt is not substituted. |
| [ ] | Click **Save & Add to Billing** with valid rows. | Each grant and its Billing period details are saved. Billing opens with the saved, currently eligible Scholars queued. |
| [ ] | Double-click the save button. | Only one save request starts. |
| [ ] | Make one selected row stale by editing it in another session before saving. | Valid rows save; the stale row keeps its tuition and shows a conflict. Successful rows are deselected and are not submitted on retry. |
| [ ] | After a conflict, click **Refresh records**, review the latest preparation, then **Use saved values** and correct the failed row. | The updated saved timestamp is adopted. Retrying sends only the remaining selected rows. **Open Billing** includes previously saved rows. |
| [ ] | Switch to another Scholars tab while saving, then return. | The other tab remains open. Results stay available in Batch Billing; **Open Billing** can continue with saved rows. |
| [ ] | Interrupt a save or Billing read in browser developer tools. | Inputs remain after an unconfirmed save. Refresh and review saved values before retrying. A failed Billing read retains its handoff for retry; it does not invent queue membership. |
| [ ] | Check listed/inactive Scholars and Private Scholars assigned to Payroll. | Listed/inactive records cannot be selected or overwritten; Payroll-route Scholars do not appear in this batch view. |
| [ ] | Sign in as staff without Billing access, and as an Applicant/Scholar. | The batch action is unavailable; the API rejects unauthorized requests. |
| [ ] | Reload the prepared records and open individual Scholar Certification History. | Preparations persist under the selected period. Individual PDF history is unchanged. Saving grants alone creates no official list/reference or certificate PDF. |
| [ ] | Test keyboard navigation and a narrow mobile viewport. | Controls have labels and visible focus; mobile rows remain readable and actions fit the viewport. |

Automated verification: 35 focused backend tests and 54 focused frontend tests passed. Frontend checks execute real handlers with mocked hooks/API reads and parse JSX; real browser layout, full build/lint and live PostgreSQL concurrency remain unverified.
