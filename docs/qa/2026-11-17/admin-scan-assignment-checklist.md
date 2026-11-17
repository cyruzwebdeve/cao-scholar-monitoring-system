# Admin scan and assignment checks

Prepared 2026-11-17. These are manual checks to run after deploying matching frontend/backend code; they have not been performed on live records.

Use synthetic test records: a posted, locked first-year passer and an active Scholar, with the appropriate staff section access, school classification and academic period.

| Check | Action | Expected result |
| --- | --- | --- |
| 1 | Open Results initial verification or Scholar Overview, then Scan and assign initial documents. | Scan documents opens with a numbered unassigned draft; Assign requirements is the second tab. |
| 2 | Scan/choose a document, click New document and scan another. | Both scans remain available and unassigned. A running camera stays open for the next document. |
| 3 | Add several pages to one document; crop, rotate and reorder them. | Only that document changes; its pages form one PDF. A separate document uses New document. |
| 4 | In Assign requirements, select a scanned document from a requirement's own dropdown; replace or clear the selection. | Both old and replacement scans retain their pages/file. Only the selected scan is assigned to that row; its Upload & approve button requires content and a valid assignment. |
| 5 | Select the same scanned document for a different requirement. | A document assigned elsewhere is unavailable. Clearing its original row releases it for another requirement. |
| 6 | Preview document A, then use a different requirement row to upload its selected document B. | Only B uploads to that row's requirement in the displayed record/period and becomes Approved. A and other drafts remain; A stays selected in Scan documents. |
| 7 | Interrupt/fail an upload, then retry. | An error appears and the selected draft/other scans remain. Failed uploads do not replace saved files. |
| 8 | Check a first-year initial set containing approved COG but no report card. | Report card is Required, COG is Optional, initial verification is incomplete and continuing access waits for initial approval. |
| 9 | Check pending/rejected report card, then upload an approved report card with the other required files present. | Pending/rejected does not complete initial verification. Approved report card satisfies the initial academic record; Scholar acceptance stays a separate action. |
| 10 | Check an upper-year entrant and Scholar continuing submissions. | Upper-year initial COG remains required; continuing college grades remain required for every year level. |
| 11 | Try an oversized/invalid file, more than ten pages or excessive PDF/photo drafts. | The applicable validation error appears; existing saved files stay intact. Final documents remain limited to 6 MB. |
| 12 | Upload a correction after reopening the scanner, then view history and a later academic period. | The previous file/review history remains, and the correct original initial period is still inherited. |
| 13 | Start the live camera, switch to Assign requirements, then use Preview scan or return to Scan documents. | Leaving Scan documents stops the camera. Scans and assignments survive both directions; Preview scan opens the chosen document. |
| 14 | Focus a tab and use Left/Right arrows, Home and End; inspect a narrow screen. | The chosen tab receives focus and shows its associated panel. Dropdowns stay within their requirement row and actions wrap. Hidden-panel controls are outside keyboard navigation. |
| 15 | Open Assign requirements before scanning, then check controls during an upload or phone connection. | Empty rows explain that a document must be scanned first. Tabs, assignments and preview actions are disabled during processing; uploading is unavailable during a phone connection. |

Also check narrow screens, keyboard focus, camera-denied file fallback and leaving the scanner with unsaved drafts. Generated payroll lists and Scholar account status must remain unchanged by scanning and uploading documents.
