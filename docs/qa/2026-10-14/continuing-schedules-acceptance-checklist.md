# Continuing submission schedules — acceptance checklist (2026-10-14)

Code release: `96d24e4`, pushed to main. New Admin and Scholar frontend assets verified live. API/database health is good and the new schedule route requires authentication. Backend revision/migration confirmation remains pending. Use dedicated test scholars/documents, and avoid generating real official lists merely to exercise a test.

1. Confirm Hostinger backend deployment and migration `20261014010000_continuing_requirement_schedules` succeeded, then hard-refresh the Admin site.
2. Open Scholars → Continuing Requirements; select the actual school year/semester. Set opening/deadline times using the labeled device timezone. Publish and reload the saved schedule; dates should persist.
3. For a Public test scholar, upload/approve all five initial files. For a Private test scholar, all six including tuition receipt are needed. No individual “Open continuing submission” button should appear.
4. Set the regular opening in the future: the Scholar panel shows the opening date and disables uploads. Leave one initial document missing/unapproved: the panel shows waiting for initial approval even during an otherwise open window.
5. Set the regular window to include now. Finish all initial approvals, reload the Scholar dashboard: continuing grades/registration are enabled for Public scholars; Private scholars additionally see tuition receipt.
6. Upload a continuing test file. Verify it is Pending review, original initial files remain available, and document review shows the correct period/wave/version.
7. Set the regular deadline in the past and leave the late window empty. After reload, Scholar uploads are disabled; a direct upload request must also be rejected by the API.
8. Add a late opening before now and late deadline after now (both after the regular deadline). Select “Selected scholars”, check one test scholar and publish. That scholar can upload; another eligible, unchecked test scholar cannot. Verify “All scholars” opens late uploads for everyone with approved initial files.
9. Reload the saved schedule: the original regular deadline remains unchanged by the late dates. Clear both late dates and republish; late access closes without deleting submitted files.
10. If an earlier semester is still active, select it in the Scholar requirements-period selector. The upload must use that semester; the dashboard's main payroll context remains the primary period. Do not invent another semester to accommodate lateness.
11. In a Public test scholar's Billing & Payroll drawer, the action is “Prepare & open Payroll” and opens Payroll with the chosen period/scholar. A Private scholar continues to open Billing for certification preparation.
12. In a designated test environment, generate an additional payroll list for previously unlisted Public test scholars in the same semester. Incomplete documents remain warnings. Already-listed scholars cannot be added again, but can complete their documents during their authorized upload window.
13. Open the schedule in two Admin sessions; save in one, then attempt saving the stale second copy. It should reject the stale revision and require reloading.
14. Confirm staff without Scholars access, Scholars, and Billing-only roles cannot publish schedules. Authorized viewers can inspect, while only permitted Admins can edit.

Local validation: 360 automated checks passed; one optional real-database test skipped; lint/build and desktop/mobile synthetic browser flows passed. Real hosted login, PostgreSQL migration execution, private blob uploads and official list mutation are not claimed as locally verified. Reload for immediate visibility; normal Scholar refresh remains two minutes.
