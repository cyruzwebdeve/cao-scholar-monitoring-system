# Workspace and Hostinger deployment scan - 2026-11-11

**TL;DR**

- The repository documents separate Hostinger frontend and API projects, with PostgreSQL and active Vercel Blob storage. The hosting dashboard and deployed revision were not verified during this scan.
- Six source issues were confirmed: school-classification authorization, sensitive error logging, unhandled document-stream errors, stale payroll eligibility, obsolete API models, and stalled session validation.
- Payroll-list generation remains the scope boundary. Staff attendance and Scholar-owned acknowledgements stay separate; legacy payment-release routes return 410.
- Local synthetic probes reproduced backend defects, and 160 backend/launcher JavaScript files passed syntax parsing. Full tests, lint/build, schema validation, vulnerability lookup, and public availability checks remain incomplete because of environment and approval-service failures.

## Scope and evidence

Reviewed local `main` at `b022c54`, package manifests, application source, middleware, Prisma application schema and migrations, build scripts, routing, deployment documentation, and QA records. Source findings describe this checkout; they do not establish that the same behavior is currently deployed.

No application source, production settings, database records, mail, or Blob objects were changed. A local application Prisma client was generated with a dummy database URL to support inspection; this did not deploy migrations. Existing untracked notes were left untouched. This report and the matching development-log entry are the only tracked-source documentation additions/changes.

## Architecture and deployment

| Area | Repository implementation |
| --- | --- |
| Frontend | React 19, Vite 8, React Router, lazy portal routes; browser-generated CSV/XLSX/PDF/Word exports |
| API | Node.js/Express 5, JWT authentication, database-derived roles and section permissions |
| Database | PostgreSQL through Prisma 6.19.3 and its PostgreSQL adapter; custom client from `schema.application.prisma`; 34 committed migrations |
| Storage | Private Vercel Blob scholar documents; separate public announcement-image store |
| Mail | Gmail API OAuth with optional SMTP fallback; scheduled notification workers |
| Hostinger frontend | `frontend` root; Node 22 recommended; `npm ci --include=dev`, then `npm run build`; publish all of `dist` |
| Hostinger API | `backend` root; `npm ci --include=dev`, then `npm run build`; `npm start`; production/cloud environment |

The backend production build generates the custom client before deploying committed migrations, preferring `DIRECT_URL`. Failures stop the build. The ordinary Hostinger build does not run account bootstrap. The repository-root `build:backend` only generates a client and is not the production migration build. `render.yaml`, `render-build`, and `frontend/vercel.json` are retained legacy hosting configurations; Vercel Blob remains active.

All 12 named frontend routes have generated static fallbacks, including phone capture. Some frontend modules import repository-root catalogs, so the build needs the complete checkout even when its working directory is `frontend`.

## Confirmed source findings

### S-01 - High: restricted staff can change global school classifications

**Evidence:** `backend/routes/applicationRoutes.js:120` limits catalog reading to SuperAdmin, while line 131 allows RegularAdmin and BillingPayrollAdmin classification writes without an assigned-section check. `backend/controllers/applicationController.js:1946` performs the write without a further authority check.

**Reproduction and impact:** Local Express probes used the real routes and role middleware with substituted authentication and a fake database. Report-only RegularAdmin and BillingPayrollAdmin accounts received catalog GET 403 but classification PUT 200 and executed the fake write. School classification influences requirements, list routing, and grant defaults.

**Recommended change:** Make write authorization consistent with intended catalog authority and verify restricted accounts cannot change classification. No production classification was changed during testing.

### S-02 - Medium: malformed requests can expose sensitive bodies in logs

**Evidence:** `backend/server.js:99` logs the complete error object. Express JSON parse errors carry the malformed request body.

**Reproduction and impact:** A synthetic malformed login request demonstrated that default error rendering includes a supplied password marker. Hostinger application logs could therefore collect passwords, personal data, or document payloads when JSON parsing fails. No real credential or applicant data was used.

**Recommended change:** Return a controlled malformed-JSON response and log only safe error metadata. Apply the same logging discipline to controller errors.

### S-03 - Medium: failed private-document streams can terminate the API

**Evidence:** `backend/controllers/documentReviewController.js:223` calls `Readable.fromWeb(blobResult.stream).pipe(res)` without handling source-stream errors or awaiting a pipeline.

**Reproduction and impact:** A synthetic failed Web stream triggered `uncaughtException`. Errors emitted after piping escape surrounding asynchronous catches; no application exception handler was found. A Blob/network interruption during authorized document retrieval can terminate the API process.

**Recommended change:** Await a stream pipeline and handle errors, partially sent responses, and client disconnects. Retain the existing document ownership and private-cache controls.

### S-04 - Medium: payroll generation can use stale eligibility

**Evidence:** `backend/controllers/applicationController.js:1355` reads period and eligibility data before the transaction at line 1432. `backend/services/processingRoute.js:9` refreshes requirements but reuses the previous school classification, application data, and period. The Billing generation path also uses this pattern; the reproductions below exercised Payroll.

**Reproduction and impact:** Offline probes using the existing payroll-test facade changed state immediately before the transaction. Archiving the selected period still generated one list with HTTP 201. Changing a Public school to Private also returned 201 with the previous Public list amount and without the newly required Private grant preparation. These were synthetic records and amounts, with no live database access.

**Recommended change:** Re-resolve the active period, Scholar/applicant state, school identity/classification, and relevant eligibility inside the transaction before snapshots and list creation. Serializable isolation does not protect earlier reads made outside the transaction.

### S-05 - Medium: exposed legacy endpoints use an absent Prisma model

