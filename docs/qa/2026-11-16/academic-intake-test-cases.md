# Academic Intake Year: Test Cases and Expected Outputs

Date: 2026-11-16 (Asia/Shanghai)  
Feature: Separate Application and Examination intake from Scholar processing  
Execution status: **Not run**. This document defines acceptance criteria; it does not record a new test execution.

## Scope and setup

Run these cases against an isolated test environment with matching frontend/backend builds, the `20261116010000_application_examination_intake` migration applied, and the application Prisma client regenerated. Use synthetic records and test mail delivery. Creating this document does not apply the migration or modify application records.

The two Settings controls have different purposes:

| Control | Used by |
| --- | --- |
| Settings > Academic Year > Intake school year and semester | Applications, examination schedules/access/results, Passer Lists, initial intake verification and Scholar acceptance. |
| Primary System Period and active academic periods | Continuing Scholar requirements, Billing/Payroll processing and default Reports. |

History is a view scope. Intake rollover retains each record's saved year, documents and account access; it does not change academic-period processing flags or automatically advance Scholar year levels.

Prepare these fixtures and record their actual IDs. Reset the fixture state before each case unless its steps explicitly continue a previous case.

| Fixture | Initial state |
| --- | --- |
| P-A | `2026-2027`, 1st Semester; active processing primary and selected intake. |
| P-B | `2027-2028`, 1st Semester; configured, processing inactive, not primary; no applicants or schedules for this year. |
| P-C | `2027-2028`, 2nd Semester; configured, processing inactive, not primary. |
| P-D | `2028-2029`, 1st Semester; configured, processing inactive, not primary. |
| E-A | Saved active `2026-2027` examination with a municipality, venue and valid dates. |
| A-old | Existing `2026-2027` Applicant account, matching assignment to E-A and a published result. Prepare a separate unpublished-result fixture for TC-12. |
| A-2025 | Existing Applicant whose genuine saved year is `2025-2026`, with retained historical records. |
| S-continuing | Existing accepted Scholar entering in P-A or earlier, with original initial documents and a known continuing/processing session in P-A. |
| A-new / S-future | A unique Applicant to register in P-B; after normal acceptance, this same person becomes S-future entering in `2027-2028`. |
| Staff accounts | An authorized administrator; Regular/Billing staff with the sections required by each workflow; a staff account without Settings access. |

Keep before/after snapshots of intake ID/revision, academic-period flags, relevant record IDs, original document attribution, and generated-list amounts. Configure global application availability as open only for registration cases. For online examination cases, configure the question bank/delivery settings, valid schedule dates and required attendance through the existing workflow.

## Settings and rollover

