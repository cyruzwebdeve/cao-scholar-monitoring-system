# QA Fix Register

Updated: 2026-10-12 (Asia/Manila). This register covers the October 11 QA findings and their fixes. Detailed implementation, impacts, validation and rollback are recorded in [development-change-log.md](development-change-log.md). A deployed fix is not a substitute for a controlled authenticated acceptance test.

| Finding | Fix or remaining work | Release | Status and evidence |
| --- | --- | --- | --- |
| QA-01 · P1 · First paper score missing | Exam-specific first-score entry, reasoned corrections, review history and explicit CAO publication. Applicant attendance, examination outcome and scholarship acceptance are separate; scores stay private before publication. | `bf432de` | Deployed; public frontend verified and Hostinger success reported by user. Local paper workflow passed; real authenticated acceptance test pending. |
| QA-02 · P1 · Arbitrary text receives credit | Identification requires accepted answers; automatic banks reject essays/completion credit. Unsafe starts/submissions cannot write results. CAO must explicitly correct the 20-point bank. | `319d0e3` | Deployed; public frontend verified and backend success reported by user. Live legacy marking reported by user; saved bank/keys and real grading were not independently inspected. |
| QA-03 · P1 · Timer unenforced | Persisted 45-minute start/deadline/question version; refresh and concurrent tabs cannot reset it. Server rejects expired submissions; page and submit dialog lock at expiry. | `9a30827` | Deployed; live timer bundle/API checked and backend/migration success reported by user. Controlled real timed attempt pending. |
| QA-04 · P1 · Refresh loses answers | Per-edit same-browser drafts bound to authorized applicant/exam/slot/version/start/deadline; restore after refresh/tab reopening; leave warning and storage-failure guidance. Submission, expiry and sign-out cleanup. | `3b9030e` | Deployed; recovery bundle verified live and backend success reported by user. Synthetic recovery/cleanup passed; authenticated live acceptance test pending. Cross-device recovery excluded at user's request. |
| QA-05 · P2 · Tester verification hangs | Ten-second status/unlock timeout including JSON-body reads; clear manual retry, retained code after timeout, request cancellation and stale-response guards. Failed/malformed/missing-token responses keep gate locked. | `3b9030e` | Deployed; gate timeout/cancellation code verified live and backend success reported by user. Synthetic timeout/retry passed; hosted controlled failure test pending. |
| QA-06 · P2 · Tester-code contrast | Explicit dark input foreground/caret; rendered contrast improved from 4.31:1 to 12.54:1. | `81660a3` | Deployed; dark input/caret declarations verified in the live stylesheet and frontend/API healthy. Local keyboard/error/mobile checks and lint/build passed. Axe sampled gate: zero violations, 23 passing rules, one incomplete contrast review; broader accessibility remains unverified. |
| QA-07 · P2 · Online result/status writes not atomic | Transactional score/status commit; rollback on failed or zero-row status update; existing unique slot blocks simultaneous duplicates. Receipt follows commit. | `6ef9bb7` | Deployed; user confirmed Hostinger backend success for this release. Public frontend HTTP 200 and subsequent API/database health check passed. Backend 209 passed/one existing database skip and frontend 56 passed. Synthetic rollback/retry/concurrency checks passed; hosted database acceptance pending. |
| QA-08 · P2 · Submission leaks unpublished result | Return only submission receipt; applicant score/threshold remain hidden until CAO publication. | `bf432de` | Addressed with QA-01; regression tests passed and release deployed. Authenticated privacy acceptance test pending. |
| QA-09 · P2 · Legacy payment/release routes outside scope | Six legacy endpoints retired with authenticated 410 replies; obsolete handlers/AdminPanel removed. Supported portal/history/filter/report displays stop at certification/payroll-list generation; historical data retained. | `3a9391a` | Deployed; new frontend assets verified live, API/database healthy and user confirmed Hostinger backend success. Backend 216 passed/one existing database skip, frontend 57 passed, lint/build and synthetic scholar/filter/report/mobile checks passed. Controlled authenticated live acceptance pending; no new migration. |
| QA-10 · P3 · Raw connection errors | Shared API transport/timeout/unreadable/5xx guidance; preserve business errors. Suppress failed-load empty/zero conclusions; retain unconfirmed write input, require exam receipt and block schedule autosave after failed initial loading. | `3b9030e` tester gate; `709e770` broader fix | Deployed for testing; new frontend error/dashboard/receipt assets verified live and API/database healthy. Backend 216 passed/one existing database skip, frontend 69 passed, lint/build and synthetic failure/retry/keyboard/mobile/receipt checks passed. No backend or migration change. Authenticated hosted acceptance pending. |
| QA-11 · P3 · Outdated deployment guide | Replace retired hosting instructions with verified current Hostinger commands, build/migration sequencing and checks. | `105eec6` | Hostinger guide, README and environment comments published with the examination release; command/source/link review passed. Documentation adds no runtime/configuration/schema change. Private provider settings remain operator verification. |

