# Admin scan and assignment checks

Prepared 2026-11-17. These are manual checks to run after deploying matching frontend/backend code; they have not been performed on live records.

Use synthetic test records: a posted, locked first-year passer and an active Scholar, with the appropriate staff section access, school classification and academic period.

| Check | Action | Expected result |
| --- | --- | --- |
| 1 | Open Results initial verification or Scholar Overview, then Scan and assign initial documents. | A numbered document draft appears without a selected requirement. |
| 2 | Scan/choose a document, click New document and scan another. | Both scans remain available and unassigned. A running camera stays open for the next document. |
| 3 | Add several pages to one document; crop, rotate and reorder them. | Only that document changes; its pages form one PDF. A separate document uses New document. |
| 4 | Choose a scanned document and assign its requirement; change or clear the assignment. | The selected document retains its pages/file. Upload is enabled only with content and a valid assignment. |
| 5 | Assign two document drafts to the same requirement. | The second assignment is unavailable; clearing/reassigning the first releases the target. |
| 6 | Upload one assigned document while other scans remain. | Only that document uploads to the displayed record/period and becomes Approved; other drafts remain available. |
| 7 | Interrupt/fail an upload, then retry. | An error appears and the selected draft/other scans remain. Failed uploads do not replace saved files. |
| 8 | Check a first-year initial set containing approved COG but no report card. | Report card is Required, COG is Optional, initial verification is incomplete and continuing access waits for initial approval. |
| 9 | Check pending/rejected report card, then upload an approved report card with the other required files present. | Pending/rejected does not complete initial verification. Approved report card satisfies the initial academic record; Scholar acceptance stays a separate action. |
| 10 | Check an upper-year entrant and Scholar continuing submissions. | Upper-year initial COG remains required; continuing college grades remain required for every year level. |
| 11 | Try an oversized/invalid file, more than ten pages or excessive PDF/photo drafts. | The applicable validation error appears; existing saved files stay intact. Final documents remain limited to 6 MB. |
| 12 | Upload a correction after reopening the scanner, then view history and a later academic period. | The previous file/review history remains, and the correct original initial period is still inherited. |

Also check narrow screens, keyboard focus, camera-denied file fallback and leaving the scanner with unsaved drafts. Generated payroll lists and Scholar account status must remain unchanged by scanning and uploading documents.
