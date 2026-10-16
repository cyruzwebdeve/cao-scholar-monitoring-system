# Private grant preparation — verification checklist

Use test Scholars and an active academic period. Backend and frontend must use this release; backend must apply `20261016020000_private_grant_preparation` and regenerate Prisma.

1. Open Billing for a **subsequent regular Private** Scholar, or Payroll for an **initial/authorized late Private** Scholar. Select the processing academic period. Public Scholars continue their existing flow without this Private preparation requirement.
2. An unprepared Private row shows **Grant preparation required** and **Create grant record**. It cannot move into the generation queue yet.
3. Click **Create grant record**. Check the Scholar identity, school year and semester. Total Grant must be read-only PHP 5,000.00; Tuition Fee Assistance starts blank; Allowance is read-only and blank until a valid amount is entered.
4. Click **View tuition receipt**. This opens the current-period receipt using your authorized session. A later continuing period must not silently display an earlier initial receipt. If none exists, show an error; do not fabricate a receipt amount. No OCR or automatic extraction is used.
5. Enter 3,500 → Allowance must become 1,500. Test 0 → 5,000; 5,000 → 0. Values below 0, above 5,000, blank, or more than two decimal places must not save. If the receipt exceeds the grant, manually enter only the eligible assistance up to 5,000; the system does not automatically clamp an oversized value.
6. **Save as Prepared**. Reload: the saved tuition/allowance and Prepared state must remain for that academic period. No official list or reference should be created by saving alone.
7. Open **Edit grant** and verify the saved value. Before listing, save an allowed correction. An older tab trying to overwrite a changed preparation should receive a refresh message. A different academic period must have its own preparation.
8. Use **Grant preparation → Prepared**, plus school/academic-period/search filters, to retrieve the record. Queue the prepared Scholar. Existing incomplete continuing-document warnings must not become a new document blocker.
9. Generate the certification list (Billing) or payroll list (Payroll). The generated workbook must contain Total Grant, Tuition Fee Assistance, Allowance and the batch reference. All members share that generated list's reference: BILL-… for certification, PAYROLL-… for Payroll. No per-Scholar reference is entered manually.
10. Select **Grant preparation → Listed**. Listed rows must be visible even with the normal unlisted default filters. Confirm no Edit grant action is offered, and a direct preparation update is rejected. Verify the saved amounts in the workbook and CSV export.
11. Reload and, for Billing, download the historical workbook again. It must retain the generated breakdown, including explicit zero amounts. Generation uses fresh server snapshots rather than stale queued values. Old generated records with no historical breakdown show blanks/“Breakdown not recorded”; they are not backfilled with invented amounts.
12. Check a Public Scholar: existing PHP 3,000 processing remains available. Check Private initial/late Payroll visibility and subsequent regular Billing routing. Wrong-section, inactive, duplicate-period and unauthorized requests must remain blocked.

Staff preparation/list records end at official list generation. No payment release, claiming or monetary audit behavior is added.
