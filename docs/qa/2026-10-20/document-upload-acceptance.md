# Document upload policy: hosted testing

Updated: 2026-10-20 (Asia/Manila). Use authorized dedicated test accounts and generated, non-personal files. Local checks passed; hosted acceptance remains pending. Confirm both frontend/backend builds installed the new parser dependencies; no migration is required.

1. Verify PDF/JPG/PNG and maximum 6 MB guidance beside applicable initial, continuing and eligibility-proof inputs, including after selection. Check desktop, phone and keyboard access; optional/applicable requirement rules must be unchanged.
2. Upload valid PDF, JPG/JPEG and PNG documents through initial intake, continuing Scholar submission and eligibility-proof application. Verify existing private previews/version history and authorization. Do not create real applications or approvals just to test.
3. Try an unsupported extension, a renamed image/PDF, a forged MIME, empty/malformed data, truncated PDF/JPEG, corrupt PNG and a file exceeding 6 × 1024 × 1024 bytes. Browser checks should help immediately; direct API bypass must still be rejected. Password-protected PDFs require a fresh unlocked copy. No previous stored file/history may be overwritten on failure.
4. Capture/select photo pages, edit/reorder them and submit a generated PDF. Source JPG/PNG may be up to 12 MB before conversion; final per-requirement document stays at 6 MB, with existing ten-page/four-MB-JPEG-transfer controls. Failed conversion/save retains drafts for retry.
5. Add a disposable applicant to Potential Scholars after checking. Reject a bad replacement and verify the prior review/file remains. Upload a valid replacement and verify Needs rechecking before any final acceptance; do not accept real scholars for this test.
6. Simulate a failed save and retry. Preserve existing continuing/proof files and valid initial drafts. Check that selecting the same corrected file is possible and that proof submission cannot race its asynchronous file check.
7. Verify API health, provider build status, private storage permissions and unauthorized access separately. Public frontend assets/health do not prove backend parsing or private storage behavior. Parser timeout/resource saturation must return corrective/retry guidance without writes.

No legacy stored files are automatically rescanned. Format validation does not claim malware scanning or full visual PDF rendering. Four existing package advisories remain independent security follow-up work. Record results without credentials, real personal information or private document locations.
