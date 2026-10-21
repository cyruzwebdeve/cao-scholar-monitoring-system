const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express'),
  jwt = require('jsonwebtoken');
const { randomBytes } = require('node:crypto');
const { createFixture } = require('./fixtures/payoutParticipationFixture');
const { manilaDate } = require('../services/payoutParticipation');
const prisma = {},
  path = require.resolve('../config/prisma');
require.cache[path] = {
  id: path,
  filename: path,
  loaded: true,
  exports: prisma,
};
process.env.JWT_SECRET = randomBytes(32).toString('hex');
const router = require('../routes/applicationRoutes');
let f, server, base;
before(async () => {
  const app = express();
  app.use(express.json());
  app.use(router);
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});
beforeEach(() => {
  f = createFixture();
  f.state.schedules[0].starts_at = new Date(Date.now() - 3600000);
  Object.assign(prisma, f.prisma);
});
const request = async (
  path,
  { id = 1, scholar = false, method = 'GET', body } = {}
) => {
  const token = id
    ? jwt.sign(
        {
          userId: id,
          accountType: scholar ? 'applicant' : 'admin',
          authVersion: 0,
        },
        process.env.JWT_SECRET
      )
    : null;
  const response = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return {
    status: response.status,
    body: await response.json(),
    cache: response.headers.get('cache-control'),
  };
};
test('attendance endpoints enforce authentication, staff roles and Payroll access; Scholars cannot mark attendance', async () => {
  for (const [id, scholar, expected] of [
    [null, false, 401],
    [2, false, 403],
    [7, true, 403],
    [99, true, 403],
    [1, false, 200],
  ]) {
    const read = await request('/payroll/schedules/1/attendance', {
      id,
      scholar,
    });
    assert.equal(read.status, expected);
    const write = await request('/payroll/schedules/1/attendance/7', {
      id,
      scholar,
      method: 'PUT',
      body: { attendance: 'present', expectedVersion: 0, scheduleRevision: 1 },
    });
    assert.equal(write.status, expected);
  }
  assert.equal(f.state.attendance.length, 1);
  assert.equal(f.state.receipts.length, 0);
});
test('only Scholars can read their schedule participation and report their own receipt', async () => {
  for (const [id, scholar, expected] of [
    [null, false, 401],
    [1, false, 403],
    [2, false, 403],
    [99, true, 403],
    [7, true, 200],
  ]) {
    let r = await request('/payout-schedules/me/participation', {
      id,
      scholar,
    });
    assert.equal(r.status, expected);
    r = await request('/payout-schedules/1/receipt', {
      id,
      scholar,
      method: 'PUT',
      body: {
        action: 'received',
        expectedVersion: 0,
        scheduleRevision: 1,
        receivedOn: manilaDate(new Date()),
        confirmed: true,
        applicantId: 8,
      },
    });
    assert.equal(r.status, expected);
  }
  assert.equal(f.state.receipts[0].payroll_claim_id, 70);
  const r = await request('/payout-schedules/me/participation', {
    id: 7,
    scholar: true,
  });
  assert.match(r.cache, /no-store/);
  assert.ok(r.body.schedules.every((row) => row.payrollEntryId === 70));
  assert.equal(JSON.stringify(r.body).includes('Other Scholar'), false);
  assert.equal(JSON.stringify(r.body).includes('applicantIds'), false);
});
test('staff cannot change receipt status and retired office paid/release endpoints remain disabled', async () => {
  assert.equal(
    (
      await request('/payout-schedules/1/receipt', {
        method: 'PUT',
        body: { action: 'received' },
      })
    ).status,
    403
  );
  assert.equal(
    (await request('/applications/7/paid', { method: 'PUT', body: {} })).status,
    410
  );
  assert.equal(
    (
      await request('/payroll/billing-batch/10/release', {
        method: 'PUT',
        body: {},
      })
    ).status,
    410
  );
  assert.equal(f.state.receipts.length, 0);
  assert.equal(f.state.claims[0].claim_status, 'listed');
});
