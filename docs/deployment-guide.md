# Hostinger deployment and recovery guide

Updated 2026-10-12. This is the operational guide for the existing PGCEAP
installation, whose workflow ends at CAO generation of the official payroll
list. It does not introduce payment release or monetary auditing.

## Current layout and evidence

| Component | Current location / responsibility |
| --- | --- |
| Frontend | Hostinger, https://cnpgceap-sms.com/; separate `frontend` project root |
| API | Hostinger, https://api.cnpgceap-sms.com/api; separate `backend` project root |
| Database | Existing managed PostgreSQL database, accessed through backend-only connection strings |
| Scholar documents | Existing private Vercel Blob store, accessed through authorized backend routes |
| Announcement images | Existing public Vercel Blob store |
| Source | `cyruzwebdeve/cao-scholar-monitoring-system`, branch `main` |

Recent authorized pushes to main published new frontend assets; the user
confirmed successful Hostinger backend builds and QA-03 migration completion.
Earlier deployment records establish the separate roots and standard backend
build. Source scripts establish the commands and sequencing below. Public
checks establish availability, not the backend revision, private provider
settings or database/storage account ownership. Confirm those settings in the
existing Hostinger projects before changing configuration; the dashboard was
not inspected directly for this documentation update.

Vercel frontend and Render API hosting instructions are retired. The retained
`render.yaml` and `frontend/vercel.json` are legacy provider configurations,
not instructions to provision replacement services. Vercel **Blob storage**
remains an active dependency despite the frontend hosting move.

## Build and runtime settings

