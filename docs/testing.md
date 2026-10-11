# Automated Testing

Run these commands from the repository root:

```bash
npm test
```

Run just one side:

```bash
npm run test:backend
npm run test:frontend
```

The terminal shows each real test name with a check or failure mark, its duration, counts of passed/failed/skipped tests, a PASS/FAIL label for each selected suite, and an overall result. Labels use color when the terminal supports it; `NO_COLOR` disables launcher colors. Redirected output remains readable.

Example output (abbreviated; timings and counts change as tests are added):

```text
RUN  Backend workflows and permissions
✔ expired attempts cannot reopen, refresh their deadline or write late results
PASS backend test suite

RUN  Frontend behavior and recovery
✔ reload restores each answer type and per-question edits preserve the existing draft
✔ a stalled verification is aborted and receives retry guidance
PASS frontend test suite

PASS All selected test suites passed.
```

These are the existing automated checks, not a demonstration with hard-coded successes. Failures include Node's assertion diagnostics, display FAIL, and return exit code 1 for CI or scripts. Invalid suite selection returns exit code 2. Both suites run even if the first fails, unless interrupted.

## Setup and coverage

Use the project's supported Node.js version (20.19 through 24.x), install the backend/frontend dependencies and generate the application Prisma client before the first run:

```bash
npm --prefix backend ci
npm --prefix frontend ci
npm --prefix backend run prisma:generate
```

Prisma generation uses the development configuration; it generates code without deploying migrations. A fresh environment lacking DATABASE_URL can provide a dummy URL for generation, such as `postgresql://test:test@127.0.0.1:5432/pgceap_test`.

The root runner supplies that dummy URL to its child test processes and disables the opt-in catalog database migration test. Ordinary tests use fixtures/facades; some authorization/browser-module tests bind a local HTTP port. No deployment, real mail, production migrations or live applicant operations are part of this command. Database integration remains a separate explicitly configured test.

Coverage includes permissions, authentication, examination eligibility/grading/publication, timed attempts, answer draft recovery, tester access, school catalog behavior and payroll-list processing. The ordinary backend command `npm --prefix backend test` remains available with its original reporting/configuration. Unit and feature checks do not replace authenticated browser QA, accessibility checks or controlled hosted acceptance tests. Current fix/acceptance status is recorded in [qa-fix-register.md](qa-fix-register.md).

Verified on 2026-10-11: 205 backend checks passed, one existing opt-in database test skipped; 56 frontend checks passed. A temporary failing test also verified FAIL reporting and exit code 1, and was removed afterward.
