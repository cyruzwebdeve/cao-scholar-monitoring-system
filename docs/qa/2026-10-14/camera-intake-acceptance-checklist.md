# Camera intake — acceptance checklist (2026-10-14)

Release pending push. Frontend-only, no new migration. Use dedicated test Scholars and synthetic sample documents; confirmation really uploads and approves the selected initial files.

1. Hard-refresh the deployed site. Log in as an authorized Admin on the phone/desktop used by CAO. Open Scholars → Scholar → the test record's drawer → Overview → Capture initial requirements.
2. Check the displayed Scholar and school year/semester before capture. Public has five categories; Private has six including tuition receipt. Scholar/Billing-only accounts must not gain the Admin intake action.
3. On a phone, use Take photo; on a webcam-equipped desktop, use Open live camera and allow camera permission. Denying permission must show fallback guidance and leave file upload available.
4. Photograph a sample requirement. Add a second page to the same category. Check both page previews; use trim sliders/Apply crop, Rotate page, Remove/retake and Move page earlier/later. Verify page order and no clipped text.
5. Capture every remaining initial category. Retained approved files may be kept. Missing/unapproved categories must prevent confirmation; no document should be uploaded while capturing/editing alone.
6. Check the final readability/completeness/approval confirmation and choose Confirm, upload & approve initial set. Verify one PDF per photographed requirement, correct Scholar/period, Approved status, correct page count/order and preserved original versions.
7. Test an existing PDF via Choose file and inspect its preview; confirm that choosing PDF replaces that category's photo draft and adding a photo replaces its PDF draft. Individual Upload/Replace still works for correction.
8. In a controlled test session, interrupt a later upload. Confirm earlier successes remain saved and retry sends remaining files only. If the connection fails after a server commit, reload/inspect before retrying because that response may be ambiguous.
9. Stop camera, switch categories, background the browser or close the drawer. The camera indicator should stop. Closing intake with pending captures asks before discarding. Leaving Overview/closing the drawer discards drafts; reopening must not expose the previous Scholar's captures.
10. Compare phone capture time and readability with the printer scanner using representative sample pages, small printed text and multipage documents. Only adopt the replacement workflow after this physical-device trial passes.

Local verification: frontend tests/lint/build and synthetic Public-desktop/Private-mobile camera flows passed, including PDF contract/page count, confirmation, partial retry, denied permission and cleanup. Real device readability, hosted login and production private-storage uploads were not claimed as locally verified.
