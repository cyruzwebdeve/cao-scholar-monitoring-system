const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');

const {
  createActivityData,
  normalizeActorType,
  recordSuccessfulLogin,
} = require('../services/activityLog');
const { ACTIONS, createActivityAudit } = require('../middleware/activityAudit');
const { getStartOfPhilippineDay } = require('../controllers/activityController');

test('maps portal roles to stable audit actor types', () => {
  assert.equal(normalizeActorType({ role: 'SuperAdmin' }), 'admin');
  assert.equal(normalizeActorType({ role: 'BillingPayrollAdmin' }), 'admin');
  assert.equal(normalizeActorType({ role: 'Scholar' }), 'scholar');
  assert.equal(normalizeActorType({ role: 'Applicant' }), 'applicant');
});

test('payroll processing is logged as public-scholar list generation rather than payment completion', () => {
  assert.deepEqual(ACTIONS['POST /payroll/process'], [
    'PAYROLL_LIST_GENERATED',
    'payroll_batches',
    'Generated the official payroll list for public-school scholars.',
  ]);
});

test('creates bounded activity data without recording request bodies or credentials', () => {
  const data = createActivityData({
    user: { id: 8, role: 'Applicant' },
    action: 'APPLICATION_SUBMITTED',
    description: 'Submitted a scholarship application.',
    targetTable: 'application_submissions',
    targetId: 14,
    ipAddress: '127.0.0.1',
  });

  assert.deepEqual(data, {
    actor_type: 'applicant',
    actor_id: 8,
    action: 'APPLICATION_SUBMITTED',
    target_table: 'application_submissions',
    target_id: 14,
    description: 'Submitted a scholarship application.',
    ip_address: '127.0.0.1',
  });
});

test('keeps absent target IDs null and computes audit days in Philippine time', () => {
  const data = createActivityData({
    user: { id: 8, role: 'Applicant' },
    action: 'USER_LOGIN',
  });
  const startOfDay = getStartOfPhilippineDay(new Date('2026-08-20T18:00:00Z'));

  assert.equal(data.target_id, null);
  assert.equal(startOfDay.toISOString(), '2026-08-20T16:00:00.000Z');
});

test('successful applicant login updates the control account and writes an audit event atomically', async () => {
  let accountUpdate;
  let activityCreate;
  let transactionOperations;
  const client = {
    admins: { update: () => { throw new Error('must not update admin'); } },
    control_accounts: {
      update: (payload) => {
        accountUpdate = payload;
        return Promise.resolve({ id: 41 });
      },
    },
    activity_logs: {
      create: (payload) => {
        activityCreate = payload;
        return Promise.resolve({ id: 90 });
      },
    },
    $transaction: async (operations) => {
      transactionOperations = operations;
      return Promise.all(operations);
    },
  };

  const timestamp = await recordSuccessfulLogin(client, {
    id: 7,
    role: 'Applicant',
    accountType: 'applicant',
    account: { id: 41 },
  }, { ipAddress: '127.0.0.1' });

  assert.equal(transactionOperations.length, 2);
  assert.equal(accountUpdate.where.id, 41);
  assert.equal(accountUpdate.data.last_login_at, timestamp);
  assert.equal(activityCreate.data.actor_id, 7);
  assert.equal(activityCreate.data.action, 'USER_LOGIN');
  assert.equal(activityCreate.data.target_id, 41);
});

test('successful admin login updates the administrator last-login timestamp', async () => {
  let adminUpdate;
  const client = {
    admins: {
      update: (payload) => {
        adminUpdate = payload;
        return Promise.resolve({ id: 3 });
      },
    },
    control_accounts: { update: () => { throw new Error('must not update applicant'); } },
    activity_logs: { create: () => Promise.resolve({ id: 91 }) },
    $transaction: (operations) => Promise.all(operations),
  };

  const timestamp = await recordSuccessfulLogin(client, {
    id: 3,
    role: 'SuperAdmin',
    accountType: 'admin',
    account: { id: 3 },
  });

  assert.equal(adminUpdate.where.id, 3);
  assert.equal(adminUpdate.data.last_login_at, timestamp);
});

test('successful authenticated mutations are recorded after the response completes', async () => {
  let recorded;
  const middleware = createActivityAudit({
    client: { name: 'test-client' },
    recorder: async (client, details) => {
      recorded = { client, details };
    },
  });
  const req = {
    method: 'PUT',
    params: { id: '12' },
    ip: '127.0.0.1',
    user: { id: 2, role: 'SuperAdmin' },
  };
  const res = new EventEmitter();
  res.statusCode = 200;

  await new Promise((resolve) => {
    middleware(req, res, () => {
      req.route = { path: '/academic-periods/:id/activate' };
      res.emit('finish');
      setImmediate(resolve);
    });
  });

  assert.equal(recorded.client.name, 'test-client');
  assert.equal(recorded.details.action, 'ACADEMIC_PERIOD_ACTIVATED');
  assert.equal(recorded.details.targetId, 12);
});