## Latest verification — 2026-10-12

[QA-01–QA-11 verification report](qa/2026-10-12/fix-verification.md): all checked local regressions passed (216 backend, 69 frontend; one existing opt-in database skip), lint/build passed, and nine synthetic browser scripts passed. QA-11 source/command/link checks and all 11 built route fallbacks passed. Public frontend assets contain expected fix markers; five direct routes and API health returned HTTP 200 with database connected. No authenticated production acceptance, private provider inspection, deployment or production record mutation was performed. Existing per-QA live acceptance limitations above remain.

## Examination process boundary review — 2026-10-12

[Beginning-to-end examination review](qa/2026-10-12/examination-process-review.md) reproduced six additional gaps outside the earlier regression coverage: acceptance can use a stale or historical result; online submission can overwrite Rejected; withdrawn applicants can start questions; paper result review can choose a secondary active period; expired attempts still appear accessible. Release `105eec6` publishes the six fixes: exact review-bound Serializable acceptance/current-result projections, shared application-state guards, primary-period selection and expired portal status/access. Verification: 231 backend passed/one existing database skip, 70 frontend passed, lint/build and six synthetic browser runs passed. No new migration; matching release pushed, new exact-review/expired frontend assets verified live and API/database healthy. User confirmed successful Hostinger backend deployment for `105eec6`; real database concurrency and authenticated hosted acceptance remain pending. Follow the [acceptance checklist](qa/2026-10-12/examination-acceptance-checklist.md). Additional no-show/global-setting/calendar incident policies are unchanged.

## Announcement feature review — 2026-10-12

[Announcement QA report](qa/2026-10-12/announcement-review.md): ANN-01–ANN-08 and the requested Post Now action are implemented in release `1c5b486`, pushed for testing. Reproduced hidden urgent scholar notices, priority loss beyond 50 candidates, stale edit overwrites, expired archive validation failure, silent applicant load failure, server image-size mismatch, misleading visible counts and implicit browser timezone. Seven temporary controller/route probes (including defect reproductions), four named URL regressions and synthetic browser checks completed. Public frontend/API health and unauthenticated tester-gate protection passed; authenticated hosted content/storage remains unverified. Validation: 241 backend passed/one existing skip, 72 frontend passed, lint/build and synthetic action/conflict/archive/portal/timezone/mobile checks passed. Matching release pushed; new actions/PHT/retry frontend assets verified live and API/database healthy. Hostinger backend provider confirmation pending; no new migration. Use the [announcement acceptance checklist](qa/2026-10-12/announcement-acceptance-checklist.md); authenticated hosted/cloud-storage acceptance remains pending.

## Individual scholar certification placement — 2026-10-12

Existing private-school individual PDF action moved to the Scholar drawer header beside status badges as Download Certification, available across tabs. Private-only eligibility/PDF content retained; no new Applicant/general certificate action. Lint/build and synthetic keyboard/PDF-content/mobile checks passed. Frontend-only release `9010a59` pushed; new drawer header/button assets verified live, old card absent and API/database healthy. No migration. Verify Scholars → View details for a private scholar → Download Certification; authenticated acceptance pending.

The drawer caption/amount and matching tooltip phrase were removed on 2026-10-12 following user feedback; certificate eligibility/PDF content retained. Lint/build passed; release `099a17f` pushed and caption/tooltip removal verified in live frontend assets; API/database healthy.

## Verification baseline

