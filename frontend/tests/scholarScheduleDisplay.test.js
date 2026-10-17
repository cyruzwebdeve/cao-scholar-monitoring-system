import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

test('Scholar Portal no longer mounts the duplicate all-schedules section or its extra request', async () => {
  const source = await readFile(new URL('../src/ScholarDashboard.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /ScholarPayoutSchedules|Your payout schedules|payout-schedules\/me|scholar-payout-schedules/);
  await assert.rejects(access(new URL('../src/components/ScholarPayoutSchedules.jsx', import.meta.url)), { code: 'ENOENT' });
});

test('latest targeted schedule updates remain in the existing announcement area and notification history', async () => {
  const source = await readFile(new URL('../src/ScholarDashboard.jsx', import.meta.url), 'utf8');
  assert.match(source, /\/notifications\/me/);
  assert.match(source, /const latestScholarNotification = scholarNotifications\[0\] \|\| null/);
  const updates = await readFile(new URL('../src/components/ScholarUpdates.jsx', import.meta.url), 'utf8');
  assert.match(updates, /personal\?\.type === 'payout_schedule'/);
  assert.match(updates, /PAYOUT SCHEDULE UPDATE/);
  assert.match(updates, /Your latest update/);
  assert.match(updates, /personal.message/);
  assert.match(updates, /announcement.content/);
  assert.match(source, /scholarNotifications\.map/);
  assert.match(source, /markNotificationRead/);
});

test('admin schedule history and shared schedule cards remain available', async () => {
  const source = await readFile(new URL('../src/PayoutSchedules.jsx', import.meta.url), 'utf8');
  assert.match(source, /Saved schedules/);
  assert.match(source, /data\.schedules\.map/);
  assert.match(source, /PayoutScheduleCard/);
  await access(new URL('../src/components/PayoutScheduleCard.jsx', import.meta.url));
});
