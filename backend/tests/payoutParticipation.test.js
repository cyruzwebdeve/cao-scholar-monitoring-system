const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createFixture } = require('./fixtures/payoutParticipationFixture');
const {
  createPayoutParticipationController,
} = require('../controllers/payoutParticipationController');
const { receiptInput } = require('../services/payoutParticipation');
let f, controller;
const response = () => ({
  locals: {},
  headers: {},
  statusCode: 200,
  set(key, value) {
    this.headers[key] = value;
    return this;
  },
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});
const request = (body = {}, scholar = false) => ({
  user: {
    id: scholar ? 7 : 11,
    role: scholar ? 'Scholar' : 'BillingPayrollAdmin',
  },
  params: { id: '1', applicantId: '7' },
  body,
});
const attendance = (extra) => ({
  attendance: 'present',
  expectedVersion: 0,
  scheduleRevision: 1,
  ...extra,
});
const receipt = (extra) => ({
  action: 'received',
  expectedVersion: 0,
  scheduleRevision: 1,
  receivedOn: '2026-10-21',
  confirmed: true,
  ...extra,
});
async function call(action, body, scholar = false, params = {}) {
  const req = request(body, scholar);
  Object.assign(req.params, params);
  const res = response();
  await controller[action](req, res);
  return res;
}
beforeEach(() => {
  f = createFixture();
  controller = createPayoutParticipationController({
    prisma: f.prisma,
    now: () => f.state.now,
  });
});
test('staff attendance never changes receipt acknowledgement or legacy list/payment fields', async () => {
  const original = structuredClone(f.state.claims);
  let res = await call('attendance', attendance());
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.attendance.status, 'present');
  assert.equal(f.state.attendance[0].recorded_by, 11);
  assert.equal(f.state.receipts.length, 0);
  assert.deepEqual(f.state.claims, original);
  res = await call('index');
  assert.equal(res.body.rows[0].receipt.status, 'not_confirmed');
  assert.equal(res.body.rows[0].attendance.status, 'present');
  assert.equal(res.headers['Cache-Control'], 'private, no-store');
});
test('Scholar receipt uses own payroll membership, requires attestation and does not mark attendance', async () => {
  const res = await call(
    'receipt',
    receipt({ applicantId: 8, claimId: 80, attendance: 'present' }),
    true
  );
  assert.equal(res.statusCode, 200);
  assert.equal(f.state.receipts[0].payroll_claim_id, 70);
  assert.equal(f.state.receipts.length, 1);
  assert.equal(f.state.attendance.length, 0);
  assert.equal(res.body.receipt.status, 'received');
  assert.equal(res.locals.auditAction, 'SCHOLAR_RECEIPT_REPORTED');
  assert.deepEqual(
    f.state.claims.map((r) => r.claim_status),
    ['listed', 'listed']
  );
});
test('invalid dates, impossible dates, missing attestation and unsupported actions cannot write', async () => {
  for (const patch of [
    { confirmed: false },
    { confirmed: 'true' },
    { receivedOn: '2026-10-22' },
    { receivedOn: '2026-10-20' },
    { receivedOn: '2026-02-30' },
    { action: 'paid' },
    { expectedVersion: '0' },
  ]) {
    const res = await call('receipt', receipt(patch), true);
    assert.equal(res.statusCode, 400, JSON.stringify(patch));
    assert.equal(f.state.receipts.length, 0);
  }
  assert.throws(() =>
    receiptInput(
      receipt({ receivedOn: null }),
      f.state.schedules[0],
      f.state.now
    )
  );
});
test('concurrent/stale attendance and receipt versions and stale schedule revisions fail without overwriting', async () => {
  await call('attendance', attendance());
  let res = await call('attendance', attendance({ attendance: 'absent' }));
  assert.equal(res.statusCode, 409);
  assert.equal(f.state.attendance[0].attendance, 'present');
  await call('receipt', receipt(), true);
  res = await call('receipt', receipt(), true);
  assert.equal(res.statusCode, 409);
  assert.equal(f.state.receipts[0].version, 1);
  res = await call(
    'attendance',
    attendance({ expectedVersion: 1, scheduleRevision: 0 })
  );
  assert.equal(res.statusCode, 409);
  res = await call(
    'receipt',
    receipt({ expectedVersion: 1, scheduleRevision: 0 }),
    true
  );
  assert.equal(res.statusCode, 409);
});
test('attendance and receipt have independent versions and can be corrected independently', async () => {
  await call('attendance', attendance());
  await call('receipt', receipt(), true);
  let res = await call(
    'attendance',
    attendance({ attendance: 'absent', expectedVersion: 1 })
  );
  assert.equal(res.statusCode, 200);
  assert.equal(f.state.receipts[0].is_received, true);
  res = await call(
    'receipt',
    receipt({ action: 'withdraw', expectedVersion: 1 }),
    true
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.receipt.status, 'not_confirmed');
  assert.equal(f.state.attendance[0].attendance, 'absent');
  assert.equal(f.state.receipts[0].received_on, null);
  assert.equal(f.state.receipts[0].confirmed_at, null);
});
test('future/cancelled/draft and Billing schedules block new attendance/receipts', async () => {
  for (const mode of ['future', 'cancelled', 'draft', 'billing']) {
    f = createFixture();
    controller = createPayoutParticipationController({
      prisma: f.prisma,
      now: () => f.state.now,
    });
    if (mode === 'future')
      f.state.schedules[0].starts_at = new Date('2030-01-01');
    if (mode === 'cancelled') f.state.schedules[0].status = 'cancelled';
    if (mode === 'draft') f.state.schedules[0].status = 'draft';
    if (mode === 'billing') f.state.batches[0].status = 'billed';
    for (const action of ['attendance', 'receipt']) {
      const res = await call(
        action,
        action === 'attendance' ? attendance() : receipt(),
        action === 'receipt'
      );
      assert.equal(
        res.statusCode,
        mode === 'draft' || mode === 'billing' ? 404 : 409
      );
    }
  }
});
test('a cancelled schedule retains reports and allows the Scholar to withdraw a mistaken acknowledgement', async () => {
  await call('attendance', attendance());
  await call('receipt', receipt(), true);
  f.state.schedules[0].status = 'cancelled';
  f.state.schedules[0].revision = 2;
  f.state.recipients
    .filter((r) => r.schedule_id === 1)
    .forEach((r) => (r.active = false));
  let res = await call('index');
  assert.equal(res.body.schedule.canRecord, false);
  assert.equal(res.body.rows[0].attendance.status, 'present');
  assert.equal(res.body.rows[0].receipt.status, 'received');
  res = await call(
    'receipt',
    receipt({ action: 'withdraw', expectedVersion: 1, scheduleRevision: 2 }),
    true
  );
  assert.equal(res.statusCode, 200);
});
test('published edits preserve attendance; moving the scheduled date keeps historical attendance but requires a fresh mark', async () => {
  await call('attendance', attendance());
  await call('receipt', receipt(), true);
  f.state.recipients = f.state.recipients.map((r) => ({ ...r }));
  f.state.schedules[0].revision = 2;
  let res = await call('index');
  assert.equal(res.body.rows[0].attendance.status, 'present');
  f.state.schedules[0].starts_at = new Date('2026-10-22T00:00:00Z');
  res = await call('index');
  assert.equal(res.body.rows[0].attendance.status, 'not_marked');
  assert.equal(res.body.rows[0].previousAttendance.status, 'present');
  assert.equal(res.body.rows[0].receipt.status, 'received');
  assert.equal(f.state.attendance.length, 1);
  f.state.now = new Date('2026-10-22T06:00:00Z');
  res = await call('attendance', attendance({ scheduleRevision: 2 }));
  assert.equal(res.statusCode, 200);
  assert.equal(f.state.attendance.length, 2);
});
test('same Payroll receipt is visible across reschedules without creating duplicate acknowledgement records', async () => {
  await call('receipt', receipt(), true);
  const res = await call('mine', {}, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.schedules.length, 2);
  assert.ok(
    res.body.schedules.every((row) => row.receipt.status === 'received')
  );
  assert.ok(res.body.schedules.every((row) => row.payrollEntryId === 70));
  assert.equal(f.state.receipts.length, 1);
  assert.equal(JSON.stringify(res.body).includes('Other Scholar'), false);
  assert.equal(JSON.stringify(res.body).includes('claim_amount'), false);
});
test('removed recipients, missing payroll members and soft-deleted accounts fail closed', async () => {
  for (const mode of ['recipient', 'claim', 'deleted']) {
    f = createFixture();
    controller = createPayoutParticipationController({
      prisma: f.prisma,
      now: () => f.state.now,
    });
    if (mode === 'recipient')
      f.state.recipients = f.state.recipients.filter(
        (r) => r.applicant_id !== 7
      );
    if (mode === 'claim')
      f.state.claims = f.state.claims.filter((r) => r.applicant_id !== 7);
    if (mode === 'deleted') f.state.people[0].deleted_at = new Date();
    let res = await call('receipt', receipt(), true);
    assert.equal(res.statusCode, 404);
    assert.equal(f.state.receipts.length, 0);
  }
});
test('attendance cannot be used to mark a payment received and withdrawal needs an existing report', async () => {
  let res = await call('attendance', attendance({ attendance: 'received' }));
  assert.equal(res.statusCode, 400);
  res = await call('receipt', receipt({ action: 'withdraw' }), true);
  assert.equal(res.statusCode, 400);
  assert.equal(f.state.attendance.length, 0);
  assert.equal(f.state.receipts.length, 0);
});