- QA-01: 196 backend checks passed, one existing opt-in database skip; 43 frontend tests; lint/build, schema/client and synthetic paper entry/correction/publication/applicant flows passed.
- QA-02: 199 backend checks passed, one existing opt-in database skip; 43 frontend tests; lint/build and synthetic bank correction/save/mobile checks passed.
- QA-03: 205 backend checks passed, one existing opt-in database skip; 45 frontend tests; schema validation/client generation, lint/build, deadline/concurrency and synthetic reload/expiry/mobile checks passed.
- Current QA-04/QA-05 combined state: 205 backend checks passed, one existing opt-in database skip; 56 frontend tests; lint/build passed. Synthetic browser tests covered all draft answer types, refresh/tab reopening, failed/successful submission, expiry/sign-out cleanup, hanging status/unlock recovery, invalid authorization, cancellation and mobile overflow. The existing ExcelJS chunk-size warning remains.
- QA-07: 209 backend checks passed, one existing opt-in database skip; 56 frontend tests. Transaction facade checks covered successful commit, rollback/retry, missing/withdrawn application and simultaneous/duplicate submissions; real hosted database isolation remains unverified.
- QA-09: 216 backend checks passed, one existing opt-in database skip; 57 frontend tests, lint/build and synthetic Chromium checks passed. Actual HTTP retirement/access checks, payment-field exclusion, list history/counts and filtering covered with synthetic fixtures. Existing list generation/eligibility regressions remain green.
- QA-10: 216 backend checks passed, one existing opt-in database skip; 69 frontend checks, lint/build and synthetic browser failure/retry checks passed. Sampled admin/portal recovery, uncertain write input retention, positive exam receipt, keyboard/mobile layouts and failed-load schedule autosave guard covered.
- QA-11: deployment guide checked against package/build/migration/start/fallback/configuration/storage/mailer/bootstrap sources and existing deployment evidence; local Markdown links and whitespace checked. Private Hostinger settings were not inspected.
- Synthetic/local verification did not use real applicant data, production database queries or real tester codes. Public checks inspect deployed assets and API health. Provider success is user-reported where stated; authenticated live workflows remain acceptance-test work.

## Reusable testing steps

1. Confirm matching Hostinger frontend/backend revisions and any required migration, then refresh old tabs. QA-04/QA-05 introduce no new migration; QA-03's attempt fields must already be present.
2. For paper: assign a test slot, mark Present, record a bounded score with remarks, verify applicant draft privacy, publish, correct/re-publish, and verify scholarship acceptance stays separate.
3. For online: save a CAO-reviewed objective 20-point bank with keyed identification. Open a dedicated test attempt, change answers, refresh/reopen in the same browser and confirm answers, original bank and deadline persist.
4. Verify a failed submission retains the draft, a successful submission clears it, and expiry prevents late writes. Confirm sign-out removes the draft. Use one examination tab; unavailable/cleared browser storage and other devices cannot recover it.
5. Simulate delayed/offline tester status and unlock requests. After ten seconds verify useful errors/retry, unchanged locked access, and successful recovery only with valid authorization.
6. For QA-07, submit a dedicated authorized online test attempt and verify exactly one result and Examined status. Use staging for forced write failures; never fault-inject the production database. Verify retry after rollback and simultaneous requests produce one result/receipt.
7. For QA-09, verify permitted legacy calls return 410 and unsupported roles retain 401/403. Confirm public/private list generation, list-status filters, scholar cards/history and report counts; no paid/claimed/released confirmation should appear in supported displays. Preserve historical records and operational logs.
8. For QA-10, use local/staging network controls to fail reads, return proxy HTML/5xx and restore service. Verify actionable guidance, no false empty/zero conclusions, keyboard Retry, retained input/drafts and no automatic write replay. Confirm exam success requires a recorded receipt and failed schedule loading produces no autosave request. Refresh old tabs after deployment.
9. Record acceptance-test outcomes and update this register with each future release. Preserve historical versions/results on rollback; do not generate fund-release or monetary-audit workflows.

## Automated verification command

Use `npm test` from the repository root for readable backend/frontend checks with PASS/FAIL summaries. `npm run test:backend` and `npm run test:frontend` select a suite. Setup, coverage and failure behavior are documented in [testing.md](testing.md). This launcher was added on 2026-10-11 and published in `81660a3`; running it does not deploy the application or replace controlled hosted acceptance tests.

## 2026-10-17 - Short reference deployment

Release `731eb63` updates both frontend and backend: new Billing/Payroll lists use durable short `BILL-` / `PAY-` batch references, while individual Private Scholar PDFs use the scholar-only `PGCEAP-CERT#` reference reused across periods. Existing stored list references remain intact. No migration or deployment configuration change is needed.

