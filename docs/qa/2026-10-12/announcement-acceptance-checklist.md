# Announcement fixes and Post Now: verification checklist

Date: 2026-10-12 (Asia/Manila). Use CAO-authorized accounts and clearly marked
test notices. Staging is preferred for request blocking, competing edits and
large fixture sets; do not publish dozens of real notices to test priority.

## Before testing

Confirm both Hostinger builds succeeded for the release in the fix register.
No new migration is required. Hard-refresh tabs. Announcement management requires
the existing announcement section permission; portal accounts can only read
notices for their allowed audience. API health alone does not prove backend revision.

## 1. Post Now for a new notice

1. Open Announcements → New announcement. Enter a test title/content, audience
   and priority. Optional image/Facebook link must be valid.
2. Click **Post Now** without setting a publish date. Expect a confirmed save,
   Published status and current publication time. Refresh an allowed applicant/
   scholar portal; the notice is immediately eligible for delivery.
3. Check a disallowed audience: the notice must not appear. Posting an urgent
   notice may supersede a normal notice because the portal selects one by priority.

## 2. Draft and Schedule are separate actions

- Enter a different notice and choose **Save Draft**. It stays out of portals.
- Reopen it, set **Publish date (PHT · UTC+8)** a few minutes ahead and choose
  **Schedule**. Without a date, expect validation and retained input.
- Before the publishing time the notice must be hidden. At/after that time,
  refresh the portal or management page; it becomes published/eligible.
- Dates are Philippine Standard Time even if the browser/device uses another
  timezone. Existing stored timestamps are not converted in the database.
- Background portal polling is still every five minutes; this is not a push
  notification system. Manual refresh verifies immediate eligibility.

## 3. Post Now for an existing future schedule

Open a scheduled test notice whose publish date is tomorrow. Click **Post Now**.
It must publish now and clear that future date, preserving audience/priority and
valid image/link. An expired notice needs a valid future expiry before reposting;
Post Now must not silently clear its expiry.

## 4. Urgent delivery and personal updates (ANN-01/02)

- Publish a scholar-targeted urgent test notice. A scholar with an existing read
  personal list update must see both the CAO notice and personal update separately,
  including the notice's image/link when supplied.
- In a staging fixture with an older urgent notice and at least 50 newer normal
  eligible notices, the urgent notice must win. Check audience and expiry still
  exclude inappropriate notices. Do not generate production notice spam.

## 5. Concurrent editors (ANN-03)

1. Open the same test notice in browser A and B.
2. B changes its content and saves.
3. A changes its stale copy and selects Save changes/Post Now.
4. Expect HTTP 409/reload guidance, not silent overwrite. A's unsaved input remains.
5. **Reload saved version (replaces unsaved edits)** explicitly loads B's saved
   content/revision. Review it before saving. Reload intentionally replaces A's
   unsaved edits; it is not an automatic merge.

## 6. Expiry and archiving (ANN-04/07)

- Create an immediate test notice with a shortly upcoming PHT expiry; wait or use
  staging fixtures. After expiry, portal refresh must omit it and a loaded notice
  should be removed by its existing expiry timer.
- Refresh management: the row shows Expired and the Expired filter finds it.
  The **Published records** metric explicitly includes expired published records;
  it must not claim they are currently visible.
- Edit the expired notice, choose Archived and **Save changes**, leaving its dates
  untouched. Archiving must succeed and preserve the original expiry timestamp.

## 7. Connection failure and recovery (ANN-05)

In staging/browser DevTools, block only requests matching announcements/latest
and reload the applicant portal. Expect **Announcements unavailable**, a useful
error and **Retry announcements**, rather than No new announcements. Previously
loaded notices may remain with stale-data guidance. Restore the request and use
Retry; the correct notice should load. Ordinary successful-empty responses still
show No new announcements.

For a failed announcement mutation, keep the editor/input, show an error and do
not automatically replay a write. Before manually retrying an uncertain save,
check whether it was already recorded in the directory.

## 8. Image limit and persistence (ANN-06)

- An allowed JPG/PNG/WEBP/GIF at or below 3 MiB should save; over 3 MiB must fail
  without recording a notice/upload. Test the direct API boundary in staging too:
  client validation alone is not proof of server enforcement.
- Mismatched declared/data-URL image types are rejected. This checks supported
  MIME/size rules, not comprehensive malicious-image detection.
- Verify allowed image preview and hosted display, replacement and removal with
  dedicated files. Blob storage is public for announcement images; private scholar
  documents must not be used as test announcement images.

## 9. Timezone and mobile clarity (ANN-08)

- Compare the same PHT input in Manila and UTC browser timezones; both must send
  the same UTC instant. Example: 2026-12-31 10:00 PHT → 02:00Z.
- Directory timestamps include PHT. Unchanged dates retain their original timestamp
  precision on edits/archiving; Post Now intentionally clears the publish date.
- At 390px width, editor actions wrap without horizontal page overflow. Keyboard
  users can reach actions; editing defaults to Save changes rather than silently
  changing a published record to Draft when submitting with Enter.

Record release/environment, PASS/FAIL and observed behavior without credentials,
real personal information, private files or answer keys. Update the
[fix register](../../qa-fix-register.md) after authenticated acceptance. Local
fixtures and public health/asset checks do not prove cloud uploads or production
concurrency; record those results separately.
