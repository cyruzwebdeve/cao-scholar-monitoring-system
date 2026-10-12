# QA-01 through QA-11 verification

Date: 2026-10-12 (Asia/Manila). Application baseline: `4f5fbfb`, containing
QA-10 release `709e770`; QA-11 documentation is currently local. This verification
changed documentation only and did not deploy or mutate production records.

All checked local regressions passed. Public deployment checks passed. This is
**not** a claim that all protected production workflows have passed acceptance.
No authenticated production session or private Hostinger dashboard was available.

## Verification matrix

| QA | Result | Fresh verification | Remaining live acceptance |
| --- | --- | --- | --- |
| QA-01 paper scoring | PASS locally; deployed controls found | Automated first-score/provenance/history, zero-score, bounds, attendance, publication, correction, rollback and permission checks; synthetic browser recorded zero, published, corrected with reason and re-published. Applicant draft remains private and publication shows score/outcome. | Dedicated paper applicant from attendance through publication/correction; scholarship acceptance remains separate. |
| QA-02 strict online marking | PASS locally; deployed bank warning found | Unsafe legacy banks cannot start/submit or write results; keys/version rules and objective grading regressions passed. Browser blocked unsafe bank, required identification keys, replaced essay with objective question and saved a 20-point version. | Inspect CAO's actual saved bank/keys and grade a dedicated online attempt; current bank contents were not read. |
| QA-03 45-minute deadline | PASS locally; deployed guidance found | Concurrent opener/persisted deadline/version and late/mismatched-ticket rejection tests passed. Browser refresh retained deadline; accelerated synthetic expiry disabled form/modal and sent no late submission. | Actual persisted hosted deadline/migration and a controlled timed attempt. Synthetic browser used a shortened remaining deadline; it did not wait 45 real minutes. |
| QA-04 same-browser recovery | PASS locally; deployed restore guidance found | All answer types restored after refresh/tab reopening; account/attempt/version/deadline isolation, storage denial and cleanup regressions passed. Browser retained draft on 503 and cleared on success, expiry and sign-out. | Dedicated authorized attempt recovery in the same browser. Cross-device recovery remains excluded by user choice. |
| QA-05 tester verification | PASS locally; deployed timeout/retry guidance found | Stalled fetch/body, cancellation and malformed-response tests passed. Browser status/unlock timeout, manual retry, retained code, missing-token rejection, expiry cancellation and successful unlock passed. | Controlled hosted gate behavior; synthetic code/token used locally, no real code entered. |
| QA-06 tester-code contrast | PASS sampled locally; deployed CSS found | Computed text/caret rgb(23,58,42) on white: 12.54:1. Keyboard input-to-submit, error alert, focus style and 390px overflow checks passed. Axe: zero violations, 23 passing rules, one incomplete contrast check supplemented by computed ratio. | Broader app accessibility and real browser/device coverage remain outside this sampled gate check. |
| QA-07 atomic online submission | PASS synthetic integration | Result/status commit-before-receipt, rollback/retry after status-write failure, withdrawn/missing application rejection and concurrent/duplicate submission tests passed. Exactly one score/status pair and receipt in the transaction facade. | PostgreSQL transaction/concurrency behavior and deployed backend revision require provider/staging evidence; no production fault injection. |
| QA-08 unpublished result privacy | PASS local API/source/browser checks | Submission receipt test asserts recorded receipt and no result object; source returns message plus receipt only. Applicant projection hides score/threshold before publication; publication and draft browser checks passed. Email receipt score-exclusion regression passed. | Inspect submission and applicant responses with a dedicated live test account before/after CAO publication. |
| QA-09 scope/list status | PASS locally; deployed displays found | Six authenticated retired endpoints return 410 with permission checks and no writes/success logs; list projections/history/report regressions passed. Browser public/private listed/unlisted displays, keyboard Payroll filter, ignored legacy paid flags and report list stages passed. Existing list-processing regressions passed. | Authorized hosted route/status/export checks; historical records retained, workflow ends at official list generation. |
| QA-10 connection recovery | PASS locally; deployed messages/receipt guard found | Shared transport/body/5xx/business-error tests passed. Browser seven admin views, applicant/scholar malformed reads, keyboard Retry, truthful empty states, retained sign-in/answer input, no automatic write replay and failed-load schedule autosave guard passed. Malformed/empty exam receipt did not produce success; explicit valid-receipt retry succeeded. | Authenticated hosted failure/recovery; use local/staging for deliberate failures. |
| QA-11 Hostinger guide | PASS documentation/source checks; local only | Package build/start, custom client/migration/direct URL, separate bootstrap, environment/storage/mail/fallback claims reviewed. Local links passed; all 11 built route fallback index files exist. Retired-provider provisioning text removed. | Operator comparison with private Hostinger build settings, secrets, backup/restore controls; no dashboard inspection or publication of QA-11 yet. |

## Executed checks

- Root `npm test`: **216 backend passed, one skipped; 69 frontend passed;
  zero failures**. The skipped case is the existing opt-in real-database school
  catalog migration test. Ordinary tests use synthetic fixtures/facades and local
  HTTP endpoints, not the deployed database.
- Frontend lint passed; production build passed and generated 11 route fallbacks.
  Existing large ExcelJS chunk warning remains; it is not a new test failure.
- Nine fresh local Chromium script runs passed: paper workflow; QA-02, QA-03,
  QA-04, QA-05, QA-06, QA-09, QA-10 and QA-10 invalid-receipt retry. API traffic
  was mocked in every run. Checked scripts reported no browser page errors;
  sampled mobile layouts had no horizontal page overflow.
- The older QA-04 browser harness expected its raw synthetic 503 message. This
  verification updated that harness expectation to QA-10's safe service-unavailable
  guidance; application code was not changed.
- QA-11 command/link/source assertions and whitespace checks passed. No production
  build/migration, database reset, real application/exam submission, email or
  payroll-list generation was performed as part of this verification.

## Public deployment observations

HTTPS frontend and API health returned HTTP 200. API reported `healthy` and
`database: connected`. Entry `/assets/index-BKe9Wwze.js` and stylesheet
`/assets/index-3GS4n9f_.css` were retrieved. Verified release markers in:

- `Dashboard-DyvZ4EJm.js`: paper score/publication controls, unsafe-bank warning,
  list-status controls and Data unavailable.
- `ExamPage-BoWz3Grd.js`: persisted 45-minute guidance, restored-answer guidance
  and positive recorded-receipt guard.
- `ScholarDashboard-uel46doy.js`: payroll-list inclusion language.
- Entry/CSS: tester retry/timeout guidance, safe connection messages and explicit
  dark input/caret color.

Direct requests to `/login`, `/applicant-dashboard`, `/scholar-dashboard`,
`/examination` and `/dashboard` returned HTTP 200. HTTP route status alone does
not demonstrate successful authenticated rendering. Asset markers confirm
published code presence, not execution of every protected workflow. Public
health neither identifies the backend revision nor independently confirms all
migrations. Prior user-reported backend deployment success is retained in the
register and was not promoted into independently verified evidence here.

## Next acceptance work

Use the dedicated-record steps in [qa-fix-register.md](../../qa-fix-register.md)
for protected hosted acceptance; use staging for forced database/network faults.
Confirm the saved bank and hosted deadline, publication privacy, real database
atomicity, private upload/mail and supported list generation with authorized
accounts. Compare the local [Hostinger guide](../../deployment-guide.md) with
provider settings. Preserve existing records, additive schema and the scope
boundary during rollback; this verification needs no application/data rollback.