Frontend entry `/assets/index-Ctnlzoxh.js` and admin `Dashboard-C_5o1S_p.js` verified live with the new individual PDF reference code. API/database health passed. User confirmed successful Hostinger backend deployment for release `731eb63`; public health alone does not identify deployed code. Local backend/frontend regressions, database transaction/rollback/uniqueness checks, actual two-period PDF downloads, lint and build passed. No production records were mutated. Staff verification: [short references](qa/2026-10-17/short-references.md).

## 2026-10-17 - Scholar certificate notification layout

Frontend-only release `0ae5908` replaces tiny certificate feedback with a dismissible green success/red error card in the Scholar drawer. No backend changes, migration or configuration changes. Public admin bundle `Dashboard-CPP6EpD4.js` and stylesheet `Dashboard-C9Y2e9lc.css` verified new markup/readable styles; API/database healthy. Synthetic actual-component success/failure checks at desktop/mobile widths passed roles, keyboard dismissal, wrapping and retained PDF filename. Refresh the app and download a Private Scholar certificate to inspect the live card.

## 2026-10-17 - Shared notification layouts

Frontend release `264c2e6` standardizes 49 notification locations across 17 screens/components, retaining retry callbacks, blocking safeguards and input state. Shared success/error/warning/info/progress cards have readable copy, icons, keyboard controls and accessible roles. No backend, migration or deployment-configuration changes.

Shared `Notification-C4SK8V0v.js` / `Notification-BzWhuijy.css` and affected admin, phone-capture, examination, applicant and scholar bundles verified live; API/database healthy. Frontend regressions, lint/build, multi-width browser checks and synthetic capture/grant/passer/announcement retry workflows passed. No production writes were performed. Staff checklist and scope: [notification layouts](qa/2026-10-17/notification-layouts.md).

## 2026-10-17 - Continuing submission status card

Frontend release `a7529bc` applies the shared notification to Scholar drawer Continuing submission: amber closed, green open and blue pending initial verification, with existing guidance/access rules retained. No backend, migration or configuration changes. Actual drawer checks for all states at desktop/mobile widths, lint/build passed. Live `Dashboard-DlXRnK6R.js` verified all headings/reopening copy; API/database healthy. Refresh and check Scholar details.

## 2026-10-17 - Word-only Billing exports

Frontend release `ec32db5` removes Billing Export Excel, its column dialog and the Billing workbook generator. Official saved records, Word generation/history and Payroll configurable/official Excel are retained. No backend, migration or configuration change. Actual desktop/mobile Billing generation/history/failure-recovery and Payroll picker/workbook tests, frontend regressions, lint/build passed. Live `Dashboard-fp38YdaC.js` verified retired Billing XLSX markers absent and retained Word/Payroll paths present; API/database healthy. Refresh Billing and confirm only Word-list download actions; use dedicated test records for generation.

## 2026-10-17 - Billing history labels

Frontend release `2383775` renames the identified Billing card to BILLING RECORDS / Billing history, with matching empty-state wording. No data/download behavior, backend, migration or configuration changes. Source review, lint/build passed. Live `Dashboard-C1z9lA3t.js` verified new labels and retained Download Word; API/database healthy. Refresh Billing to verify the displayed headings.

## 2026-10-17 - Payroll form template

Frontend release `3700c75` recreates the supplied form for official Generate and configurable Export Excel: seven default columns, recorded amounts with unrecorded breakdowns blank, saved reference, blank signatures, actual totals and A4 landscape layout. Footer supports list preparation/review only. Billing remains Word-only; no backend, migration or configuration changes.

Six serialized workbook tests, frontend regressions, lint/build, desktop/mobile Payroll and Billing workflow checks, and small/large/single-column print rendering passed. Live entry `/assets/index-DfslC_Tk.js` and admin `Dashboard-BZnHDxDC.js` verified form captions, preparation safeguards and A4/list-only footer markers; API/database healthy. No production record writes. Native Excel/printer output remains for staff verification: [Payroll form checklist](qa/2026-10-17/payroll-form-template.md).

## 2026-10-17 - Payroll Word and both Excel exports

Frontend release `6643da7` makes Payroll Generate save the official batch then download the Billing Word template with Payroll reference and numbered two-column names. Payroll history supports Word re-download, including after failed initial download. Payroll configurable form Excel is retained; Billing configurable Excel preparation export is restored without Signature. No backend, migration or configuration changes.

