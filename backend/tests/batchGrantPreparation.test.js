const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const prisma = {}, prismaPath = require.resolve('../config/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
const { saveBatch } = require('../controllers/grantPreparationController');
let state;
const response = () => ({ locals: {}, statusCode: 200, headers: {}, set(key, value) { this.headers[key] = value; return this; },
  status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const entry = (applicantId, tuitionFeeAssistance = 2500, extra = {}) => ({ applicantId, tuitionFeeAssistance,
  preparedAt: state.rows.get(applicantId)?.grant_prepared_at?.toISOString() || null, ...extra });
const request = (entries = [entry(7)], extra = {}) => ({ params: {}, body: { academicPeriodId: 10, entries },
  user: { id: 21, role: 'RegularAdmin', sectionAccess: ['billing'] }, ...extra });
const call = async req => { const res = response(); await saveBatch(req, res); return res; };
beforeEach(() => {
  state = { rows: new Map(), events: [], transactions: 0, listed: new Set(), failAfterUpsert: new Set(),
    applicants: new Map([7, 8, 9].map(id => [id, { id, school_id: 1, school_year: '2026-2027' }])),
    scholars: new Map([7, 8, 9].map(id => [id, { id, applicant_id: id, is_active: true }])),
    applications: new Map([7, 8, 9].map(id => [id, { id, applicant_id: id, initial_docs: { initialRequirementPeriodId: 9 } }])),
    period: { id: 10, is_active: true, school_year: '2026-2027', semester: '1st Semester' },
    primary: { id: 9, is_active: true, is_primary: true, school_year: '2025-2026', semester: '1st Semester' },
    schools: [{ id: 1, name: 'Synthetic Private School', school_type: 'Private' }, { id: 2, name: 'Synthetic Public School', school_type: 'Public' }],
  };
  Object.assign(prisma, {
    academic_periods: { findFirst: async ({ where }) => where.id ? state.period?.id === where.id && state.period.is_active ? state.period : null : state.primary },
    scholar_accounts: { findFirst: async ({ where }) => state.scholars.get(where.applicant_id)?.is_active ? state.scholars.get(where.applicant_id) : null },
    applicants: { findUnique: async ({ where }) => state.applicants.get(where.id) },
    application_submissions: { findFirst: async ({ where }) => state.applications.get(where.applicant_id) },
    scholar_requirements: {
      findUnique: async ({ where }) => state.rows.get(where.applicant_id_billing_period_id.applicant_id),
      findMany: async ({ where }) => [...state.rows.values()].filter(row => where.applicant_id.in.includes(row.applicant_id)),
      upsert: async ({ create, update }) => {
        const id = create.applicant_id;
        state.events.push(['upsert', id]);
        const saved = { ...(state.rows.get(id) || create), ...update };
        state.rows.set(id, saved);
        if (state.failAfterUpsert.has(id)) throw Object.assign(new Error('Synthetic failed commit'), { code: 'P2034' });
        return saved;
      },
    },
    schools: { findMany: async () => state.schools },
    payroll_claims: { findFirst: async ({ where }) => { state.events.push(['check-list', where.applicant_id, where.academic_period_id]); return state.listed.has(where.applicant_id) ? { id: 1 } : null; } },
    $queryRaw: async (...args) => { state.events.push(['lock', ...args.slice(1)]); return []; },
    $transaction: async (operation, options) => {
      assert.equal(options.isolationLevel, 'Serializable'); state.transactions += 1;
      await state.beforeTransaction?.();
      const previous = structuredClone(state.rows);
      try { return await operation(prisma); } catch (failure) { state.rows = previous; throw failure; }
    },
  });
});

test('one request atomically prepares each Scholar with separate amounts and period Billing metadata', async () => {
  const res = await call(request([entry(7, 3500), entry(8, 0)]));
  assert.equal(res.statusCode, 200); assert.equal(res.body.savedCount, 2); assert.equal(res.body.failedCount, 0);
  assert.deepEqual(res.body.results.map(result => [result.applicantId, result.success, result.grant.totalGrant, result.grant.tuitionFeeAssistance, result.grant.allowance]),
    [[7, true, 5000, 3500, 1500], [8, true, 5000, 0, 5000]]);
  for (const id of [7, 8]) {
    const row = state.rows.get(id);
    assert.equal(row.applicant_id, id); assert.equal(row.billing_period_id, 10); assert.equal(row.billing_school_year, '2026-2027');
    assert.equal(row.billing_semester, '1st Semester'); assert.equal(row.billing_status, 'Not billed yet'); assert.equal(row.billing_amount, 5000);
    assert.equal(row.grant_prepared_by, 21); assert.equal(row.updated_by, 21); assert.ok(row.grant_prepared_at instanceof Date);
    assert.equal(row.billing_reference, undefined); assert.equal(row.payroll_requested_at, undefined);
  }
  assert.equal(state.transactions, 2); assert.deepEqual(state.events.map(event => event[0]), ['lock', 'check-list', 'upsert', 'lock', 'check-list', 'upsert']);
  assert.match(res.locals.auditDescription, /Prepared 2.*academic period 10; 0 not saved/);
  assert.match(res.headers['Cache-Control'], /private, no-store/);
});

test('controller independently requires authenticated Billing staff before any row transaction', async () => {
  for (const user of [null, { id: 21, role: 'Applicant' }, { id: 21, role: 'Scholar' },
    { id: 21, role: 'ContentModerator', sectionAccess: ['billing'] }, { id: 21, role: 'RegularAdmin', sectionAccess: ['payroll'] },
    { id: 21, role: 'BillingPayrollAdmin', sectionAccess: [] }]) {
    const res = await call(request(undefined, { user })); assert.equal(res.statusCode, user ? 403 : 401); assert.equal(state.transactions, 0);
  }
  for (const role of ['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']) {
    const res = await call(request([entry(7)], { user: { id: 21, role, sectionAccess: role === 'SuperAdmin' ? [] : ['billing'] } }));
    assert.equal(res.body.savedCount, 1, res.body.message);
  }
});

test('malformed, oversized and duplicate batch identities fail before writes', async () => {
  const bodies = [null, {}, { academicPeriodId: true, entries: [entry(7)] }, { academicPeriodId: 0, entries: [entry(7)] },
    { academicPeriodId: 10, entries: [] }, { academicPeriodId: 10, entries: 'not-an-array' },
    { academicPeriodId: 10, entries: Array.from({ length: 101 }, (_, index) => entry(index + 1)) },
    { academicPeriodId: 10, entries: [entry(7), entry('7')] }, { academicPeriodId: 10, entries: [null] },
    { academicPeriodId: 10, entries: [[]] }, { academicPeriodId: 10, entries: [entry(true)] },
    { academicPeriodId: 10, entries: [entry(-1)] }, { academicPeriodId: 10, entries: [entry(Number.MAX_SAFE_INTEGER + 1)] }];
  for (const body of bodies) {
    const res = await call({ ...request(), body }); assert.equal(res.statusCode, 400); assert.equal(state.transactions, 0); assert.equal(state.rows.size, 0);
  }
});

test('partial failures preserve successful rows and valid retries need not resubmit successes', async () => {
  const res = await call(request([entry(7, 1234.56), entry(8, 5000.01), entry(9, 5000)]));
  assert.equal(res.body.savedCount, 2); assert.equal(res.body.failedCount, 1); assert.equal(res.body.results[1].statusCode, 400);
  assert.equal(state.rows.get(7).tuition_fee_assistance, 1234.56); assert.equal(state.rows.get(9).tuition_fee_assistance, 5000); assert.equal(state.rows.has(8), false);
  const saved = structuredClone(state.rows.get(7)), retry = await call(request([entry(8, 2000)]));
  assert.equal(retry.body.savedCount, 1); assert.deepEqual(state.rows.get(7), saved); assert.equal(state.rows.get(8).tuition_fee_assistance, 2000);
});

test('invalid tuition and stale prepared dates fail only their rows and never fabricate a prepared record', async () => {
  for (const value of [undefined, null, '', '2500', -1, Infinity, NaN, 1.001, 5000.01]) {
    const res = await call(request([{ ...entry(7), tuitionFeeAssistance: value }])); assert.equal(res.body.results[0].statusCode, 400); assert.equal(state.rows.size, 0); assert.equal(res.locals.auditSkip, true);
  }
  let res = await call(request([entry(7)])); assert.equal(res.body.savedCount, 1);
  const original = structuredClone(state.rows.get(7));
  for (const preparedAt of [null, 'invalid-date', 1234]) {
    res = await call(request([entry(7, 3000, { preparedAt })])); assert.equal(res.body.savedCount, 0); assert.deepEqual(state.rows.get(7), original);
  }
  res = await call(request([entry(7, 3000)])); assert.equal(res.body.savedCount, 1); assert.equal(state.rows.get(7).tuition_fee_assistance, 3000);
  assert.ok(+state.rows.get(7).grant_prepared_at > +original.grant_prepared_at);
});

test('saved total overrides remain authoritative and forged totals, allowance, period and reference are ignored', async () => {
  state.rows.set(7, { applicant_id: 7, billing_period_id: 10, list_amount_override: 6500.75, school_id: 1, valid_id_photocopy_file: 'synthetic-evidence' });
  const res = await call(request([entry(7, 5500.25, { totalGrant: 99999, allowance: 99999, academicPeriodId: 99, billingReference: 'forged' })]));
  assert.equal(res.body.results[0].grant.totalGrant, 6500.75); assert.equal(res.body.results[0].grant.allowance, 1000.5);
  assert.equal(state.rows.get(7).billing_period_id, 10); assert.equal(state.rows.get(7).billing_reference, undefined);
  assert.equal(state.rows.get(7).valid_id_photocopy_file, 'synthetic-evidence');
});

test('inactive, missing, Public, deleted, pre-entry, initial and redirected Payroll Scholars cannot be batch prepared', async () => {
  const mutations = [() => state.scholars.get(7).is_active = false, () => state.scholars.delete(7),
    () => state.applicants.get(7).school_id = 2, () => state.applicants.get(7).deleted_at = new Date(),
    () => state.applicants.get(7).school_year = '2027-2028', () => state.applications.delete(7),
    () => state.applications.get(7).initial_docs.initialRequirementPeriodId = 10,
    () => state.rows.set(7, { applicant_id: 7, billing_period_id: 10, payroll_requested_at: new Date() }),
    () => state.period.is_active = false, () => state.applicants.delete(7), () => state.schools[0].school_type = 'Unclassified'];
  for (const mutation of mutations) {
    const previous = structuredClone(state); mutation(); const rowsBefore = structuredClone(state.rows);
    const res = await call(request([entry(7)])); assert.equal(res.body.savedCount, 0); assert.equal(res.body.results[0].statusCode, [6, 7].includes(mutations.indexOf(mutation)) ? 403 : 409);
    assert.deepEqual(state.rows, rowsBefore); Object.assign(state, previous);
  }
});

test('existing Billing or Payroll membership locks the preparation and records no mutation event', async () => {
  state.rows.set(7, { applicant_id: 7, billing_period_id: 10, tuition_fee_assistance: 3000, grant_prepared_at: new Date(), billing_reference: 'BILL-SYNTHETIC' });
  state.listed.add(7); const original = structuredClone(state.rows);
  const res = await call(request([entry(7, 2000)])); assert.equal(res.body.results[0].statusCode, 409); assert.equal(res.body.savedCount, 0);
  assert.deepEqual(state.rows, original); assert.equal(res.locals.auditSkip, true); assert.equal(res.locals.auditDescription, undefined);
});

test('a failed transaction rolls back grant and Billing metadata together while later rows can save', async () => {
  state.failAfterUpsert.add(7);
  const res = await call(request([entry(7, 3500), entry(8, 1000)]));
  assert.equal(res.body.savedCount, 1); assert.equal(res.body.failedCount, 1); assert.equal(res.body.results[0].statusCode, 409);
  assert.equal(state.rows.has(7), false); assert.equal(state.rows.get(8).billing_status, 'Not billed yet'); assert.equal(state.rows.get(8).tuition_fee_assistance, 1000);
});

test('row context and optimistic timestamp are reread inside the transaction after the lock', async () => {
  state.rows.set(7, { applicant_id: 7, billing_period_id: 10, tuition_fee_assistance: 2500, grant_prepared_at: new Date('2026-11-18T01:00:00Z') });
  const req = request([entry(7, 2000)]);
  state.beforeTransaction = () => { state.rows.get(7).grant_prepared_at = new Date('2026-11-18T01:00:01Z'); };
  const res = await call(req); assert.equal(res.body.results[0].statusCode, 409); assert.equal(state.rows.get(7).tuition_fee_assistance, 2500);
  assert.equal(state.events[0][0], 'lock'); assert.equal(state.events.some(event => event[0] === 'upsert'), false);
});

test('unexpected row failures return bounded safe errors without leaking request or storage details', async () => {
  const logged = [], originalLog = console.error;
  console.error = (...values) => logged.push(values);
  prisma.schools.findMany = async () => { throw new Error('synthetic-private-data-do-not-disclose'); };
  try {
    const res = await call(request([entry(7), entry(8)]));
    assert.equal(res.body.savedCount, 0); assert.equal(res.body.failedCount, 2); assert.equal(res.locals.auditSkip, true);
    for (const result of res.body.results) { assert.equal(result.statusCode, 500); assert.doesNotMatch(result.message, /do-not-disclose/); }
    assert.doesNotMatch(JSON.stringify(logged), /do-not-disclose/); assert.equal(state.rows.size, 0);
  } finally { console.error = originalLog; }
});
