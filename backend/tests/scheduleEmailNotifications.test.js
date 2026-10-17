const test = require('node:test');
const assert = require('node:assert/strict');
const { queueScheduleEmails, createScheduleEmailNotifications } = require('../services/scheduleEmailNotifications');
const now = new Date('2026-10-18T01:00:00Z');
const fixture = ({ event = 'published', result = { sent: true }, configured = true } = {}) => {
  const rows = [{ id: 1, schedule_id: 10, revision: 2, applicant_id: 7, event, status: 'pending', attempts: 0, available_at: now }];
  const schedule = { id: 10, revision: 2, status: event === 'cancelled' ? 'cancelled' : 'published', payroll_batch_id: 20,
    title: 'Synthetic notice', starts_at: '2030-01-01T01:00:00Z', venue: 'Venue', instructions: 'Instructions', cancellation_reason: 'Unavailable venue' };
  const applicant = { id: 7, first_name: 'Synthetic', email: 'test@example.com', deleted_at: null };
  const state = { account: true, scholar: true, recipient: true, claim: true, messages: [] };
  const prisma = {
    payout_schedule_email_deliveries: {
      findMany: async () => rows.filter(r => r.status === 'pending' && r.available_at <= now).map(r => ({ ...r })),
      updateMany: async ({ where, data }) => { const r = rows.find(r => r.id === where.id && r.status === 'pending'); if (!r || !state.claim) return { count: 0 }; r.status = data.status; r.attempts++; return { count: 1 }; },
      update: async ({ where, data }) => Object.assign(rows.find(r => r.id === where.id), data),
    },
    payout_schedules: { findUnique: async () => schedule },
    applicants: { findUnique: async () => applicant },
    control_accounts: { findFirst: async () => state.account ? {} : null },
    scholar_accounts: { findFirst: async () => state.scholar ? {} : null },
    payout_schedule_recipients: { findUnique: async () => state.recipient ? { active: event !== 'cancelled' } : null },
    payroll_batches: { findUnique: async () => ({ id: 20, batch_number: 'PAYROLL-TEST' }) },
  };
  const worker = createScheduleEmailNotifications({ prisma, now: () => now, mailer: { configured,
    sendScheduleEmail: async (message) => { state.messages.push(message); return result; } } });
  return { ...worker, prisma, rows, schedule, applicant, state };
};
test('enqueue uses only selected recipient IDs and current revision; drafts are not events', async () => {
  let saved;
  const tx = { payout_schedule_email_deliveries: { createMany: async args => { saved = args; } } };
  assert.equal(await queueScheduleEmails(tx, { id: 2, revision: 3 }, 'published', [7, 7, 9]), 2);
  assert.deepEqual(saved.data, [{ schedule_id: 2, revision: 3, applicant_id: 7, event: 'published' }, { schedule_id: 2, revision: 3, applicant_id: 9, event: 'published' }]);
  assert.equal(saved.skipDuplicates, true);
  await assert.rejects(queueScheduleEmails(tx, { id: 2, revision: 3 }, 'draft', [7]));
});
test('publication/update/cancellation use the Gmail mailer once per saved event and recipient', async () => {
  for (const event of ['published', 'rescheduled', 'cancelled']) {
    const f = fixture({ event }); await f.runOnce(); await f.runOnce();
    assert.equal(f.state.messages.length, 1); assert.equal(f.rows[0].status, 'sent');
    assert.equal(f.state.messages[0].event, event); assert.equal(f.state.messages[0].to, 'test@example.com');
  }
});
test('large selected audiences are enqueued in bounded chunks within the caller transaction', async () => {
  const batches = [];
  const tx = { payout_schedule_email_deliveries: { createMany: async ({ data }) => { batches.push(data.length); } } };
  assert.equal(await queueScheduleEmails(tx, { id: 1, revision: 1 }, 'published', Array.from({ length: 1001 }, (_, i) => i + 1)), 1001);
  assert.deepEqual(batches, [500, 500, 1]);
});
test('superseded schedule revisions never send an obsolete date or cancellation', async () => {
  for (const event of ['published', 'rescheduled', 'cancelled']) {
    const f = fixture({ event }); f.schedule.revision++;
    await f.runOnce(); assert.equal(f.state.messages.length, 0);
    assert.equal(f.rows[0].last_reason, 'superseded_schedule');
  }
});
test('deleted applicants, inactive accounts/scholars and removed recipients are not emailed', async () => {
  for (const change of [f => { f.applicant.deleted_at = now; }, f => { f.state.account = false; }, f => { f.state.scholar = false; }, f => { f.state.recipient = false; }]) {
    const f = fixture(); change(f); await f.runOnce();
    assert.equal(f.state.messages.length, 0); assert.equal(f.rows[0].status, 'cancelled');
  }
});
test('configuration absence and lost DB claims do not send or consume attempts', async () => {
  const f = fixture({ configured: false }); await f.runOnce(); assert.equal(f.rows[0].attempts, 0);
  const lost = fixture(); lost.state.claim = false; await lost.runOnce(); assert.equal(lost.state.messages.length, 0);
});
test('failures are backed off and become failed after at most three attempts', async () => {
  const f = fixture({ result: { sent: false, reason: 'delivery_failed' } }); await f.runOnce();
  assert.equal(f.rows[0].status, 'pending'); assert.ok(f.rows[0].available_at > now);
  f.rows[0].attempts = 2; f.rows[0].available_at = now; await f.runOnce();
  assert.equal(f.rows[0].status, 'failed'); assert.equal(f.rows[0].attempts, 3);
});
test('overlapping worker ticks and completed deliveries do not duplicate mail', async () => {
  const f = fixture(); await Promise.all([f.runOnce(), f.runOnce()]); await f.runOnce();
  assert.equal(f.state.messages.length, 1);
});
