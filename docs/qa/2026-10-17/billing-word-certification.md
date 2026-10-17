# Billing Word certification verification — 2026-10-17

Scope: Generate certification list and certification-history downloads use the supplied certification letter template as DOCX. The existing server transaction retains official references, membership and grant snapshots. Payroll and configurable preparation Excel exports retain their current behavior.

## Verification performed

- Browser-created DOCX with 65 synthetic scholars across two schools: two school letters, matching names/control numbers/course/year level, correct reference/period/date, escaped XML characters and repeated table headers.
- Opened the generated package with LibreOffice and rendered three pages. Inspected the first and final pages: retained letterhead/footer, page geometry and signatory; full-width table fits; separate school starts on a new page. Removed sample two-column section breaks to prevent clipping.
- Checked every XML/relationship part parses, no sample text or unresolved placeholders remain, and original author metadata/custom XML is excluded.
- Mocked Billing generation in the actual processing component: one processing POST, followed by DOCX download and refreshed persisted batch in history. Download Word uses the same reference and does not make a second processing POST.
- Mocked template-download failure after successful processing: generated record remains in history, queue clears, and the notice identifies Word download failure. No production records were created.
- Missing list/reference/period and missing scholar school reject document generation.
- Existing serialized Billing/Payroll workbook checks still pass, including column selection/order, currency, zero values, official/draft references and Payroll signature.
- Frontend regression suite, ESLint and production build passed. Existing build chunk-size advisory remains.

## Staff checks after deployment

1. Open Billing and select the academic period.
2. Move eligible prepared Private scholars into the certification queue. Include scholars from two schools if available.
3. Choose **Generate certification list**. Expect a `.docx` download named after the saved Billing reference.
4. Open it in Word. Verify the letterhead, school, semester/year, reference, scholar names/control numbers, course and year level. Each school has its own letter; long tables repeat their header.
5. Confirm the scholars are Billed and the generated reference appears in Certification history.
6. Refresh, then choose **Download Word** from history. Confirm the original reference and processing date. This must not create another list.
7. For a preparation copy, check **Export Excel** still offers selectable/reorderable columns and leaves the queue unchanged.
8. Confirm Payroll Generate still downloads Excel.

## Limits

The DOCX is generated on demand from retained Billing membership and the profile fields returned by the existing history API; it is not stored as an immutable binary document. Historical profile edits can therefore affect a later download. The supplied signatory and artwork are static template content. Historical issue dates use the saved processing date when present; old records without a date use the download date. Official list inclusion does not certify document completeness, so the letter avoids asserting that every scholar submitted complete requirements. Word itself was not available for native rendering; LibreOffice rendering and DOCX/XML checks passed. Release `ff90b4e` is deployed. Public verification confirmed the Word bundle and exact template checksum, with healthy API/database. No authenticated production-session generation test was performed.
