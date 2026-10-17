# Announcement and scholarship email notifications

## Staff workflow

1. Create a notice in Announcements and select Applicants, Scholars, Applicants
   & Scholars, or Everyone. Everyone emails registered applicants/scholars only;
   administrator-only notices never email applicants or scholars.
2. Leave **Notify the selected applicants and/or scholars by email** checked
   for notices requiring an alert: schedules, requirement deadlines, document
   instructions, official results notices, and other CAO updates. Uncheck it for
   portal-only updates. Every priority supports email; no keyword guessing is used.
3. Publish immediately or schedule publication. Drafts, archived, expired and
   future-dated notices are not emailed. The running API checks every 30 seconds.
4. Review sent, pending, failed, sending and cancelled counts in the directory.
   Sent means accepted by the provider, not confirmed inbox receipt.

The first eligible publication snapshots active control accounts into a durable
per-applicant queue. Active scholar accounts determine Scholar audience membership.
Deleted applicants are excluded. Audience and account eligibility are checked again
before each send. Each email has a single recipient, without a shared recipient list.
The email includes the notice title and text plus a portal link; images and external
Facebook posts remain available in the portal, not embedded in mail.

Edits, republishing, priority changes and expanding the audience do not reset the
snapshot or repeat completed deliveries. Create a new announcement for a new alert.
Unchecking email, archiving, expiration or audience narrowing cancels outstanding
deliveries when examined by the worker; emails already accepted cannot be recalled.
Accounts registered after the snapshot do not receive that announcement by email.

## Scholarship acceptance

The existing approval mailer remains the single sender after official scholarship
acceptance is saved. This release preserves the latest branch's reviewed-result,
posted Passer List and initial-document gates. Priority proof approval is document
verification, not automatic acceptance in the current deployment branch. Passing
an examination or approving proof alone does not generate an acceptance email.
The formal acceptance message contains the scholar ID, academic year and portal
link. Repeating acceptance for an already-active scholar does not email again.

Approval mail remains an immediate, non-queued attempt; failure does not undo the
decision and has no automatic retry. Announcement retries do not apply to it.

## Deployment and operations

- Deploy the additive `20261018000000_announcement_email_notifications` migration,
  generate the Prisma application client, and restart the backend. Existing build
  scripts already provide these steps for a production target; verify the hosting
  build actually invokes `npm run build` or the existing migration-enabled build.
- Build/deploy the frontend to expose the checkbox and delivery counters.
- Keep the existing Gmail variables and set `APP_BASE_URL` to the public frontend
  origin, not localhost. No additional secrets or dependencies are required.
- Existing announcements default to email disabled to prevent historical blasts.
  Deliberately enable one if an old announcement should produce its first alert.
- The queue survives restarts and uses atomic DB claims across API instances. A tick
  queues at most ten announcements and sends at most 25 emails sequentially; larger
  audiences take multiple ticks and remain subject to the sender's provider limits.
- Known send failures receive at most three attempts, with five then ten minutes
  before subsequent attempts. Missing mail configuration pauses pending attempts.
  There is no exactly-once guarantee if a provider accepts mail but its response is
  lost. Monitor counters and provider diagnostics rather than repeatedly publishing.
- Unexpected interruption leaves a row in `sending` for operator review. It is
  deliberately not reclaimed automatically, to avoid blind duplicate delivery.
  Failed and stuck rows have no retry button in this release; investigate the
  provider outcome before an authorized operator changes queue state.
- Scheduling and delivery require a running backend; downtime delays work. No
  external cron, push notification service or inbox receipt tracking is introduced.
- Queue rows store IDs and delivery state, not duplicate email addresses or content.
  Apply existing database access/backup controls and retention policies. Parent
  deletion cascades remove delivery rows. Stop workers before any data cleanup.

## Rollback and scope

Disable email on outstanding announcements to cancel them, or roll back the backend
and frontend release while preserving the additive database columns/table. Do not
drop the table to stop the worker. Old mail and database backups cannot be recalled.
No scholarship decision rules or payroll behavior change. Legacy payment-oriented
routes and mail templates are retained unchanged, outside approved product scope.
