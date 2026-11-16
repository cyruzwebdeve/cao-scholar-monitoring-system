# Academic Year: Simple Testing Checklist

Date: 2026-11-16  
Status: **Not run**. Check a box after its expected result is confirmed.

Use a test environment with the intake update and migration installed. Prepare an existing Applicant, an existing Scholar, and configured periods for `2026-2027` and `2027-2028`. Start with `2026-2027` as both intake and processing primary. Use a new intake with no saved records for the empty-view checks.

- [ ] **1. Change the intake year.** In Settings > Academic Year > Intake school year and semester, select `2027-2028` and confirm.  
  **Expected:** Applications and Examinations use `2027-2028`. Scholar processing stays in `2026-2027`; processing activation flags stay unchanged.

- [ ] **2. Open the new year's pages.** Check Applicants, Results and Examination Management before adding records.  
  **Expected:** The empty intake shows zero applicants/results, unset examination dates and inactive venues. Old records are not copied into it.

- [ ] **3. Submit a new application.** Open applications through the normal settings, then register a unique test Applicant.  
  **Expected:** The application is saved under `2027-2028`. Existing accounts are retained.

- [ ] **4. Save a new examination schedule.** Set valid dates for the new Applicant's municipality, save and activate the examination.  
  **Expected:** The schedule and Applicant assignment belong to `2027-2028`. Old schedules and attendance remain saved.

- [ ] **5. View the old year.** Select `2026-2027` in Applicants, Results and Examination Management.  
  **Expected:** Old records remain visible in history with their original year. History is view-only; cards and exports match the selected year. Old-year examination access is closed after rollover.

- [ ] **6. Sign in as an old Applicant.** Open their dashboard after the intake change.  
  **Expected:** Their account, application and published result remain available. They see a historical-intake notice and cannot take the old examination.

- [ ] **7. Try reapplying with an existing email.** Submit an otherwise valid new application using the old Applicant's email.  
  **Expected:** Reapplication is rejected. No duplicate account/application is created.

- [ ] **8. Check an existing continuing Scholar.** Sign in, review their documents, then check their existing Billing/Payroll session and default Reports.  
  **Expected:** Their processing period, permitted continuing uploads, documents and generated-list records remain. Changing intake alone does not change saved Payroll amounts or the default Report period.

- [ ] **9. Check a Scholar accepted for the new year.** Accept a test Applicant through the normal `2027-2028` admission process while processing primary stays `2026-2027`.  
  **Expected:** The Scholar appears in the directory and retains their accepted result/documents. Earlier-year processing and uploads are blocked; their dashboard explains that they are waiting for their entry school year.

- [ ] **10. Try an old open page.** Load an application form or examination editor, change intake in another session, then try submitting the old page.  
  **Expected:** It requires a reload or rejects the stale submission. No records are saved into the wrong year.

- [ ] **11. Change only the semester.** Select another configured semester in the same intake school year.  
  **Expected:** Annual examination dates and activation remain. Pages loaded under the previous semester must reload before saving.

- [ ] **12. Try changing years during an online exam.** Start a valid online attempt in the current intake, leave it unfinished before its deadline, then try selecting a different year.  
  **Expected:** The year change is blocked until the attempt finishes or expires. The current intake and examination activation remain unchanged after the blocked attempt.

Application opening dates, examination settings and the question bank need separate staff review; selecting an intake does not reset or open them.

For permissions, API responses and additional edge cases, see the [detailed test cases](academic-intake-test-cases.md).

Suggested commit message: `docs: add a simple academic intake testing checklist`
