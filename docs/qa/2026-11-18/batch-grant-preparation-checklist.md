# Batch Scholar Billing - simple testing checklist

Use synthetic Scholars in a test environment. Sign in as staff with Billing access. Choose an active Academic Year and Semester containing Private Scholars assigned to Billing. Initial-period and redirected Private Scholars use Payroll.

Presentation is incomplete: a tool content filter blocked the batch stylesheet update without a specific reason and prohibited retrying it. The new worklist/receipt layout classes and five-column table still need styling and browser review. The receipt component has its own stylesheet; do not assume the intended side-by-side layout is finished.

| Done | Test | Expected result |
| --- | --- | --- |
| [ ] | Open **Billing → Prepare Scholars**. | The current primary period is selected. Needs preparation is the default worklist; the former Scholars Batch Billing tab is removed. |
| [ ] | Use Needs preparation, Needs attention, Prepared and Locked filters, search and School. | Counts match the current search/School scope. Unavailable records explain their blockers. |
| [ ] | Select several Scholars and enter different tuition amounts. | Each allowance uses its own configured total. Blank tuition is not treated as zero. |
| [ ] | Click **Review receipt** or focus a tuition field; use Previous/Next. | The inline preview follows that Scholar and selected period. Missing receipts show an error and Retry. PDF/image previews and Open original file are available. |
| [ ] | Enter amounts using Tab/Enter and Shift + Tab. | Focus moves between editable visible rows; Enter does not submit the batch. |
| [ ] | Apply one amount to selected rows, then try an amount exceeding one Scholar's total. | The valid bulk amount is applied to all selected drafts. The invalid bulk action changes none of them. **Set selected tuition to zero** is explicit. |
| [ ] | Select one valid row and one blank/invalid row; click **Save ready rows**. | Only the valid row is sent and saved. The other row remains selected with its amount/error in Needs attention. |
| [ ] | Save valid rows or receive partial server success. | Confirmed successes leave the selection and are staged for the Billing queue. Admin stays in preparation; unsuccessful rows retain entered values. |
| [ ] | Save a second batch in the same period, including enough records to exceed 100 accumulated saves. | Each individual save stays within 100; accumulated queue IDs retain all successes without duplicates. |
| [ ] | Review the queue with existing same-period rows. | Fresh eligible saved rows are added alongside the existing queue; newly locked/unavailable rows are skipped with a notice. |
| [ ] | Prepare records for another period while a different-period queue exists. | Saving does not switch the existing queue. **Review Billing queue** explicitly loads the chosen period; queues are scoped to one period. |
| [ ] | Edit a selected preparation in another session before saving. | That row receives a conflict. Refresh preserves the entered draft and original version; Use saved values adopts the latest version before correction/retry. |
| [ ] | Double-click save, switch tabs during a pending save, interrupt a read, or switch staff accounts. | One save starts; hidden completion never navigates. Failed reads retain pending queue work; old account/period/receipt results are ignored. |
| [ ] | Start list generation, an amount edit or routing action while pending preparation results exist. | Pending queue additions wait until the current operation finishes; preparation tab transition is disabled while the queue is busy. |
| [ ] | Return to preparation after generating a list. | Records refresh; listed rows become locked while changed drafts keep their original versions. Saving preparations alone creates no official reference or PDF. |
| [ ] | Sign in without Billing access and check individual Scholar Certification History. | Unauthorized preparation controls remain unavailable. Individual certificate history and existing Applicant/Scholar workflows remain unchanged. |
| [ ] | After the outstanding stylesheet work is resolved, test desktop/mobile layout and keyboard focus. | Receipt and amount entry should be usable together, with readable status/bulk controls and table/card columns. This visual acceptance is still pending. |

Automated verification covers actual handlers/effects with mocked hooks/API reads, queue eligibility and existing individual-certification workflows. See the matching development-log entry for final counts and tooling limitations. No real records were used for implementation testing.
