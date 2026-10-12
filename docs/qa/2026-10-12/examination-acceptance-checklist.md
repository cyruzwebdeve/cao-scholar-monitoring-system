# Examination boundary fixes: acceptance checklist

Date: 2026-10-12 (Asia/Manila). Use dedicated synthetic test applicants and
CAO-authorized accounts. Run scenarios needing changed global delivery/primary
period settings, terminal-state fixtures, historical results or deliberate
concurrency in staging; these settings affect other examinations. Do not reset
production attempts or edit real applicant scores to create a test condition.

## Release readiness

1. Confirm Hostinger frontend and backend builds both succeeded for the release
   recorded in the fix register. No new migration is required; existing attempt
   and result-publication migrations remain prerequisites.
2. Hard-refresh browser tabs (Ctrl+Shift+R), then sign in with tester access if
   enabled. Use SuperAdmin or an examination-authorized BillingPayrollAdmin for
   scholarship acceptance; examination-authorized RegularAdmin can review scores
   but its existing route permission does not allow acceptance.
3. Check API health separately. Healthy/connected proves connectivity, not the
   exact backend revision or authenticated workflow correctness.

## 1. Normal paper path and exact reviewed acceptance

- In the primary academic year, use a dedicated applicant assigned to its
  municipality schedule. Mark Present. Applicant shows For review, with no score.
- With paper delivery, use Results → Record paper score; enter a test score at
  or above the configured passing score and recording remarks. Save for review.
- Before publication, applicant sees review guidance; score/threshold remain
  hidden and acceptance is unavailable.
- Publish the reviewed result. Applicant sees the correct score and Passed,
  without automatic scholarship acceptance.
- As authorized acceptance staff, review the eligibility recommendation and
  enter a reason if required; use Accept as Scholar. Expect one active scholar,
  decision snapshot and requirements handoff. Repeated acceptance must not create
  another account/decision. The result becomes locked after acceptance.
- Optional DevTools Network check: acceptance POST contains applicationId,
  academicPeriodId, examId, resultId, updatedAt and reviewReason. Never copy
  Authorization headers, tokens or real applicant responses into test notes.

## 2. Stale review/correction protection (EXAM-01)

Use another passing published test result that has not been accepted.

1. Browser A: open Results detail as acceptance-authorized staff; leave the modal
   open with the passing published revision.
2. Browser B: correct that same result with a reason, changing the score below
   its threshold. Correction must reset publication.
3. Without refreshing A, click Accept as Scholar there.
4. Expect a changed-result/reload error (HTTP 409), no scholar activation and no
   accepted decision from that stale request. Refresh A and confirm the new score
   is under review and acceptance is unavailable.
5. In staging, also exercise simultaneous correction and acceptance. Both
   incompatible operations must not commit. If acceptance wins, correction is
   locked; if correction wins, stale acceptance fails. An aborted serialization
   conflict requires fresh review/manual retry, not automatic acceptance replay.

## 3. Historical result isolation (EXAM-02)

Use a staging fixture with a current-year applicant/application and a published
passing prior-year result, but no current-exam result.

- Current Results and applicant examination view must show the current schedule/
  attendance and no current score; they must not use the historical Passed result.
- Acceptance of the prior-year exam/result must be rejected (409). A controlled
  API test needs an authorized staff session and exact review fields; do not
  manufacture historical production rows to run it.
- After completing/recording and publishing the current test exam, only that
  reviewed result can support acceptance. Existing historical records remain.

## 4. Terminal application guards (EXAM-03/04)

Use staging fixtures for Withdrawn, Rejected and Declined, with a Present slot
and otherwise open online schedule.

- Direct question loading must fail (403), return no question bank/ticket and
  create no new attempt start/deadline.
- For a separate attempt started while Applied, change its test application to
  Rejected/Declined/Withdrawn before submission. Submission must fail (409),
  preserve that application decision, record no result and send no receipt.
- Unknown/missing application states must also fail closed. Inspect fixture
  records after rejection; a visible error alone does not prove no writes.

## 5. Primary academic period (EXAM-05)

In staging, keep one active primary year and a different active secondary year.
Update the secondary more recently without making it primary.

- Schedule/assign the paper test applicant in the primary year.
- Record, correct and publish its paper result. All must succeed with normal
  permissions/revisions rather than rejecting it as the wrong academic year.
- A secondary-year result must not qualify a primary-period acceptance. If the
  primary changes after staff loaded a review, that old acceptance request must
  receive 409 and require reload.

## 6. Online deadline, recovery and expired dashboard (EXAM-06)

Use a new dedicated online attempt with an approved objective bank and Present
attendance. Start within a schedule that remains open for the full test.

- First load starts the saved 45-minute deadline. Answer questions, refresh and
  reopen in the same browser: deadline remains and draft answers restore.
- For a normal submission before expiry, expect a recorded receipt, automatic
  computation and result under review; no unpublished score in the receipt or
  applicant dashboard. CAO publication and acceptance remain separate steps.
- For a different test attempt, leave it unsubmitted until its real deadline
  passes. Do not edit the production deadline to accelerate the test.
- Refresh applicant dashboard: status is Attempt expired; guidance says contact
  CAO; no Start/Continue examination action is available. Direct question loading
  must return 410. Late answers cannot be submitted.
- Expiry must not automatically create a zero score, fail/publish a result or
  reset the attempt. Existing completed/published and accepted scholar records
  keep their corresponding states.

## Record results

For each scenario record environment, release, PASS/FAIL, expected/observed
behavior and non-sensitive evidence. Record controlled fixture identities only;
exclude real names, credentials, answers/keys and private documents. Update the
[fix register](../../qa-fix-register.md) with actual authenticated acceptance.
Automated/synthetic checks are already recorded; private provider and hosted
acceptance confirmations must remain identified separately.
