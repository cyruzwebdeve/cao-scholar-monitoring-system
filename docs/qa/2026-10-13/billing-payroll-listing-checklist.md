# Billing and Payroll Listing Verification — 2026-10-13

Use synthetic/test scholars in an approved test environment. These changes are not deployed by this task.

1. Open Billing as an authorized staff member. An active Private-school scholar with missing or pending documents should show **Requirements incomplete** and remain selectable. No Override button, dialog, or required reason should appear.
2. Use **Move all** to queue the visible processable scholars, then generate the certification list. Confirm the incomplete-requirements notice and the unchanged PHP 5,000 Private amount.
3. Repeat in Payroll with an active Public-school scholar. Confirm normal/bulk queueing and generation with the unchanged PHP 3,000 amount.
4. Check the requirement review screen: pending/missing documents must retain their original status. Listing must not create approvals.
5. Confirm new list record notes and Activity Logs identify incomplete requirements at generation. Existing historical override reasons and lists must remain available.
6. Verify inactive scholars, unknown school classifications, wrong-route selections, and already-listed scholars cannot be processed. Direct API requests must also reject these cases without creating lists.
7. Change the processing period after queueing: the queue must clear. An inactive period must be rejected by the server.
8. In Billing, open **Edit** and verify the details dialog and fixed Private amount still work. Payroll must not expose this editor.
9. An older client sending nonempty override data should receive refresh guidance, without generating a list.
10. Repeat the normal queue flow on mobile and using keyboard controls. No per-scholar authorization step should be required.

Scope ends with official list generation. This checklist does not test fund release or payment claiming.