Frontend regressions, Billing workbook artifact tests, lint/build, eight desktop/mobile mode/success/failure workflows and multi-school DOCX checks passed. LibreOffice rendered Payroll letters with preserved artwork/reference/list; one school one page, two schools two pages. Live entry `/assets/index-sk2wsdmR.js` and admin `Dashboard-DPObRlBy.js` verified Word mode/history, restored Billing Excel and retained Payroll form/export markers; API/database healthy. No production records changed. Staff steps: [Word and Excel verification](qa/2026-10-17/list-word-and-excel.md).

## 2026-10-17 - Complete Payroll Word batch

Frontend release `bf4dabe` fixes the apparent four-versus-one mismatch caused by inherited school-specific Word letters: Payroll now prints the entire batch together, continuously numbered in one two-column table, with a respective-schools introduction. Existing history re-downloads use the fix without regenerating records. Billing retains school letters; both Excel exports remain. No backend/migration/configuration changes.

Grouping/frontend regressions, lint/build, desktop/mobile four-scholar Generate/history/reloaded-history checks and actual Word rendering passed; all four names appear once together on one page. Live entry `/assets/index-tFI3njqE.js` and admin `Dashboard-CBZhoCvu.js` verify combined grouping/intro and retained paths; API/database healthy. No production records modified. Refresh and re-download the existing batch using [Word/Excel verification](qa/2026-10-17/list-word-and-excel.md).

## 2026-10-17 - Editable template signatory defaults

Frontend release `a43d6b8` fills the three Payroll Excel name lines and matching roles from the user-supplied template while retaining editable, unprotected text cells and list-only review wording. Word/Billing export paths and stored records remain unchanged. Existing Payroll artifact checks, lint/build, name replacement save/reopen and normal/single-column rendering passed. Live entry `/assets/index-CXTkRhgj.js` and admin `Dashboard-BHfrLp1Y.js` verify all three defaults; API/database healthy. No backend/migration/configuration changes or production record writes. Refresh and download Payroll Excel again; existing local files are unchanged.

## 2026-10-17 - Informational payout schedules

Release `cabab0c` adds Payroll batch-linked scheduling with municipality/school/name selection, independent venues, Philippine-time dates, private drafts, recipient preview, targeted Scholar dashboard cards and publish/update/cancel portal notifications. Published recipients are fixed; cancellation frees them for replacement. Revision checks, serializable writes and a partial unique active-recipient constraint protect concurrency. No release/claiming/disbursement state or external messaging. Requires additive migration `20261017010000_payout_schedules`; no new environment/configuration/dependency.

339 backend tests passed with one existing opt-in database skip; 22 frontend test files, lint/build, Prisma generation/validation, isolated SQL constraints/rollback, desktop/mobile/narrow scheduling and failure-recovery/queue-preservation flows plus eight existing export workflows passed. No production records changed. Frontend entry `/assets/index-BcgfHzUX.js`, admin `Dashboard-COj50L5g.js` and Scholar `ScholarDashboard-BPauVyP0.js` verified live; API/database healthy. Hostinger backend revision and migration confirmation remains pending and is required before hosted acceptance. Staff steps: [payout schedules](qa/2026-10-17/payout-schedules.md).

## 2026-10-17 - Payout schedule layout

Frontend release `88b66fd` refines the schedule header, two-panel editor, selected recipients, focused review with Preview badge, and separate saved cards; mobile panels stack. Hidden edit fields retain form state and Back to editing behavior. No backend/API/schema/migration or permission changes. All 22 frontend test files, lint/build and actual desktop/mobile/narrow schedule/Scholar/cancellation/error-retention flows passed. Screenshots inspected. Live entry `/assets/index-D4RMRgpm.js`, admin `Dashboard-whY41nPJ.js`, Scholar `ScholarDashboard-DHEnhyrj.js` and shared CSS `PayoutScheduleCard-BuLyHJAX.css` verify the new layout; API/database healthy. No production records modified. Original schedule backend/migration confirmation is still pending independently of this frontend-only release.

## 2026-10-19 - Hide phone pairing QR image

Release `0f36e7c` hides the initial-requirements pairing QR picture for Admins while retaining the phone capture link, transfers and session controls. Frontend only; no backend or migration. All 195 frontend tests, lint, production build and diff checks passed. Initial push attempts failed authentication/permissions. The retry confirmed release commits are now on origin/main. Public production verification passed: entry `/assets/index-ByaBRzQ9.js` and admin `Dashboard-CjT2K-_b.js` return HTTP 200; the new pairing heading and retained phone link are present, and the QR image alt text is absent. Authenticated browser acceptance has not been performed.


## 2026-10-19 - Hide phone camera start button

