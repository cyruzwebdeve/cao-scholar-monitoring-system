# Phone-to-laptop pairing — acceptance checklist (2026-10-14)

Initial release `9a99e7d` frontend verified live; user confirmed its backend/migration deployment. Final-photo handoff follow-up deployment is being verified. Backend migration `20261014020000_phone_capture_sessions` required. Use dedicated test Scholars/sample documents; final laptop confirmation actually uploads and approves initial requirements.

1. Confirm Hostinger backend build/migration succeeded; hard-refresh laptop/phone browsers.
2. On the laptop, open Scholars → Scholar → test record → Overview → Capture initial requirements → Use phone camera. Check Scholar and academic period beside the QR.
3. Scan the QR with the phone. Complete the site's existing access gate if prompted, then sign in with the SAME Admin account used on the laptop. The pairing URL must remain intact. Another Admin, Scholar or Billing-only account must not access its images/session.
4. Select an applicable initial requirement, use Take photo or Open live camera, inspect the preview and Send to laptop. Sending must not approve or submit an initial requirement. The laptop should receive a page in the correct category within a few seconds.
5. Add multiple pages; crop/rotate/retake/reorder on the laptop. Public has five categories; Private also has tuition receipt. Existing PDF/category limits should hold additional pages rather than overwrite draft files.
6. Capture all missing initial requirements. While the phone connection is active, confirmation/upload must remain disabled. Send one final extra page immediately before ending the connection: it must be received and retained before the session closes. End phone connection on the laptop, review the entire set, check confirmation and upload/approve. Verify existing version history and selected period remain correct.
7. Confirm document rows have no separate Upload/Replace controls; status/View remain. For corrections, close and reopen intake, select the category, capture/Choose file and confirm its replacement. Other approved originals may be retained.
8. Test a lost/repeated transfer response in a controlled session: repeated delivery should not duplicate a page on the laptop. Final-upload partial-failure retries still skip successfully uploaded documents.
9. End pairing or wait 20 minutes; further transfer/read requests must fail. The phone shows a closure/expiry notice and stops its camera. A new pairing for the same record invalidates the previous QR; expired temporary queues are purged by the API cleanup job.
10. Switch Admin account on the phone: prior Scholar context/photo must clear before login. Close intake or change Scholar/period on the laptop; no draft/session may transfer into another Scholar.
11. Check physical QR readability, phone photo quality and page order using representative sample papers before replacing the printer workflow operationally.

Local verification: full regression suites/lint/build and two-browser Public/Private transfer workflows passed. No real production photos/list generation, hosted login, PostgreSQL migration execution or physical-device quality were claimed as locally verified. Temporary transfer storage is separate from approved document records; keep original papers under CAO's existing policy.
