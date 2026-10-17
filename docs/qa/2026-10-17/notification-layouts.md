# Notification layout review — 2026-10-17

## Findings and changes

The source scan reviewed status/alert messages, notice/error state rendering and their CSS. It found bare paragraphs, neutral capture feedback for both failures and successful uploads, and cramped 9–10px action messages. A shared card now covers **49 notification locations across 17 screens/components**.

| Area | What was improved |
| --- | --- |
| Passer Lists | Processing, saved-list confirmation and errors |
| Initial requirement capture | Upload progress, completion, capture errors and camera/category/space warnings |
| Laptop phone pairing | Received pages/closed connection success and connection failures |
| Phone capture | Transfer success, capture/connection errors and expired connections |
| Private grant editor | Invalid amounts and save/receipt errors |
| Scholar drawer | Billing-period errors, grant loading/save confirmation and document-review feedback |
| Results | Examination result state, initial verification/loading and score/acceptance failures |
| Online question settings | Save/error feedback and legacy bank/item warnings |
| General/examination settings | Application availability, period, deadline and examination errors/successes |
| Examination page | Answer-recovery status/errors and submission-dialog errors |
| Examination attendance | Assigned-applicant loading failures |
| Billing/Payroll | Processing/download/queue action notices |
| Announcements | Save confirmation, list loading/retry and editor failures |
| Applicant portal | Initial-verification status and announcement loading/retry |
| Scholar portal | Requirement/update loading errors, retry and initial loading |
| Reports | Loading and load failure/retry |
| Document review dialogs | Individual and bulk decision errors |

Already designed login/recovery messages, application field errors, account/staff/catalog cards, portal toasts, photo tips, empty states, counters and the prior certificate card retain their existing layouts. Confirmation dialogs remain confirmations; this change does not replace them with notifications.

## Shared behavior

Cards use a readable 12px title/body, icon, border, padding and wrapping. Green indicates success; red is an error; amber is a warning; blue is information/progress. Titles/icons identify the outcome in addition to color. Errors use `role=alert`; other updates use `role=status`; the message is announced atomically. Progress animation respects reduced-motion settings.

Existing retry actions are preserved. Success/informational feedback may offer a named keyboard-accessible dismiss button; blocking errors and warnings remain visible where dismissal would hide a required correction. No auto-dismiss timer was introduced. Capture feedback receives an explicit outcome tone; messages are not classified by guessing words in server text.

## Verification performed

- Frontend regression suite, ESLint and production build passed; existing build-size advisory remains.
- Actual browser rendering at 1280px, 390px and 320px passed all five tones, error/status roles, 12px message text, long-reference wrapping, no card overflow, action callbacks, Enter dismissal and reduced-motion behavior. Screenshots were visually inspected.
- Actual grant editor: a mocked failed save retains the entered tuition assistance and shows the red error at desktop/mobile widths.
- Actual initial capture: unsupported-file errors show red; a mocked upload shows green success. Required academic period and upload route remain unchanged.
- Actual phone capture: a synthetic photo transfer keeps the requirement key and displays green success at desktop/mobile widths.
- Actual Passer Lists: a synthetic draft-save keeps the draft/member payload and displays success at desktop/mobile widths.
- Actual Announcements: a failed list load displays an error with Retry; retry makes the original read and clears the error after success at desktop/mobile widths.
- Existing actual Scholar drawer checks passed Add to Billing success, grant-save retry, metadata-save retry and separate Payroll preparation. Amount entry, computed allowance, handoff order and input retention remain intact.

All workflow requests used local synthetic API fixtures. No production records or documents were changed. Frontend release `264c2e6` is deployed. Shared `Notification-C4SK8V0v.js` / `Notification-BzWhuijy.css` and affected admin, phone, exam, applicant and scholar bundles were verified live, with healthy API/database. No backend changes or migration are required.

## Staff checks after deployment

1. Hard-refresh the app. In Scholar → Billing & Payroll, enter an invalid tuition amount and confirm the readable error. Correct it and perform the normal test preparation; confirm its success card.
2. In initial capture, choose an unsupported file and confirm red feedback. Complete an authorized test upload and confirm green feedback and upload progress.
3. Pair a phone and transfer a test photo. Confirm the phone and laptop messages distinguish success from connection problems.
4. Save a test passer-list draft and check confirmation. Check Results initial-verification guidance and question-bank warnings.
5. Check normal Billing/Payroll and announcement operations for readable feedback. In local/staging network tests, confirm error Retry controls preserve their behavior.
6. Repeat on a narrow phone. Confirm messages wrap, controls remain reachable, dismissible feedback closes by keyboard and blocking errors remain visible.

These public and synthetic checks do not replace authenticated acceptance testing of every message on every role/device. Physical camera hardware and screen-reader announcements were not exhaustively tested. No payroll eligibility, grant computation, deadline, exam timer/submission or list-locking rules were changed.