Release `a3c9935` hides the Use phone camera button in Admin initial-requirements intake using display:none. Existing session controls and direct capture/file selection are retained. Frontend only; no backend migration or configuration changes. Targeted component lint, production build and diff checks passed. Release pushed through the existing Hostinger main pipeline. Live entry `/assets/index-CnTd0ZPN.js` and admin `Dashboard-DxGoTUiY.js` returned HTTP 200; the phone camera button has display:none and the QR image remains absent. Authenticated browser acceptance has not been performed.


## 2026-10-19 - Remove empty phone camera placeholder

Release `4ba733f` omits the idle phone-camera wrapper from Admin initial-requirements intake. Active session controls and connection notices remain available. Frontend only; no routing change, backend migration or configuration change. Targeted lint, production build, actual idle component render and diff checks passed. Deployed through the existing Hostinger main pipeline. Live entry `/assets/index-Biepyr3J.js` and admin `Dashboard-DPqYDZNM.js` returned HTTP 200; the admin bundle contains the idle null-render guard before the phone-camera wrapper. Authenticated browser acceptance remains pending.

## Panel recommendation release — 2026-10-19

Test-access wording update prepared from current main for both Hostinger projects; no new migration. Existing security and workflow behavior remains unchanged. Release `5c872dd` passed 399 backend and 195 frontend tests (one existing backend opt-in skip), lint/build. Push blocked by missing GitHub credential helper/authentication; no deployment occurred. Public baseline: frontend HTTP 200 with existing entry asset, API healthy/database connected and protected API 401. Restore workspace GitHub authentication, push the prepared branch to main and verify new assets/backend wording.

Deployment follow-up: GitHub authentication restored; release `5c872dd` pushed through `98e33af` to main on 2026-10-19. Frontend HTTP 200 serves `index-CcOyDZZT.js` with both updated labels; protected API returns 401 with updated test-access wording. API healthy/database connected. No new migration; provider logs and authenticated acceptance not inspected.

## CAO logo login release — 2026-10-19

Frontend-only replacement of the authentication background photo with the existing CAO logo/green gradient and responsive sizing; shared recovery layout also affected. No new migration or backend change. Release checks: 399 backend tests passed with one existing opt-in skip; 195 frontend tests, lint/build and whitespace checks passed. Screenshot attempts did not complete; visual acceptance remains pending. Release prepared for authorized main/Hostinger push; live asset checks follow.

Deployment verification: `67ef6ca` pushed to main; `/login` HTTP 200 and `index-VSVQM8_N.js` loads `AuthPageShell-CNX1YsEp.js` / `AuthPageShell-C8JaHEyZ.css` with updated logo size hints, green gradient and phone sizing. Old background photo/decorative ring absent from shell assets. API healthy/database connected. Public asset checks only; rendered appearance, provider logs and authenticated login remain unverified.

## CAO logo placement release — 2026-10-19

Frontend-only desktop placement adjustment matching the supplied reference: 78vw diameter, -30vw right offset and vertical centering; mobile/tablet overrides retained. No backend change or migration. Lint/build and whitespace checks passed; release suite and live verification recorded after completion. Rendered browser acceptance remains pending.

Release checks complete: 399 backend passed, one existing opt-in skip; 195 frontend passed sequentially after an initial concurrent Vite cache rename collision. Affected eight-test file also passed separately. No application workaround or dependency change.

Release `053fde2` pushed successfully to main. Repeated checks of both public frontend hostnames still serve previous `index-VSVQM8_N.js` and `AuthPageShell-C8JaHEyZ.css` with old `min(46vw,660px)` width/inset-right placement. New placement is not verified live. API healthy/database connected. Provider build logs unavailable; inspect Hostinger frontend build for this release and recheck new rules after publication.

## Panel recommendation 3 — Complete requirements — 2026-10-19

Applicants-scoped potential-scholar queue with search/verification filtering, pagination and Examination-scoped navigation to existing explicit acceptance. Backend 406 passed/one existing opt-in skip; frontend 198 passed; lint/build and synthetic browser desktop/mobile/narrow/permission/review/acceptance/removal/error/retry passed. No new migration/configuration or automatic scholarship activation. Both projects need deployment; release and public verification follow. Hosted acceptance: [checklist](qa/2026-10-19/potential-scholars-acceptance.md).