| ID | Test case and steps | Expected output |
| --- | --- | --- |
| TC-01 | **Initial migration selection.** On a disposable pre-migration fixture with P-A as the real processing primary, apply the intake migration, generate the client, and open Settings. | The singleton selects P-A once. Existing applications, schedules, documents, account flags and processing periods are retained. Later processing-primary changes do not reseed intake. A fixture with no active processing period has no selected intake and requires explicit setup. |
| TC-02 | **Cancel a proposed intake change.** Select P-B, click Change intake, read the confirmation, then Cancel. Refresh Settings. | Confirmation identifies P-B and explains history, previous-year examination access and retained global settings. P-A remains selected; revision, examination activation and processing flags are unchanged. |
| TC-03 | **Select an upcoming inactive intake.** With no running online attempt, select P-B and confirm. Reload Settings. | `PUT /intake-period` returns `200`. P-B remains selected after reload; revision increases by one. P-B stays processing inactive/not primary, and P-A stays the processing primary. Active exams in the previous selected intake year become inactive; their records remain. Unrelated historical years are untouched. |
| TC-04 | **Processing-primary independence.** With P-B as intake, separately activate P-C for processing and set it as Primary System Period. Reopen Applications and Examination Management. | Intake remains P-B, including its semester. Application/examination defaults do not follow the new processing primary. Scholar processing and default Reports follow their existing primary-period rules. The primary change does not alter intake revision. |
| TC-05 | **Processing deactivation independence.** Select P-B as intake while it is processing inactive; open Examination Management. Separately activate P-C for processing, then deactivate it while keeping P-A primary. | A configured processing-inactive period can still be the current intake. Intake editing works for authorized staff. Processing deactivation does not clear or replace the intake selection. Deactivating a processing period still affects its normal continuing/processing availability. |
| TC-06 | **Global configuration is retained.** Record application opening/closing settings, exam delivery configuration and question-bank version. Switch from P-A to P-B. | Recorded global settings remain unchanged. Rollover does not automatically open applications, reset the examination bank or create grants. Staff must review those settings before opening the cycle. |
| TC-07 | **Same-year semester change.** With P-B selected and saved `2027-2028` schedules, select P-C. Repeat with an unfinished, unexpired attempt for that school year. | Update returns `200`; annual schedules, dates, activation, attendance and results remain. The running attempt does not block a same-year semester change. Intake period ID/revision changes, so old exact-period forms and schedule payloads require reload and return `409` if submitted. An old-semester unposted Passer List draft cannot be posted under the new selected period (`409`). |
| TC-08 | **Running examination blocks a year switch.** Start an eligible online attempt in P-A, leave it unfinished with a future deadline, then try selecting P-B. | Update returns `409` with: `An online examination is still in progress for the current intake. Wait for it to finish or expire before changing the intake school year.` P-A and its revision/examination activation remain unchanged; no partial rollover occurs. |
| TC-09 | **Completed, expired or forfeited attempts permit rollover.** Repeat TC-08 independently after the attempt has an exact saved result, after its deadline expires, and after it is forfeited. | Each cross-year update succeeds (`200`) when no other blocking attempt exists. Previous records remain and old-year examination access closes. Rollover does not fabricate an examination result or renew an expired deadline. |
| TC-10 | **Competing Settings updates.** Open Settings in two sessions at the same revision. Save P-B in the first; try saving another period from the second without reloading. | First update succeeds. Stale update returns `409` and asks staff to reload; it cannot overwrite the newer selection. Reload shows the saved period/revision. Repeating the already-selected period with its current revision is a successful no-op without another revision increment. |

## Applications, examinations and history

