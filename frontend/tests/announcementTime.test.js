import test from 'node:test';
import assert from 'node:assert/strict';
import { fromManilaDateTimeInput, toManilaDateTimeInput, announcementDisplayStatus } from '../src/utils/announcementTime.js';
test('announcement wall times are explicitly Manila and round-trip independent of browser timezone', () => {
  assert.equal(fromManilaDateTimeInput('2026-12-31T10:00'), '2026-12-31T02:00:00.000Z');
  assert.equal(toManilaDateTimeInput('2026-12-31T02:00:00Z'), '2026-12-31T10:00');
  assert.equal(fromManilaDateTimeInput('2027-01-01T00:15'), '2026-12-31T16:15:00.000Z');
  assert.equal(fromManilaDateTimeInput(''), null);
  assert.throws(() => fromManilaDateTimeInput('not a date'));
});
test('expired published records have their own display state without relabeling archives or drafts', () => {
  const expiresAt = '2026-10-12T00:00:00Z'; const now = Date.parse(expiresAt);
  assert.equal(announcementDisplayStatus({ status: 'published', expiresAt }, now), 'expired');
  assert.equal(announcementDisplayStatus({ status: 'published', expiresAt }, now-1), 'published');
  assert.equal(announcementDisplayStatus({ status: 'archived', expiresAt }, now), 'archived');
  assert.equal(announcementDisplayStatus({ status: 'draft', expiresAt }, now), 'draft');
});