Release `6852a44` pushed for testing. Frontend verified live: `/dashboard` HTTP 200, `index-DDeB_yzB.js`, admin `Dashboard-CE1ifoaU.js` with tab/endpoint/Potential scholar labels. API healthy/database connected; queue GET without authorization returns 401 from outer test gate. Backend revision/build and authenticated feature acceptance remain unverified; GitHub provides no provider checks. Confirm Hostinger backend build and follow the linked checklist before hosted acceptance. No new migration.

## Potential Scholars workflow correction — 2026-10-20

Explicit Results checking/add replaces automatic inclusion; persistent reviewed versions, selected-only confirmation (1–50), atomic acceptance/consumed markers, stale recheck flags and role-scoped final approval. Backend 416 passed/one existing skip; frontend 199 cases verified; lint/build and synthetic staging/selection/preview/conflict/permission/mobile checks passed. No migration. Matched frontend/backend testing deployment required; public verification follows. Existing individual API retained for compatibility, no longer called by Results UI. See revised hosted checklist.

Revision release `3543bdc` pushed for testing on 2026-10-20. Frontend `/dashboard` HTTP 200; `index-B2AAUVZc.js` / admin `Dashboard-D5hNQ1IX.js` contain explicit Add to Potential Scholars, selected-batch endpoint/confirmation and stale-review flags. API healthy/database connected; outer gate rejects unauthorized queue GET with 401. Backend revision/build and authenticated staged/batch hosted acceptance remain pending. No new migration.

## Panel recommendation 4 — Document formats — 2026-10-20

Consistent PDF/JPG/PNG, inclusive 6 MB per requirement; extension/MIME/signature and parser/decoder verification, bounded worker isolation, visible per-document guidance and preserved failed-upload drafts/files. Camera conversion retained. Backend 424 passed/one existing skip, frontend 204 passed, lint/build and synthetic browser replacement/proof/capture/mobile checks passed. Three pinned backend parsers; no migration/configuration change. Four dependency advisories match the previous lockfile and remain follow-up work. Frontend/backend testing release and public verification follow. [Hosted checklist](qa/2026-10-20/document-upload-acceptance.md).

Testing deployment: `bde0d34` plus `5900f32` pushed. New encrypted-PDF guidance regression passed (425 backend cases verified in total; one existing opt-in skip), frontend 204 passed. Live `/application` HTTP 200, `index-lM1DrnYL.js`, shared `documentFilePolicy-CIReGgvQ.js`, `ApplicationPage-CsP_jQ8b.js`, `ScholarDashboard-IfJGF5dC.js` and `PhoneCapturePage-DsHiCTTI.js` confirm new rules/instructions. API healthy/database connected. Hosted backend build/revision, authenticated file parsing/storage and the linked walkthrough remain pending; frontend assets/health do not establish these. No migration.

## Editable Billing/Payroll amounts — 2026-10-20

Panel recommendation 5, release `4895e1c`: staff can edit individual queued Scholar amounts before list generation; overrides are period-bound, defaults and historical lists are preserved, and Private allowances recalculate after tuition assistance. Migration `20261020000000_editable_list_amounts` adds the nullable override and dynamic consistency checks. Local 440 backend tests passed/one existing opt-in skip, 206 frontend tests passed; lint/build, Prisma validation, 13 isolated PostgreSQL migration checks and synthetic desktop/mobile/export acceptance passed. User authorized publication through the existing main-to-Hostinger pipeline. Published: `/dashboard/` serves `index-DsuDoAX4.js`; admin asset `Dashboard-B-ZRrUlH.js` contains the editor, save and amount-snapshot handling. API/database healthy. Hostinger backend revision, migration/build-log confirmation and authenticated acceptance remain pending; the failed GitHub deployment event belongs to retired Render, not Hostinger. Use [the acceptance checklist](qa/2026-10-20/editable-amount-acceptance.md). No fixture seeds or direct application-database writes.

## Inline Amount interaction — 2026-10-20

Recommendation 5 follow-up: the formatted amount is directly clickable and becomes an inline selected input; Enter/Save submits and Escape/Cancel discards. Separate Edit button/dialog removed. Existing backend, permissions, override column and list locking retained; no new migration. Frontend 206 tests, lint/build and synthetic Billing/Payroll direct edit, keyboard, stale-save retry, persistence, mobile and authoritative Excel export checks passed. Release `992b8dc` published through the existing testing pipeline; live entry `index-IUD1jaQj.js`/admin `Dashboard-D145e9sr.js` contain inline edit/keyboard/focus markers and omit the old dialog title. API/database healthy. Prior Hostinger backend revision/migration and authenticated acceptance remain pending.

