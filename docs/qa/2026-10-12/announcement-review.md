# Announcement feature QA

Date: 2026-10-12 (Asia/Manila). Source baseline `f47ad62`. Initial audit only: no
application/configuration changes or real announcement/image publication during
that audit. The subsequent authorized release is described below.

## TL;DR

- Eight issues reproduced across delivery, editing, expiry, error reporting, size limits, counts and timezone interpretation.
- Normal draft/create/edit, due publication, audience/expiry filters and sampled management/create permissions passed local controller checks; four Facebook URL regressions passed.
- Synthetic browsers covered scheduling, invalid file rejection, metrics and both portal displays; no page errors in the completed checks, sampled 390px management view had no horizontal overflow.
- Public frontend/API health passed; announcement GETs without tester access returned 401. Authenticated hosted content, Blob uploads and actual concurrent database behavior were not tested.

## Authorized fix status

ANN-01–ANN-08 and the user's explicit Post Now action are implemented for the
matching frontend/backend release `1c5b486`, pushed for testing. 241 backend checks/one existing skip and 72
frontend checks passed; lint/build and synthetic action/portal/conflict/archive/
timezone/mobile checks passed. No migration/history conversion. New frontend assets are live and API/database healthy; backend provider confirmation
is pending and tracked in the [fix register](../../qa-fix-register.md); follow the
[acceptance checklist](announcement-acceptance-checklist.md). Findings below are
preserved pre-fix evidence; authenticated hosted/storage acceptance remains.

## Process and scope

CAO announcement-authorized staff can create/edit draft, scheduled, published or
archived notices with audience, priority, optional expiry, image and Facebook link.
Scheduling promotes due rows when management/latest endpoints are requested; it
is not driven by a reviewed background worker. Latest notice selection filters
published status, role audience, publication time and expiry, then chooses one
notice by priority within a newest-50 candidate list. Applicant/scholar portals
poll at five-minute intervals and remove a loaded notice at its expiry.

No DELETE route was found; archive is the supported retirement action. Images
use the existing public announcement Blob store in production; scholar-document
storage remains private and unrelated. Operational changes may be logged; this
feature does not change the payroll-list scope or introduce monetary auditing.

## Reproduced findings

| ID / priority | Finding and evidence | Recommendation |
| --- | --- | --- |
| ANN-01 / P2 | **A read personal update hides an urgent scholar announcement.** A synthetic Scholar received an urgent CAO announcement plus a 30-day-old read list notification. The page displayed the personal update and omitted the urgent title/image/link. ScholarDashboard always prioritizes notifications[0], including read records, in its only announcement card. | Show general announcements separately from personal updates, or explicitly ensure urgent notices remain visible. Marking a notification read must not permanently obscure CAO notices. |
| ANN-02 / P2 | **Priority selection can miss an urgent notice.** With 50 newer normal published notices and one older unexpired urgent notice for the same audience, latest returned normal. The controller limits by recency before sorting priority. | Apply priority ordering to the full eligible query before limiting/selecting; add the >50 candidate regression. |
| ANN-03 / P2 | **Stale edits overwrite newer work.** Editor A saves a new title, then editor B saves its earlier snapshot. Both updates return 200 and B replaces A's title. Neither editor payload nor update predicate carries an expected revision. | Include updatedAt/version and conditionally update; return 409 with reload guidance for stale edits. Test competing content and audience/status changes. |
| ANN-04 / P2 | **Expired immediate notices cannot be archived with their dates intact.** A published notice has publish_at=null, a historical published_at and past expires_at. An archive update preserving expiresAt returns 400, Expiration must be later than the publishing date, because validation substitutes now for the missing publishAt. | Make validation status/history aware; allow archiving/editing historical expired records without clearing or falsifying expiry. Validate new effective publication windows separately. |
| ANN-05 / P2 | **Applicant load failure looks like no announcements.** A browser request aborted for announcements/latest; the applicant page displayed No new announcements with no error or Retry. Its catch discards the error, and non-success responses can replace data with null. | Distinguish unavailable, stale and successful-empty states; retain last-loaded data with error guidance and manual Retry, consistent with other QA-10 views. |
| ANN-06 / P2 | **The server exceeds the advertised 3 MiB image limit.** A direct controller request containing 3 MiB + 100 KiB of synthetic bytes encoded as image data returned 201 locally. The frontend caps raw bytes at 3 MiB; the server caps the encoded string at 4.5 MiB, allowing about 3.375 MiB decoded. | Enforce the same exact decoded-byte limit server-side before storage, alongside allowed content types. Do not rely on the browser limit. |
| ANN-07 / P3 | **Published count is labeled Currently visible even for expired notices.** The browser metric shows 1 for a sole already-expired published row that the latest endpoint correctly excludes. Future publish times/audience visibility also differ from the raw status count. | Label it Published records or compute a precisely defined currently-visible metric; expose expiry in the directory/filter. |
| ANN-08 / P3 | **Schedule timezone is implicit and depends on the operator's browser.** Entering 2026-12-31 10:00 produced 02:00Z in Asia/Manila and 10:00Z in UTC. The editor/list provides no timezone label; date conversion uses browser local time. | Define and display Philippine Standard Time (UTC+8), or clearly label the user's local zone and normalize consistently. Do not silently reinterpret existing stored UTC timestamps. |

