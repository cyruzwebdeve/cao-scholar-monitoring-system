# Initial and Continuing Requirements — Testing Checklist

Date: 2026-10-14 (Asia/Manila)

Release 32b0c35: frontend verified live and API/database healthy; backend deployment confirmation pending.

Use synthetic accepted scholars and non-sensitive sample PDFs/images in an approved test environment. Both frontend/backend deployments must complete. No migration is required.

1. Hard-refresh the Provincial Admin/Administrator dashboard and open Scholars → View details → Overview.
2. For a Public scholar, confirm Admin Upload/Replace is available for tax exemption, indigency, ID, grades, and registration form. There must be no tuition-receipt requirement. For a Private scholar, confirm all six initial files, including tuition receipt, are available.
3. Upload initial samples. Confirm each is recorded as Approved, its initial/CAO ownership is visible, and the selected period is correct. Previously recorded files should remain visible rather than disappearing.
4. Open the Scholar portal in another browser and reload. Confirm the full initial checklist is read-only. Continuing upload controls should be closed, with an explanation that CAO must open the second wave.
5. In the admin drawer click **Open continuing submission** for that scholar's selected academic period. This does not create a list or change document approvals.
6. Reload the Scholar portal. Confirm only grades, registration form, and Private-school tuition receipt can be uploaded as continuing files. Public scholars get only two upload controls.
7. Upload a new continuing grade report. Confirm Pending review, the original initial-grade file remains unchanged, and the admin sees the continuing submission separately.
8. In Document Reviews, inspect the wave/period label before opening the file. Approve/reject the continuing file and confirm only that wave is changed. The Scholar should see the decision/correction note after reload.
9. Replace a continuing file while its old review dialog is open. The old approval must return a changed-file error. Repeat with the bulk approval dialog; a replacement must not receive an unnoticed approval.
10. Replace an initial file and confirm the previous file appears in Previous document versions and can still be opened. Review decisions should retain their earlier metadata.
11. With synthetic data, upload different requirements from two staff sessions simultaneously. Both files should survive, or an explicit retry/conflict should appear; there must be no success followed by a silently missing file.
12. Activate/select another academic period through the normal staff workflow. Confirm the continuing wave needs opening for that scholar/period and starts with new academic files. Original initial files remain referenced; old continuing grades must not become the new period's grades.
13. Confirm existing deadline rules block Scholar continuing uploads after expiry, while authorized initial intake remains possible. Inactive scholars and inactive/invalid periods must be rejected.
14. Confirm existing Billing/Payroll list generation still permits incomplete requirements with warnings and retains route, duplicate, account, and school-classification safeguards. Document waves do not add a second list-generation cycle in the same academic period.
15. Check normal keyboard/mobile file controls, the initial checklist, continuing status, and review dialogs. Existing priority-proof review/acceptance should remain unchanged.

Known limits: existing two-minute visible-page portal refresh; real database contention/private blob storage were not exercised by local fixtures; historical files deleted before this release cannot be recovered. Retained file versions increase storage use.
