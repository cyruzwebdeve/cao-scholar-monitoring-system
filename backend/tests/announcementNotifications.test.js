const test = require('node:test');
const assert = require('node:assert/strict');
const { createAnnouncementNotifications, isDeliverableAnnouncement, matchesAudience } = require('../services/announcementNotifications');
const now = new Date('2026-10-18T01:00:00Z');
const notice = { id: 1, title: 'Examination schedule', content: 'Review your assigned schedule.', audience: 'applicants_scholars', priority: 'high', status: 'published', notify_email: true, email_queued_at: null };

test('only published, opted-in, currently visible recipient notices are deliverable', () => {
  assert.equal(isDeliverableAnnouncement(notice, now), true);
  for (const patch of [{ status: 'draft' }, { status: 'scheduled' }, { status: 'archived' }, { notify_email: false }, { audience: 'admins' }, { publish_at: '2026-10-19' }, { expires_at: now }]) {
    assert.equal(isDeliverableAnnouncement({ ...notice, ...patch }, now), false);
  }
});
test('audience rules distinguish active scholars from applicants', () => {
  for (const scholar of [true, false]) {
    assert.equal(matchesAudience('all', scholar), true);
    assert.equal(matchesAudience('applicants_scholars', scholar), true);
    assert.equal(matchesAudience('admins', scholar), false);
    assert.equal(matchesAudience('scholars', scholar), scholar);
    assert.equal(matchesAudience('applicants', scholar), !scholar);
  }
});

const fixture = ({ audience = 'applicants_scholars', result = { sent: true }, configured = true } = {}) => {
  const announcement = { ...notice, audience };
  const rows = [];
  const messages = [];
  const applicants = [1, 2].map((id) => ({ id, email: `test${id}@example.com`, first_name: 'Test', deleted_at: null }));
  const prisma = {
    announcements: {
      updateMany: async ({ where, data }) => {
        if (!where.id && announcement.status === 'scheduled' && announcement.publish_at <= now) {
          Object.assign(announcement, data); return { count: 1 };
        }
        if (!where.id || announcement.email_queued_at) return { count: 0 };
        Object.assign(announcement, data); return { count: 1 };
      },
      findUnique: async () => announcement,
      findMany: async () => announcement.email_queued_at || !isDeliverableAnnouncement(announcement, now) ? [] : [announcement],
    },
    control_accounts: { findMany: async () => [{ applicant_id: 1 }, { applicant_id: 2 }], findFirst: async () => ({ is_active: true }) },
    scholar_accounts: { findMany: async () => [{ applicant_id: 2 }], findFirst: async ({ where }) => where.applicant_id === 2 ? { is_active: true } : null },
    applicants: {
      findMany: async ({ where }) => applicants.filter(({ id }) => where.id.in.includes(id)),
      findUnique: async ({ where }) => applicants.find(({ id }) => id === where.id),
    },
    announcement_email_deliveries: {
      createMany: async ({ data }) => { for (const item of data) if (!rows.some((r) => r.applicant_id === item.applicant_id)) rows.push({ ...item, id: rows.length + 1, status: 'pending', attempts: 0, available_at: now }); },
      findMany: async () => rows.filter((r) => r.status === 'pending' && r.available_at <= now).map((r) => ({ ...r })),
      updateMany: async ({ where, data }) => {
        const row = rows.find((r) => r.id === where.id && r.status === 'pending');
        if (!row) return { count: 0 };
        row.status = data.status; row.attempts += 1; return { count: 1 };
      },
      update: async ({ where, data }) => Object.assign(rows.find((r) => r.id === where.id), data),
    },
    $transaction: async (fn) => fn(prisma),
  };
  const worker = createAnnouncementNotifications({ prisma, now: () => now, mailer: { configured, sendAnnouncementEmail: async (message) => { messages.push(message); return result; } } });
  return { ...worker, rows, messages, announcement, applicants, prisma };
};
test('queues and sends one private email per recipient, with no repeats after edits/republication', async () => {
  const f = fixture();
  await f.runOnce();
  assert.equal(f.messages.length, 2);
  assert.equal(f.messages[0].to, 'test1@example.com');
  assert.equal(f.rows.every((r) => r.status === 'sent'), true);
  f.announcement.title = 'Edited';
  await f.runOnce();
  assert.equal(f.messages.length, 2);
});
test('applicant and scholar audiences only enqueue their matching accounts', async () => {
  for (const [audience, expected] of [['applicants', 1], ['scholars', 2]]) {
    const f = fixture({ audience }); await f.runOnce();
    assert.deepEqual(f.rows.map((r) => r.applicant_id), [expected]);
  }
});
test('unconfigured mail retains pending work without consuming attempts', async () => {
  const f = fixture({ configured: false }); await f.runOnce();
  assert.equal(f.messages.length, 0);
  assert.equal(f.rows.every((r) => r.status === 'pending' && r.attempts === 0), true);
});
test('delivery failures back off and stop after three attempts', async () => {
  const f = fixture({ result: { sent: false, reason: 'delivery_failed' } });
  await f.runOnce();
  assert.equal(f.rows[0].status, 'pending');
  assert.ok(f.rows[0].available_at > now);
  for (const r of f.rows) { r.attempts = 2; r.available_at = now; }
  await f.runOnce();
  assert.equal(f.rows.every((r) => r.status === 'failed'), true);
});
test('archived notices, changed audiences and deleted recipients cancel pending deliveries', async () => {
  for (const change of [(f) => { f.announcement.status = 'archived'; }, (f) => { f.announcement.audience = 'admins'; }, (f) => { f.applicants.forEach((a) => { a.deleted_at = now; }); }]) {
    const f = fixture({ configured: false }); await f.runOnce(); change(f);
    const worker = createAnnouncementNotifications({ prisma: f.prisma, now: () => now, mailer: { configured: true, sendAnnouncementEmail: async () => { throw new Error('must not send'); } } });
    await worker.runOnce();
    assert.equal(f.rows.every((r) => r.status === 'cancelled'), true);
  }
});
test('concurrent local ticks do not duplicate deliveries', async () => {
  const f = fixture(); await Promise.all([f.runOnce(), f.runOnce()]);
  assert.equal(f.messages.length, 2);
});

test('scheduled notices send only after their publication time', async () => {
  const f = fixture();
  f.announcement.status = 'scheduled';
  f.announcement.publish_at = new Date('2026-10-19');
  await f.runOnce(); assert.equal(f.messages.length, 0);
  f.announcement.publish_at = new Date('2026-10-17');
  await f.runOnce(); assert.equal(f.messages.length, 2);
  assert.equal(f.announcement.status, 'published');
});