Source areas: [announcement controllers](../../../backend/controllers/applicationController.js),
[management editor](../../../frontend/src/AnnouncementsManagement.jsx),
[applicant portal](../../../frontend/src/ApplicantDashboard.jsx),
[scholar portal](../../../frontend/src/ScholarDashboard.jsx),
[image storage service](../../../backend/services/blobStorage.js).

## Checks that passed

- Drafts/future scheduled notices are excluded from latest; a due scheduled notice
  becomes published; Scholar-only content does not appear for Applicant; expired
  published content is excluded. These controller cases used a query-aware fake
  database, not a real SQL query execution.
- Valid draft creation and edit succeed; empty title/content, unknown audience,
  missing scheduled date and deceptive Facebook domain fail with 400.
- Actual local HTTP management GET and creation POST deny anonymous users,
  applicants and staff lacking announcement section access; authorized sampled
  RegularAdmin/SuperAdmin requests succeed. Update uses the same reviewed route
  guards, but its role matrix was not separately executed over HTTP. Billing-role
  variations remain broader acceptance coverage.
- Four existing URL tests pass: allowed Facebook HTTPS hosts, fragment removal,
  supported mobile/web hosts, deceptive/non-HTTPS rejection and empty handling.
  The validator verifies host/scheme, not CAO ownership or a specific post path;
  homepage/redirect-shaped Facebook URLs need a separate policy decision.
- Scheduled editor requests/save feedback work in both tested timezones. SVG
  selection is rejected before a mutation request. Sampled management layout
  does not overflow at 390px. Announcement title/content use React text rendering;
  no dangerouslySetInnerHTML was found in the reviewed views.
- Seven temporary controller/route probes completed: three normal checks and
  four probes that **assert the undesired behavior** for reproduction. Their
  completion must not be reported as seven successful feature behaviors. The
  browser script similarly includes passing cases and four reproduced issue types.
  A first browser run needed a corrected Status-select locator; the completed
  run reported no page errors. A sandboxed link run initially reported only the
  file; the final run reported all four individual regressions.

## Public observations and limitations

Frontend HTTPS returned 200 with entry index-CF6J5UlD.js. API health returned
200, status healthy and database connected. GET announcements/latest and
announcements/management without tester authorization both returned 401
SITE_ACCESS_REQUIRED. This verifies the outer gate, not real authenticated
announcement contents/roles or the exact backend revision.

No authenticated production account/tester code, real announcement, email,
public/private upload, Blob token or real personal information was used. Image
size reproduction used synthetic data with cloud uploads disabled and an
in-memory database; it does not prove hosted upload success or valid image
content. Stale-update reproduction is sequential with two snapshots; actual
concurrent PostgreSQL behavior was not fault-tested. No full accessibility,
performance, browser/device or storage-security assessment was performed.

Five-minute polling means scheduled notices, edits and archival can take time
to reach an already open portal. Unpublishing/expiry cannot retract an already
loaded public image from browser caches. Blob-upload/DB failure compensation
and MIME-byte validation deserve separate integration tests; they were not
reproduced as storage defects here. Only one general notice is returned rather
than an announcement feed, so lower-priority notices may be invisible by design.

## Recommended fix order and acceptance

1. Delivery integrity: ANN-01/02 so urgent notices reach intended scholars/applicants.
2. Record integrity/lifecycle: ANN-03/04, with version-conflict and expired archive tests.
3. Reliability/validation: ANN-05/06, with safe retry/input retention and exact byte bounds.
4. Clarity: ANN-07/08, with expiry semantics and explicitly labeled timezones.
5. After authorized implementation, use dedicated staging records for creation,
   audience targeting, schedule boundaries, edit conflicts, expiry/archive and
   image replacement/removal. Then perform controlled authenticated hosted checks.

No fixes or deployment executed. Review rollback removes documentation only;
existing announcements, storage objects and historical records remain intact.