test('successful mutations can provide a more specific audit action and description', async () => {
  let recorded;
  const middleware = createActivityAudit({
    recorder: async (_client, details) => { recorded = details; },
  });
  const req = {
    method: 'POST',
    params: {},
    ip: '127.0.0.1',
    user: { id: 4, role: 'BillingPayrollAdmin' },
  };
  const res = new EventEmitter();
  res.statusCode = 201;
  res.locals = {
    auditAction: 'BILLING_OVERRIDE_PROCESSED',
    auditDescription: 'Processed billing with one eligibility override.',
    auditTargetId: 31,
  };

  await new Promise((resolve) => {
    middleware(req, res, () => {
      req.route = { path: '/billing/process' };
      res.emit('finish');
      setImmediate(resolve);
    });
  });

  assert.equal(recorded.action, 'BILLING_OVERRIDE_PROCESSED');
  assert.equal(recorded.description, 'Processed billing with one eligibility override.');
  assert.equal(recorded.targetId, 31);
});

test('failed mutations are not added to the audit trail', async () => {
  let calls = 0;
  const middleware = createActivityAudit({ recorder: async () => { calls += 1; } });
  const req = {
    method: 'PUT',
    params: {},
    route: { path: '/schools/classification' },
    user: { id: 2, role: 'SuperAdmin' },
  };
  const res = new EventEmitter();
  res.statusCode = 500;

  middleware(req, res, () => res.emit('finish'));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(calls, 0);
});

test('saved scholar certifications record safe operational metadata without the PDF or generation ticket', async () => {
  let recorded;
  const middleware = createActivityAudit({
    recorder: async (_client, details) => { recorded = details; },
  });
  const req = {
    method: 'POST',
    params: { applicantId: '14' },
    route: { path: '/scholars/:applicantId/certifications' },
    user: { id: 2, role: 'RegularAdmin' },
    ip: '127.0.0.1',
    body: {
      academicPeriodId: 9,
      generationToken: 'test-ticket-do-not-log',
      fileData: 'test-pdf-do-not-log',
    },
  };
  const res = new EventEmitter();
  res.statusCode = 201;
  res.locals = { auditTargetId: 31 };

  middleware(req, res, () => res.emit('finish'));
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(recorded, {
    user: req.user,
    action: 'SCHOLAR_CERTIFICATION_GENERATED',
    description: 'Generated and saved an individual scholar enrollment certification.',
    targetTable: 'scholar_certifications',
    targetId: 31,
    ipAddress: '127.0.0.1',
  });
  assert.equal(JSON.stringify(recorded).includes('do-not-log'), false);
});

test('certification preparation and reused saved certifications create no generation event', async () => {
  let calls = 0;
  const middleware = createActivityAudit({ recorder: async () => { calls += 1; } });
  for (const [routePath, locals] of [
    ['/scholars/:applicantId/certifications/prepare', {}],
    ['/scholars/:applicantId/certifications', { auditSkip: true }],
  ]) {
    const req = {
      method: 'POST',
      params: { applicantId: '14' },
      route: { path: routePath },
      user: { id: 2, role: 'RegularAdmin' },
    };
    const res = new EventEmitter();
    res.statusCode = 200;
    res.locals = locals;
    middleware(req, res, () => res.emit('finish'));
  }
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(ACTIONS['POST /scholars/:applicantId/certifications/prepare'], undefined);
  assert.equal(calls, 0);
});

test('batch grant preparation records aggregate operational metadata without row payloads', async () => {
  let recorded;
  const middleware = createActivityAudit({ recorder: async (_client, details) => { recorded = details; } });
  const req = { method: 'POST', params: {}, route: { path: '/scholars/grant-preparation/batch' },
    user: { id: 2, role: 'BillingPayrollAdmin' }, ip: '127.0.0.1',
    body: { academicPeriodId: 10, entries: [{ applicantId: 7, tuitionFeeAssistance: 3500, preparedAt: 'test-row-do-not-log' }] } };
  const res = new EventEmitter(); res.statusCode = 200;
  res.locals = { auditDescription: 'Prepared 1 Private Scholar grant record(s) for Billing in academic period 10; 1 not saved.' };
  middleware(req, res, () => res.emit('finish'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(recorded.action, 'PRIVATE_GRANTS_BATCH_PREPARED'); assert.equal(recorded.targetTable, 'scholar_requirements');
  assert.equal(recorded.targetId, null); assert.equal(recorded.description, res.locals.auditDescription);
  assert.equal(JSON.stringify(recorded).includes('do-not-log'), false); assert.equal(recorded.entries, undefined);
});

test('a batch with no saved grants does not create an operational mutation event', async () => {
  let calls = 0;
  const middleware = createActivityAudit({ recorder: async () => { calls += 1; } });
  const req = { method: 'POST', params: {}, route: { path: '/scholars/grant-preparation/batch' }, user: { id: 2, role: 'RegularAdmin' } };
  const res = new EventEmitter(); res.statusCode = 200; res.locals = { auditSkip: true };
  middleware(req, res, () => res.emit('finish'));
  await new Promise(resolve => setImmediate(resolve)); assert.equal(calls, 0);
});
