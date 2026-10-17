# Informational schedule email notifications

## Staff workflow

Publishing a schedule for selected members of an existing Payroll list now saves
portal notifications and queues individual emails through the existing Gmail
mailer. Changing published schedule details or cancelling it also queues a new
notice for those same recipients. There is no optional email checkbox. Drafts send
nothing. Saving an unchanged published schedule does not create another revision,
portal notice or email. Published recipient groups remain fixed under existing rules.

Staff messages distinguish **portal notifications saved** from **Gmail notices
queued**. The schedule directory displays pending, sent, failed, sending and
cancelled email counts for its current revision. Sent means provider acceptance,
not proof that an email reached the inbox or was read. Scholar portal notices and
the existing schedule cards remain available even while delivery is pending.

The email includes the notice/event title, Payroll list reference, Philippine-time
dates, venue, relevant instructions or cancellation reason, and a link to the
latest portal schedule. It expressly does not confirm fund release, payment or
receipt of money. No payment amount, claiming confirmation, disbursement record or
financial audit is introduced. Legacy-named scheduling is retained only as an
informational notice; it does not extend the managed scholarship process beyond
official payroll-list generation.

## Deployment

Deploy migration `20261018010000_schedule_email_notifications`, regenerate the
Prisma application client, and start the matched backend/frontend release. Existing
production backend build scripts provide generation and committed migrations;
confirm Hostinger actually invokes the migration-enabled build. Existing Gmail
credentials and the public frontend `APP_BASE_URL` are reused. No new provider,
secret, dependency or hosting configuration is required.

The new outbox starts empty. Existing schedules and portal notification history
are not retrospectively emailed. Newly published schedules and actual changes or
cancellations after deployment queue notices. Do not change a real schedule just
to test the mailer; use controlled test records and selected test recipients.

## Reliability and privacy

- Queue creation shares the serializable schedule/recipient/portal-notification
  transaction. An enqueue error rolls the whole save back instead of silently
  losing the email work. Sending happens after commit, outside the request.
- A unique schedule/revision/applicant key and atomic pending-to-sending claim
  prevent ordinary duplicate work across ticks or instances. The worker starts
  with the API, runs every 30 seconds and handles up to 25 emails sequentially.
- The worker checks the current revision/status, recipient membership, active
  control and scholar accounts, and a non-deleted applicant with an email address.
  Cancellation recipients remain eligible despite their schedule-membership
  active flag being cleared by cancellation.
- Pending older revisions are cancelled rather than sending obsolete dates.
  Changes after a send has already started cannot recall that email; the portal
  link always leads to the current schedule. A cancellation can be emailed even
  if its earlier publication email had not yet been delivered.
- Missing mail configuration pauses the queue without consuming attempts. Known
  failures receive at most three attempts, with five/ten-minute delays. Unexpected
  interruptions can leave sending rows for operator investigation rather than
  blind automatic resend. Failed/stuck retries have no staff UI in this release.
- Exactly-once inbox delivery is not guaranteed: a provider can accept email before
  a network failure or delivery-state persistence error. Review provider outcomes
  before manually retrying ambiguous rows. Downtime and provider quotas delay work.
- Every email has one recipient; recipients cannot see a shared address list.
  Queue rows store IDs/event/revision/state, not copied email addresses or notice
  content. Existing database/backup access and retention controls apply. Foreign
  keys remove outbox rows when a parent schedule/applicant is deleted.

## Rollback

Revert matched backend/frontend code while retaining the additive outbox table and
history. Stop workers before database maintenance. Do not drop the table while the
worker is running, reset data or mark anyone paid to test this feature. Existing
retired payout-release/claiming endpoints remain retired. Already accepted emails
cannot be recalled. Confirm the hosting build/migration and run one controlled
end-to-end Gmail test before broader use.
