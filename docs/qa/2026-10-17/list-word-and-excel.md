# Word list generation and Excel preparation exports — 2026-10-17

Frontend release `6643da7` verified live: entry `/assets/index-sk2wsdmR.js`, admin `Dashboard-DPObRlBy.js`; Payroll Word/history and both Excel paths confirmed. API/database healthy. No backend/migration. Earlier Word-only Billing and Payroll Generate Excel guidance is superseded.

1. Refresh Payroll, choose an active period and queue eligible dedicated test scholars.
2. Open Export Excel. Confirm the existing seven-column form defaults, then select/reorder columns and download. Check the preparation banner, matching headings/values and unchanged queue; no official list should be created.
3. Click Generate payroll list. Confirm one saved PAY-reference batch and a `.docx` download using the Billing letter template with **Payroll reference**, period, school and numbered names in two columns. No Excel is automatically generated.
4. In Payroll history, choose Download Word for the saved list; verify the same reference and listed names without another generation request.
5. In Billing, queue eligible Private scholars. Confirm Export Excel is restored; select/reorder columns and verify its preparation workbook without a Signature column. The queue must remain and no batch should be created by Excel export.
6. Generate certification list in Billing and re-download from Billing history. Confirm existing Word formatting and BILL reference remain correct.
7. Where safely simulated locally/staging, fail the Word-template download after a successful process response. Confirm the notice says the list was saved but Word failed, the saved batch appears in history, and Download Word succeeds after restoring access without a duplicate process request. Do not fault-inject production.
8. Print-preview Word in the staff environment; names are the only table content, two columns with numbering, odd final cell blank. Payroll combines every school in one batch list with continuous numbering; Billing retains separate school letters. Confirm no payment/disbursement attestation is added.

Completed: frontend regression suite, Billing XLSX artifact round-trips, lint/build; eight actual desktop/mobile mode/success/failure browser workflows; multi-school actual DOCX parsing including XML-safe names and odd rows. Payroll XLSX tests remain green. LibreOffice rendered actual Payroll DOCX: one school on one page and two schools on two pages; text and preview verified preserved letterhead, Payroll reference, names and signature block. All fixtures are local/synthetic; no production records were written. Native Microsoft Word/Excel and physical printers remain staff acceptance checks.

Four-scholar correction: for a saved Payroll batch containing scholars from multiple schools, Download Word must show all four names together, numbered 1–4 in one two-column table. The introduction refers to their respective schools. Existing saved batches use the corrected download without regeneration or new records. Billing grouping remains per school.

Combined Payroll fix release `bf4dabe` verified live: entry `/assets/index-tFI3njqE.js`, admin `Dashboard-CBZhoCvu.js`; API/database healthy. Four-scholar mixed-school actual Generate/history/reloaded-history checks passed at desktop/mobile widths, with all names exactly once and one generation POST. Billing school letters and both Excel actions retained. LibreOffice preview confirms all four Payroll names on one page.