| ID | Test case and steps | Expected output |
| --- | --- | --- |
| TC-11 | **Fresh-year default views.** Select P-B with no records for that year. Open Applicants, Results and Examination Management, then refresh without editing. | Applicants and Results default to `2027-2028` and show zero records for the empty fixture. Applicant cards are zero. Examination Management shows unset dates/inactive venue templates; the API returns an empty saved examination list. Viewing/refreshing does not insert schedules or copy old dates/activation. |
| TC-12 | **Historical views and matching cards.** With P-B selected, choose `2026-2027`, `2025-2026` and All intake years in Applicants/Results; choose `2026-2027` in Examination Management. Inspect cards, rows, exported data, rosters and saved photos. | Historical records retain their original year, result, date and assignment. Different historical years and All intake years are view-only; schedule edits/activation, attendance updates, score changes, publication, posting and acceptance are unavailable for that history. Cards and their detail rows match the server-selected scope; CSV/roster exports use that scope. Total/Scheduled Applicant cards count people; Completed/Passed cards count result records. Historical photos do not replace another year's photos. Explicitly selecting the current intake year remains editable for authorized staff. An Applicant's unpublished score remains hidden in their portal. |
| TC-13 | **Old Applicant account after rollover.** Sign in as A-old after selecting P-B. Open the Applicant dashboard and examination area. | Sign-in still works. Original application year, published examination score/result and saved documents remain available. A Historical intake notice appears; `intakeScope.archived` is `true`, and examination access for the old intake is `false`. The account is not reset or assigned to P-B. |
| TC-14 | **Register in the new intake.** Open a fresh application page for P-B while global applications are open. Complete a valid, unique synthetic application and submit. | `POST /applications` returns `201`. A-new and the new account are created through the normal workflow with saved year `2027-2028`. The request includes P-B's displayed `academicPeriodId` and `academicYear`. No processing activation is required, and existing Applicant/Scholar accounts remain intact. The Applicant total for the empty P-B fixture becomes 1. |
| TC-15 | **Existing reapplication rule.** In the P-B form, submit a complete, otherwise valid application using A-old's existing email. | Request returns `409`: `An applicant account already exists for this email address.` No second application/account is created, and the original account/year/history remain. |
| TC-16 | **Stale open application.** Load a valid form for P-A, then switch intake to P-B in another staff session. Return to the old form and try submitting; also test a valid direct request carrying P-A's old scope. | The refreshed page shows Application intake changed and requires reload/review. A valid request with obsolete scope returns `409` without creating a wrong-year application/account. Missing or malformed scope fields return `400`. Other form validation must pass before asserting the scope-specific response. |
| TC-17 | **New schedules and assignments.** Select P-B, register A-new, then explicitly save a valid schedule for A-new's municipality and activate its examination. Inspect assignment, roster and Applicant cards. | Save returns `200` and creates/updates only the `2027-2028` schedule. A-new is assigned to the exact new examination ID. With one new Applicant and one assignment, Total Applicants = 1 and Scheduled for Exam = 1; Completed/Passed remain 0 before a result. Old-year assignments, attendance and results are retained. Venue photos remain year-scoped. |
| TC-18 | **Stale staff changes.** Load schedules/results or a pending acceptance under P-A; switch to P-B. Attempt an old schedule save, old-year score/publication/attendance change, or old-period unposted list/acceptance request with otherwise valid data. | Stale scope conflicts for schedules, scores, publication, unposted lists and acceptance return `409`. Old-year attendance can return `404` because that examination is unavailable in the current-intake lookup; an intake change during its guarded transaction can return `409`. No old-year edit is redirected into P-B, no wrong-year result/Scholar is created, and historical records remain. Reloaded historical controls are view-only. An already-posted idempotent list response may retain its existing list; it must not create another posting. |
| TC-19 | **New-intake admission workflow.** In P-B, run A-new through assignment, required attendance, examination, score review, publication/locked Passer List, CAO initial verification, explicit Potential Scholar checking and authorized acceptance. Before acceptance, check new-list selection and a reasoned revision of the posted list. | Each stage uses P-B's intake context even while its processing flag is inactive. Posting removes that Applicant from new-list selection while retaining them in Retained lists and Results. A revision can reuse its own unaccepted members, while another active list's members remain unavailable; a duplicate new-list or stale-draft post returns `409`. Publication and Scholar acceptance remain separate actions; initial verification alone does not grant Scholar status. Successful acceptance creates S-future normally, retains the accepted result/original initial-document source, and removes the candidate from the pending queue. No automatic continuing period or generated Payroll list is created. |
| TC-20 | **Stale page responses and navigation.** Rapidly switch current/historical/all year filters in Applicants and Results; switch examination years. Delay responses in the test browser, and change intake from another session during an outstanding load/action. | Previous year data/actions are cleared or disabled while the selected scope loads. Late reads, errors and loading callbacks cannot replace the newer view. Old mutation responses cannot reopen a previous drawer, restore a stale queue/confirmation or trigger an old Passer List callback into the new view. Cards and exports never show old data under a newly selected year. |

## Scholars, continuing requirements and processing

