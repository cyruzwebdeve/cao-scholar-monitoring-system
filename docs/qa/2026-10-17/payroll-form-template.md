# Payroll form template verification — 2026-10-17

The supplied image is recreated as an editable Excel form. Both Payroll Generate and Payroll Export Excel use it. Billing remains Word-only.

## Expected layout and data

- General Form No. 5 / Revised January 1992 reference caption, program title, Community Affairs Office agency caption, academic period and the saved `PAY-####` reference.
- Default table: **Seq | NAME | School | Tuition | Allowance | Amount | SIGNATURE**.
- Amount is the grant recorded for the list. Tuition/Allowance use only recorded breakdowns. The user explicitly selected blank cells when those breakdowns are unrecorded, including Public scholars; zero remains an explicit numeric zero.
- At least 30 table rows, dotted body lines, blank signature cells, actual subtotal/grand total and editable preparation/certification/review lines.
- Footer is for list preparation, review and recorded membership. The image's payment approval/has-been-paid/disbursing certification is not reproduced because the approved system ends at list generation. Signatory names are blank/editable; names from the sample are not assumed to be current appointments.
- A4 landscape, repeated heading rows for large lists and automatic page height beyond 30 scholars. Single-column exports retain a readable minimum form width.
- Preparation copies have a clear banner and no official reference or generated membership. Their column selection and order remain configurable; previous Control Number, School Type, Municipality and Reference Number fields are available as optional columns.

## Verification completed

- Six workbook artifact tests serialize/reload real XLSX files and check columns, recorded/blank/zero values, actual totals/reference, preparation labeling, selected column order, single-column merges, large-list retention/print headings and invalid export inputs.
- Frontend regression suite, lint and build passed. Existing build-size advisory remains.
- LibreOffice opened/rendered the final workbooks: small official list prints on one A4 landscape page; 65 scholars print on two pages with repeated headings and the last scholar/grand total retained. Name-only and Amount-only exports rendered without clipping. Screenshots/text were reviewed.
- Actual Payroll browser workflow at desktop/mobile widths: seven defaults with Signature selected; custom ordered preparation export contains matching values and causes no process POST or queue clearing; Generate sends one request then downloads the saved-reference workbook with snapshot values, totals and blank signatures.
- Actual Billing browser checks at desktop/mobile widths retained Word-only generation, history re-download and batch retention on simulated Word download failure.
- All workflow requests were local synthetic fixtures; no production list/document was generated or changed. Frontend deployment is in progress; no backend/migration.

## Staff steps after deployment

1. Refresh, open Payroll, select the period and queue eligible test scholars with known grants/breakdowns.
2. Choose Export Excel with the defaults. Confirm the form heading, seven columns, real totals, blank signatures and preparation banner. Confirm the queue remains and no official reference is assigned.
3. Select/reorder a smaller set of columns and export again; verify headings and values match the selection. The header still carries agency/period context.
4. Generate a dedicated official test list. Confirm the workbook filename/header use its saved `PAY-` reference, the period is correct and Amount matches the recorded grant.
5. Check missing Tuition/Allowance stay blank and recorded zero remains 0.00. Do not infer a Public grant breakdown from the total amount.
6. Open Print Preview: A4 landscape, readable form, footer blocks and repeated headings for a large list. Signatory names may be entered in Excel for authorized list verification.
7. Confirm Billing still offers Word downloads only.

The image is a visual reference, not an original XLSX file, so this is a recreated editable layout rather than a pixel-identical binary template. Native Microsoft Excel/printer output was not available; XLSX round-trip, actual browser downloads and LibreOffice rendering were checked. Wide custom selections can print smaller. No payment-release, receipt, disbursement or monetary-audit function is added.