**Evidence:** `backend/controllers/applicationController.js:386` and the older requirements/activation handlers use `prisma.scholar`, absent from the application schema and generated client. Their routes remain exposed in `backend/routes/applicationRoutes.js`.

**Reproduction and impact:** A local fake-database probe of `GET /applications/1` returned 500; client metadata confirms the missing model. The current frontend uses `/applications/me`, so these findings do not establish a failure in the current portal's normal application read flow.

**Recommended change:** Identify necessary consumers, then explicitly retire unused endpoints or migrate supported contracts to current models. Do not restore retired payment behavior during cleanup.

### S-06 - Medium: saved-session validation can block all routes indefinitely

**Evidence:** `frontend/src/App.jsx:82` fetches `/auth/me` and reads its JSON body without a timeout or AbortController. Line 180 displays only the session-check loading state until the request settles, with no retry/sign-out control.

**Trigger and impact:** A stalled API connection or response body leaves visitors with saved credentials unable to reach any route. The tester gate's separate ten-second deadline does not cover this session request. Confirmed by source inspection; no live stalled session was induced.

**Recommended change:** Bound both fetch and body reading, provide clear recovery controls, and prevent stale results from replacing newer session state.

## Conditional deployment risks and follow-up observations

- **Production localhost fallback:** `frontend/src/services/api.js:3` defaults to `http://localhost:3601/api` when `VITE_API_BASE` is absent. Builds have no production guard, so a misconfigured Hostinger rebuild can succeed while visitors' requests target their own computers. Current hosted settings were not inspected. Validate the production API base during build.
- **Old lazy chunks:** `frontend/src/App.jsx:8` uses lazy imports with Suspense but no error boundary or `vite:preloadError` recovery. If deployment removes previous hashed assets, old open tabs can fail when entering an unloaded route. Hostinger asset retention was not verified; add controlled recovery or verify retained assets.
- **Temporary-password hardening:** `backend/controllers/applicationController.js:198` and `frontend/src/components/ApplicationForm.jsx:366` use `Math.random()` for generated passwords. Application submission accepts a provided password without the recovery flow's password policy. Use cryptographic randomness and consistent server-side validation; assess first-login password replacement separately.
- **Retained test-data migration:** `backend/prisma/migrations/20260909000000_seed_billing_payroll_demo/migration.sql` intentionally creates labelled active dummy Scholars and test schools with disabled login. Current Scholar/list/report queries do not exclude these fixtures. Production retention was not inspected; confirm with the operator before planning cleanup. Do not edit an already applied migration or delete records as part of this scan.
- **Local versus migrated schema:** Local provisioning uses `prisma db push`, which does not reproduce migration-only SQL constraints/triggers. Synthetic tests and local provisioning cannot establish production migration parity.
- **Stale scope documentation:** `docs/scope-boundary-audit.md` still forbids receipt recording and describes some legacy routes as awaiting retirement. The current October instructions approve Scholar-owned acknowledgements, and six legacy routes now return 410. Update the audit in a separate documentation correction.

## Scope and existing protections

Legacy payment mutations are disabled with authenticated 410 responses and no business writes. Legacy payment columns and an unused compatibility helper are retained. The scan did not remove or re-enable them.

Scholar acknowledgements derive ownership from `req.user.id`, require published schedule recipients and saved Payroll membership, and use version checks with serializable transactions. Staff attendance has a separate table and session key. Neither updates legacy payment state or changes Reports monetary totals into released-money totals.

Other protections found include production JWT-secret checks, database-derived roles and authentication versions, hashed password-reset tokens, private document ownership checks, validated document types/sizes, bounded inspection workers, tester access, CSV formula neutralization, and literal-string XLSX exports. These observations do not constitute a complete penetration test.

## Validation and limits

| Check | Result |
| --- | --- |
| Backend/launcher JavaScript syntax | Passed: 160 files parsed without executing application code |
| Custom Prisma client generation | Passed using a dummy local URL; no migrations or database connection |
| Backend authorization, obsolete-model, parse-error, and stream probes | Defects reproduced using synthetic inputs/fake dependencies; no production writes |
| Payroll race probes | Defect reproduced in the existing fake-database facade; real database concurrency unverified |
| Standard test launcher | Attempted; child test processes were blocked with `spawn EPERM`, so no suite pass/fail conclusion |
| Frontend lint/build | Dependencies were already missing before the installation attempt; lint could not start; locked install failed due unavailable registry/cache access; build not run |
| Prisma schema validation | Incomplete: required engine download was blocked |
| npm vulnerability audit | No result; external check was not executed |
| Public frontend/API availability | Initial fetches failed in this environment; authorized retries were not executed; no claim of production outage |
| Hostinger dashboard, exact deployed revision, authenticated acceptance | Not inspected |

The user explicitly authorized retries of local/read-only checks. Automatic approval review nevertheless failed twice with a `content-blocked` service error, preventing the elevated test, install, audit, and availability commands from executing. The tool described this as a review failure, not a determination that those actions were unsafe. These checks remain pending.

## Recommended order and rollback

Address S-01 authorization first, then sensitive logging and stream error handling, then transactional eligibility and session recovery. Review consumers before legacy endpoint retirement. Add meaningful regressions for the permission, stream, malformed-body, transaction, and stalled-session cases; complete normal lint/build/tests once the execution environment is available. Verify hosted builds and authenticated workflows with dedicated test records before asserting production fixes.

This scan is documentation only. Removing the new report and development-log entry reverses its tracked changes; no schema or production rollback is needed. Preserve existing migrations, applicant history, attendance, acknowledgements, storage, and secrets in any subsequent implementation.