## Billing/Payroll Amount layout — 2026-10-20

Fixed header/row alignment and duplicate horizontal scrollbars with a shared queue scroll container, consistent grid geometry, sticky header and more desktop queue space. CSS-only; no new migration. Frontend 206 tests, lint/build and synthetic 12-record, long-text, warning, inline edit, scroll alignment and export checks passed at 1440/1100/800/550/390/320 px. Release `5439b31` deployed; live dashboard `index-dAfswQvP.js`/stylesheet `Dashboard-DK7nxP4A.css` verify the single scrollport and sticky header rules. API/database healthy. Earlier backend/migration/authenticated acceptance remains separate.

## Compact Amount controls — 2026-10-20

Removed the wrapping keyboard helper caption, standardized the amount field and aligned equal-width Save/Cancel controls. Existing keyboard, validation, permission and persistence behavior retained; no new migration. Frontend 206 tests, lint/build and synthetic Billing/Payroll six-width helper absence, button geometry, error/retry, keyboard and export checks passed. Release `49ae153` deployed; live dashboard `index-DnOVyyyx.js`, editor `Dashboard-CAC2FIDr.js` and stylesheet `Dashboard-C0LN4qHS.css` verify helper removal and compact actions. API/database healthy.

## Amount value left alignment — 2026-10-20

CSS-only release `7321cfa` left-aligns the editable Amount value. Production build/generated CSS checks passed; live dashboard `index-Bj9Q6T8N.js` and stylesheet `Dashboard-CHofJ-fc.css` confirm text-align:left. API/database healthy. Controls, persistence, permissions and the existing migration remain unchanged.

## Direct amount text editing and retained queue layout — 2026-10-20

Replaced the number input/action row with direct editable amount text; restored normal row height and earlier panel proportions/compact Amount column, preserving aligned single scrolling. Enter/click-away saves, Escape cancels, unchanged values do not write, and Enter/blur cannot duplicate a save. Existing notification displays invalid/stale errors while retaining drafts. Frontend 206 tests, lint/build and synthetic Billing/Payroll text, paste safety, keyboard/blur, duplicate-event, persistence and six-width geometry checks passed. Release `5553a04` published; live dashboard `index-KoyphAp7.js`, editor `Dashboard-91E5VLsU.js` and stylesheet `Dashboard-ugicfzuI.css` verify direct editable text without boxed controls and compact/original queue proportions. API/database healthy. No new backend/migration.

## Amount pencil affordance — 2026-10-20

Displayed amounts now have a pencil icon beside the value instead of a dashed underline. Icon/value share the existing button and direct-text editor. Lint/build and synthetic Billing/Payroll icon-click, border, editing and six-width layout checks passed. Release `ac7a602` published; live dashboard `index-CJL26Od6.js`, editor `Dashboard-V2mW7HxQ.js` and stylesheet `Dashboard-BZ7DVwZO.css` verify the pencil affordance and absent dashed display underline. API/database healthy. No new backend/migration.

## Recommendation 7 Reports search — 2026-10-20

Implemented locally: searchable Scholar/current-metadata and historical list-reference report records, year filtering, ten-row pagination and exact filtered all-page CSV export. Existing analytics and default general exports retained. Frontend 212 tests, lint/build and synthetic desktop/mobile/search/history/year/export/retry checks passed. No new API/backend/migration or released-money reporting. Release `699b738` deployed; live dashboard `index-DI8tfRlK.js`, admin `Dashboard-D478TOun.js` and stylesheet `Dashboard-CwD9a2PD.css` verify search/export/history markers and styling. API/database healthy; authenticated hosted acceptance remains pending. Use [the acceptance checklist](qa/2026-10-20/report-scholar-search-acceptance.md). Existing Reports/management permission prerequisites remain.

## Payroll values and report layout — 2026-10-20

User retained payroll-list scope. Added saved payroll totals, recorded allocation totals, per-Scholar numeric breakdowns, combined search/year/status filtering and consistent all-page CSV, with a responsive summary/table layout and separate coverage overview. Unknown splits remain unknown; saved current membership overrides defaults, and certification/proposed values are excluded. Frontend 217 tests, lint/build, 11 focused report cases and synthetic desktop/mobile/filter/export checks passed. No API/backend/migration. Implemented locally, not deployed; use [the acceptance checklist](qa/2026-10-20/report-payroll-amount-acceptance.md) after publication.