Use Node.js 22 (within both packages' supported range `>=20.19 <25`). Keep
frontend and backend roots independent: Hostinger may package each root in
isolation, so backend runtime imports must remain inside `backend`.

| Setting | Frontend project | Backend project |
| --- | --- | --- |
| Root | `frontend` | `backend` |
| Dependency installation | `npm ci --include=dev` | `npm ci --include=dev` |
| Build after installation | `npm run build` | `npm run build` |
| Output / runtime | Publish `dist` as static files | Start with `npm start` (`node server.js`) |
| Production target | Vite production build | `NODE_ENV=production`, `DATABASE_TARGET=cloud` |

These commands are relative to each project root. If Hostinger combines install
and build into one command, use `npm ci --include=dev && npm run build`.
Confirm its actual install/build/start fields in the existing project; do not
add a second deployment pipeline. The repository-root `build:backend` script
only installs/generates the client and is **not** the production migration
build. `render-build` is the legacy Render sequence and also invokes bootstrap;
it is not the standard Hostinger build.

Frontend `npm run build` runs Vite and creates static index fallbacks for the
listed client routes, including `/login`, `/dashboard`, `/application`,
`/applicant-dashboard`, `/scholar-dashboard`, `/examination`, `/exam`,
`/forgot-password`, `/reset-password`, `/privacy-policy` and `/terms-of-service`.
Publish the full `dist` directory and verify direct navigation/refresh. Adding
a new route requires updating `frontend/scripts/generate-spa-route-fallbacks.mjs`
or arranging an equivalent reviewed SPA fallback.

Backend `npm run build` first generates the custom client from
`prisma/schema.application.prisma`, then runs the committed migration deploy
script when either the production or cloud target is set. A generation or
migration failure stops the build. Start the API only after a successful build.
Keep generated client files in the backend build artifact; they are git-ignored.
The server binds `0.0.0.0` using Hostinger's `PORT`, falling back to 5000 if
absent. Do not replace the provider's assigned port with the local example.

## Environment configuration

Enter secret values directly into protected backend settings. Never copy them
into Git, screenshots, logs, frontend variables or this guide. `VITE_` values
are public and embedded at build time; changing them requires a frontend rebuild.

| Frontend variable | Production value |
| --- | --- |
| `VITE_API_BASE` | `https://api.cnpgceap-sms.com/api` |

| Backend variable | Purpose / setting |
| --- | --- |
| `NODE_ENV` | `production`; enables production startup checks |
| `DATABASE_TARGET` | `cloud`; uses the configured database without local `_v2` suffixing |
| `DATABASE_URL` | Existing runtime PostgreSQL connection string; secret |
| `DIRECT_URL` | Direct migration connection string; secret, preferred over runtime pooling |
| `JWT_SECRET` | Existing strong secret, at least 32 characters; do not rotate during an ordinary deployment |
| `CORS_ORIGINS` | Exact allowed frontend origins; normally `https://cnpgceap-sms.com`; include `https://www.cnpgceap-sms.com` only if it serves the app, and reviewed previews only when needed |
| `APP_BASE_URL` | `https://cnpgceap-sms.com`; used in lifecycle/recovery email links |
| `PORT` | Provider-assigned runtime port |
| `SITE_ACCESS_ENABLED` | Preserve current testing-gate policy; `true` enables the gate |
| `SITE_ACCESS_PASSWORD` | Backend-only tester code, 12–256 characters when enabled |
| `DOCUMENT_BLOB_READ_WRITE_TOKEN` | Existing private scholar-document store token; secret |
| `ANNOUNCEMENT_BLOB_READ_WRITE_TOKEN` | Existing public announcement-image store token; secret |
| `GMAIL_USER` | Protected configured sending account |
| `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` | Existing Gmail API OAuth credentials; secret values remain protected |
| `MAIL_FROM_NAME` | Sender display name, e.g. `PGCEAP Community Affairs Office` |

Origins are comma-separated with no paths; allow apex and www independently
when both serve the app. CORS permits Authorization and X-Site-Access-Token and
exposes X-Site-Access-Required. The tester gate is separate from account/role
permissions. Do not disable it to work around a connection failure.

The migration runner prefers `DIRECT_URL`, falling back to `DATABASE_URL` if
absent. A pooled runtime URL may not support migrations; retain a working
direct URL and check migration permissions. Production uses the exact database
name. Do not point cloud deployment at the locally suffixed `_v2` database or
use `DATABASE_TARGET=legacy`.

Gmail API credentials take priority over optional `GMAIL_APP_PASSWORD` SMTP
fallback. Retain the working hosted provider; SMTP reachability is not verified
here. The local `gmail:authorize` helper and `mailer:verify` command remain
available for controlled credential setup/verification. Their output and
`.env.gmail.generated` file can contain secrets: never commit/share them.
Email delivery happens after business writes and does not prove or undo their
success. Verify recovery links and lifecycle messages with a dedicated test
account after a relevant mail/configuration change.

Production uploads require the appropriate Blob token. A missing token causes
uploads to fail safely; local base64 fallback is not a production storage plan.
Preserve both stores on application rollback. Test private documents through
authorized retrieval, rather than making the store public.

## Migration and account lifecycle

1. Review the release diff, API compatibility and committed migration SQL.
   Confirm the target database and an approved backup/recovery path before a
   release that changes data/schema. Do not print connection strings.
2. Let the backend production build generate its application client and run
   `prisma:deploy`; it applies pending committed migrations using the ledger.
   Inspect the Hostinger migration/build log before accepting the release.
3. The runner has a narrowly scoped recovery for the historical
   `20260909000000_seed_billing_payroll_demo` failed fixture migration. It does
   not resolve arbitrary failed migrations. Investigate other failures rather
   than marking them applied without evidence.
4. Start the backend after successful migration, then publish a compatible
   frontend. Auto-builds may run independently; do not assume they complete
   together. For an incompatible API change, plan a maintenance window or a
   compatible rollout before pushing.

Ordinary Hostinger builds do **not** run `seed:production`. Existing accounts
and academic periods are retained. For a separately authorized **new empty
installation only**, after successful migrations, the operator may explicitly
run `npm run seed:production` from the backend root. It ensures an active primary
academic period (default `2026-2027 / 1st Semester` if none exists) and creates
configured missing administrators. Supported optional variables are
`BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` and
`BOOTSTRAP_BILLING_ADMIN_NAME`, `BOOTSTRAP_BILLING_ADMIN_EMAIL`,
`BOOTSTRAP_BILLING_ADMIN_PASSWORD`. Passwords must be at least 12 characters;
existing account passwords/roles are not replaced. Remove temporary bootstrap
passwords afterward. There is no moderator bootstrap in this script.

Do not run demo seeds, database reset, `migrate dev`, clean-database provisioning
or local fixtures against production as part of deployment or QA acceptance.

## Release checks and evidence

Before publishing, run the appropriate checks documented in [testing.md](testing.md).
For application releases, the usual local baseline is `npm test`,
`npm --prefix frontend run lint` and `npm --prefix frontend run build`.
Documentation-only changes require source/command/link review rather than
production migrations or an application rebuild.

For an authorized release:

1. Record the release commit, affected projects and migration names in
   [qa-fix-register.md](qa-fix-register.md) and the change logs. Push through the
   established main pipeline, then inspect each affected Hostinger build status.
2. Open https://cnpgceap-sms.com/ and verify the expected new hashed assets or
   release-specific behavior. Refresh previously open tabs. An old cached
   bundle or a hosting browser-check page is not evidence of the new release.
3. Open https://api.cnpgceap-sms.com/api/health. Expect HTTP 200,
   `status: healthy`, `database: connected`. This endpoint tests database
   connectivity; it **does not identify the deployed revision** or prove every
   migration, mailer, storage or authenticated workflow works. Use provider logs
   for the backend commit and migration evidence.
4. Open/refresh representative direct client routes and confirm frontend API
   requests target the API domain, with no CORS errors. If the gate is enabled,
   use authorized tester access and then verify normal account/role access.
5. With dedicated test records, check affected workflows using the register.
   For relevant releases verify private upload/retrieval, announcement images,
   lifecycle mail/recovery, paper-score publication privacy, online deadline/
   receipt/draft recovery, and certification/payroll-list generation.
6. Record observed results and distinguish public asset/health checks,
   user-reported provider success and authenticated acceptance. Do not claim
   that health alone proves a backend release or that synthetic tests prove
   production database behavior.

## Recovery and rollback

| Symptom | Check / action |
| --- | --- |
| Old frontend | Hostinger build status, intended main commit, published `dist`, browser/cache state and hashed entry; use the existing project's redeploy only if its automatic release failed |
| Direct route 404 | Full `dist` deployment and generated route index files / configured SPA fallback |
| API 503 or startup failure | Backend build/start logs, assigned PORT, required production variables and generated client; check imports stay within the backend root |
| Unhealthy database | Target/connection validity, provider availability and migration logs; redact credentials from incident notes |
| CORS or unexpected API destination | Exact allowed frontend origin and build-time VITE_API_BASE; rebuild frontend after changing that variable |
| Upload/mail failure | Correct private/public storage token or configured mail credentials; preserve existing data and inspect the affected record before repeating writes |
| Failed migration | Stop the incompatible rollout; inspect the failed SQL/ledger and use a reviewed recovery plan; never reset the production database |

Record the known-good application commit and compatible schema before rollback.
Redeploy matching frontend/backend artifacts when their contracts changed;
reverting app code does not automatically undo database migrations. Retain
compatible additive schema and examination/results/history data. Destructive
schema reversal requires a separate reviewed recovery plan and backup evidence.
Keep Blob stores, database and working secrets intact. Do not restore retired
payout routes as an incidental rollback: the workflow still ends at list
creation. Recheck health, assets and affected authenticated workflows and
record the outcome. Hostinger backup/restore controls, retention and private
account settings must be confirmed by the operator; they were not inspected.

## Local development

Use `.env.example` files for local values, then `npm run dev` from the repository
root. Local URLs are normally http://localhost:5173 and
http://localhost:3601/api. The local example uses `DATABASE_TARGET=local-v2`;
standard backend builds without production/cloud targeting skip production
migration deployment. Local setup remains documented in [README.md](../README.md).