| ID | Test case and steps | Expected output |
| --- | --- | --- |
| TC-21 | **Continuing Scholar account and documents.** Record S-continuing's P-A session and document status, switch intake to P-B, then sign in as S-continuing and view/upload an otherwise permitted P-A continuing document. | The processing primary and active continuing choices remain available. Original accepted examination proof, initial documents and continuing period/status remain. A permitted upload follows P-A's existing schedule/rules and succeeds normally; it is not stored under the new intake. |
| TC-22 | **Billing/Payroll and Reports preservation.** Snapshot existing P-A prepared sessions, generated list membership/amounts and a default Report. Change only intake to P-B, then revisit those areas. | Existing processing period, session records, generated membership and saved list amounts remain unchanged by the switch. Default Reports still use the retained processing primary. Existing record-based monetary totals remain generated Payroll-list amounts. A separate new registration/acceptance can affect directory-based counts according to existing Report definitions; the intake switch itself must not relabel or rewrite old processing records. |
| TC-23 | **Future-entry Scholar stays visible.** Accept S-future for `2027-2028` while P-A remains processing primary. Open the full Scholars directory and S-future's dashboard. | S-future remains in the directory and can sign in. Accepted result and original initial documents remain visible. For P-A, `processingEligibility.eligible` is `false`; continuing access is closed with submission state `waiting_entry_year`. The dashboard explains Waiting for your entry school year. Being visible or active as a Scholar does not authorize earlier-year processing. |
| TC-24 | **Block pre-entry documents and metadata.** For S-future, target P-A with otherwise valid continuing upload, ordinary staff initial upload, continuing-opening, school/year-level metadata and processing-session metadata requests. | Requests return `409` explaining that the Scholar enters in `2027-2028` and requires that school year or later. No pre-entry document/session row or metadata change is saved. Original accepted intake documents remain. Passer initial verification before Scholar acceptance continues to use the intake workflow from TC-19. |
| TC-25 | **Block pre-entry preparation and list generation.** Prepare eligible Public and Private future-entry Scholar fixtures. Target P-A for amount editing, Private grant preparation, routing to Payroll, and Billing/Payroll list generation. | Each otherwise valid operation returns `409` or an ineligibility conflict including the entry-year reason. No earlier-period preparation, amount change, generated batch/membership or successful decision is written. Existing Scholars and generated-list totals remain unchanged. |
| TC-26 | **Allow entry-year/later processing.** Explicitly activate P-B and, for a later-year variation, P-D for processing. Keep P-A primary. Configure normal continuing prerequisites/schedules, choose an eligible period and submit a valid continuing document or prepare an eligible session. | The selected entry-year/later period passes the entry-year guard. Permitted uploads/metadata succeed (`200`); preparation/generation follows its normal requirements and responses. On the portal, an eligible selected continuing wave is not incorrectly marked waiting solely because primary P-A is older. If testing the UI picker while primary is older, activate both eligible periods so it has multiple choices; the API variation can specify `requirementPeriodId` directly. Activating processing is a separate deliberate action; selecting intake alone does not do it. |
| TC-27 | **Preserve legacy recorded years.** View A-2025 in historical/all-year management. Use separate legacy fixtures with missing/unusable saved year; inspect the all-year directory and existing Scholar processing access. | Genuine `2025-2026` remains `2025-2026`. Missing years remain missing, not relabeled to current intake. Unknown-year Applicants do not automatically enter the current intake. Unknown legacy Scholar entry years retain existing processing behavior; eligibility alone never guesses/backfills a year. Other normal validation still applies. |

## API boundaries, recovery and usability

API paths below are relative to the configured API base. Use valid authentication, permissions and request bodies when checking a workflow conflict; validation/authorization can otherwise reject the request earlier.

| ID | Test case and steps | Expected output |
| --- | --- | --- |
| TC-28 | **Public read and protected updates.** Call `GET /intake-period` without signing in. Try `PUT /intake-period` anonymously, as Applicant/Scholar, and as Regular/Billing staff without Settings access. Repeat with authorized staff and a current valid revision. | Public read returns `200` with selected period metadata/revision, including real processing flags; it excludes updater identity and private documents. Anonymous update returns `401`; Applicant/Scholar and Regular/Billing staff without Settings access receive `403`. Authorized staff can update (`200`). SuperAdmin has implicit section access. Rejected writes leave selection/revision unchanged. |
| TC-29 | **Invalid or missing configuration.** Try a missing/invalid period ID or revision (`400`), a positive unconfigured period ID with current revision (`404`), and a stale revision (`409`). On separate disposable fixtures, test no selected intake and missing intake schema/client. | Invalid writes do not change configuration/records. No selection: public GET returns `200` with `intakePeriod: null`; the public form requires setup, and current examination management has an honest empty/unavailable scope. Existing history can still be selected when configured. Missing schema/client: requests requiring intake return `503` with `Application and examination intake is unavailable. Please try again later or contact CAO.` Neither condition silently chooses the processing primary. |
| TC-30 | **Phone capture after rollover.** Pair a phone to a posted passer's initial intake in P-A. Change to P-B, then poll at the same revision or try sending/receiving through the old session. Separately test an existing eligible Scholar's P-A processing capture. | Old passer intake operations reject with `409` rather than silently continuing in P-B, including unchanged-revision polling. Reopen capture under the correct current intake. An eligible Scholar's processing capture remains governed by its selected processing period. Capture alone does not approve an initial document or verify payment. |
| TC-31 | **Retired legacy endpoint.** As an authenticated Scholar, call `PUT /applications/:id/requirements` with valid legacy body `{"payoutComplianceDocs":{}}`. Repeat with missing/nonobject payload. | Valid legacy payload returns `410` directing the caller to the period-scoped Scholar portal upload; the retired handler performs no model reads/writes. Missing/nonobject payload returns `400` at the validator first. The current `PUT /applications/me/requirements` upload remains available under normal period permissions. |
| TC-32 | **Keyboard, loading and conflict feedback.** Navigate intake/year selects and confirmation controls by keyboard; use narrow/mobile layout. Interrupt a load and retry. Inspect current/history and future-entry messages. | Labels, focus and selected values remain clear; controls are reachable and usable without a mouse. Loading/failure states disable unsafe actions and offer recovery; stale replies do not replace a newer view. Current/history and waiting-entry messages describe the selected scope. Controls remain readable at narrow widths. Actual rendering/accessibility must be checked in the browser. |

## Expected API examples

These are relevant response excerpts. Substitute fixture IDs and inspect the additional fields returned by the application.

**Successful cross-year intake change:** HTTP `200`; message:

```text
Application and examination intake updated. Previous intake records remain available in history.
```

`intakePeriod.schoolYear` is `2027-2028`, `intakePeriod.isCurrentIntake` is `true`, `intakePeriod.isActive` stays `false` for the inactive P-B fixture, and `revision` is the previous value plus one.

**Archived Applicant:** HTTP `200` from `/applications/me`; relevant values:

```json
{
  "intakeScope": {
    "schoolYear": "2026-2027",
    "isCurrentIntake": false,
    "archived": true
  },
  "examination": {
    "academicYear": "2026-2027",
    "access": { "allowed": false }
  }
}
```

**Future-entry Scholar viewing P-A:** HTTP `200` from `/applications/me`; relevant values:

```json
{
  "processingEligibility": {
    "eligible": false,
    "entrySchoolYear": "2027-2028",
    "schoolYear": "2026-2027"
  },
  "requirementWave": {
    "continuingOpen": false,
    "submission": {
      "state": "waiting_entry_year",
      "visible": false,
      "isOpen": false
    }
  }
}
```

## Execution record and acceptance

For each case, record the actual result separately from the expected output. All cases start **Not run**; use **Pass**, **Fail**, **Blocked** or **Not applicable** only after assessing the case.

| Case ID | Status | Actual output / HTTP status | Evidence reference | Tester / date |
| --- | --- | --- | --- | --- |
| TC-__ | Not run | | | |

Accept the feature when applicable cases pass, conflicting writes preserve the correct year/data, and evidence confirms historical access and independent Scholar processing. Treat unavailable dependencies, missing fixtures or untested live database locks as blocked/unverified coverage. Record any exceptions before release. Keep evidence limited to synthetic IDs and sanitized responses; exclude credentials and private document locations.

## Existing automated coverage and limitations

The implementation change log records **562 backend passes, one opt-in migration test skipped, 148 frontend passes and 23 frontend dependency load failures** from the earlier verification. These figures are historical evidence, not a new execution of this plan. Browser/component/export checks and live PostgreSQL lock behavior still need controlled validation.

For automated runner setup, use [Automated Testing](../../testing.md). Related regressions include:

- Backend: `intakePeriod.test.js`, `intakePeriodRoutes.test.js`, `intakeApplicationController.test.js`, `examinationScheduleYear.test.js`, `examinationIntegration.test.js`, `passerLists.test.js`, `phoneCapture.test.js`, `scholarProcessingPeriod.test.js`, `requirementWaves.test.js`, and Billing/Payroll preparation/processing tests.
- Frontend: `intakePeriod.test.js`, `examinationSchedules.test.js` and existing examination/portal UI regressions.

Entry-year metadata edits retain their existing preflight/atomic-upsert concurrency behavior. Transactional list generation, requirement uploads and grant/amount/Payroll preparation re-read eligibility before writing; controlled transaction-race coverage belongs in the corresponding automated/integration tests.

The current Scholar portal displays its continuing-period selector only when more than one eligible period is returned. TC-26 covers the visible selector using two eligible periods and the eligibility API using an explicit period. Access through the UI when only one eligible non-primary period remains needs separate review.

Workflow scope continues through official Payroll-list generation. Payout attendance and Scholar-owned receipt acknowledgement remain separate existing features; these cases do not introduce fund release, official disbursement verification, reconciliation or monetary auditing.

Suggested commit message: `docs: add academic intake test cases and expected outputs`
