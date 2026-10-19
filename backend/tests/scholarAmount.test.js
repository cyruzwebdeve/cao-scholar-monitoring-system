const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const prisma = {};
const prismaPath = require.resolve('../config/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
const { save } = require('../controllers/scholarAmountController');
const { checkRole, checkSectionAccess } = require('../middleware/rbac');
let row, type, active, scholarActive, deleted, listed, events;
const response = () => ({ locals: {}, statusCode: 200, set() { return this; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const request = (amount = 4321.09, extra = {}) => ({ params: { applicantId: '7' }, body: { academicPeriodId: 10, amount, expectedAmount: type === 'private' ? 5000 : 3000, ...extra }, user: { id: 9, role: 'SuperAdmin' } });
beforeEach(() => {
  row = null; type = 'public'; active = true; scholarActive = true; deleted = false; listed = false; events = [];
  const period = { id: 10, is_active: true, school_year: '2026-2027', semester: '1st Semester' };
  Object.assign(prisma, {
    academic_periods: { findFirst: async () => active ? period : null },
    scholar_accounts: { findFirst: async () => scholarActive ? { id: 1 } : null },
    applicants: { findUnique: async () => ({ id: 7, school_id: 1, deleted_at: deleted ? new Date() : null }) },
    application_submissions: { findFirst: async () => ({ id: 1, initial_docs: { initialRequirementPeriodId: 10 } }) },
    schools: { findMany: async () => [{ id: 1, school_type: type }] },
    scholar_requirements: { findUnique: async () => row, findMany: async () => row ? [row] : [], upsert: async ({ create, update }) => { events.push('save'); row = row ? { ...row, ...update } : create; return row; } },
    payroll_claims: { findFirst: async () => { events.push('check-list'); return listed ? { id: 1 } : null; } },
    $queryRaw: async () => { events.push('lock'); return []; },
    $transaction: async callback => { const previous = structuredClone(row); try { return await callback(prisma); } catch (failure) { row = previous; throw failure; } },
  });
});
test('Public amount edits are period-bound and preserve existing metadata without creating lists', async () => {
  row = { applicant_id: 7, billing_period_id: 10, billing_amount: 99999, course: 'Synthetic course' };
  const res = response(); await save(request(), res); assert.equal(res.statusCode, 200);
  assert.equal(row.list_amount_override, 4321.09); assert.equal(row.course, 'Synthetic course'); assert.equal(row.billing_amount, 99999);
  assert.equal(row.updated_by, 9); assert.equal(res.locals.auditAction, 'SCHOLAR_LIST_AMOUNT_UPDATED'); assert.deepEqual(events, ['lock', 'check-list', 'save']);
});
test('zero is an explicit saved amount', async () => {
  const res = response(); await save(request(0), res); assert.equal(res.statusCode, 200); assert.equal(row.list_amount_override, 0); assert.equal(row.billing_period_id, 10);
});
test('invalid amounts, stale edits and generated lists never overwrite saved data', async () => {
  for (const amount of [undefined, null, '4000', -1, 0.001, Infinity, 100000000]) {
    const res = response(); await save(request(amount, { amount }), res); assert.equal(res.statusCode, 400); assert.equal(row, null);
  }
  let res = response(); await save(request(), res); const original = structuredClone(row);
  res = response(); await save(request(4500), res); assert.equal(res.statusCode, 409); assert.deepEqual(row, original);
  listed = true; res = response(); await save(request(4500, { expectedAmount: 4321.09 }), res); assert.equal(res.statusCode, 409); assert.deepEqual(row, original);
});
test('inactive, deleted and unclassified records fail closed', async () => {
  active = false; let res = response(); await save(request(), res); assert.equal(res.statusCode, 409); active = true;
  scholarActive = false; res = response(); await save(request(), res); assert.equal(res.statusCode, 409); scholarActive = true;
  deleted = true; res = response(); await save(request(), res); assert.equal(res.statusCode, 409); deleted = false;
  type = 'unknown'; res = response(); await save(request(), res); assert.equal(res.statusCode, 409); assert.equal(row, null);
});
test('Private edits recalculate allowance and invalidate an open preparation editor; amount cannot undercut tuition', async () => {
  type = 'private'; row = { applicant_id: 7, billing_period_id: 10, tuition_fee_assistance: 3500, grant_prepared_at: new Date('2026-10-16'), grant_prepared_by: 9 };
  let res = response(); await save(request(3000), res); assert.equal(res.statusCode, 400); assert.equal(row.list_amount_override, undefined);
  const preparedAt = row.grant_prepared_at; res = response(); await save(request(6500.75), res);
  assert.equal(res.statusCode, 200); assert.equal(res.body.allowance, 3000.75); assert.ok(row.grant_prepared_at > preparedAt);
});
test('record route enforces exact staff section and role guards deny portal users', async () => {
  for (const role of ['Applicant', 'Scholar']) {
    const req = request(); req.user.role = role; const res = response();
    checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin'])(req, res, () => assert.fail('Unexpected role')); assert.equal(res.statusCode, 403);
  }
  for (const role of ['RegularAdmin', 'BillingPayrollAdmin']) {
    const req = request(); req.user = { id: 9, role, sectionAccess: ['billing'] }; let res = response();
    await save(req, res); assert.equal(res.statusCode, 403); assert.equal(row, null);
    req.user.sectionAccess = ['payroll']; res = response(); await save(req, res); assert.equal(res.statusCode, 200); row = null;
  }
  const req = request(); req.user = { role: 'RegularAdmin', sectionAccess: ['scholars'] }; const res = response();
  checkSectionAccess('billing', 'payroll')(req, res, () => assert.fail('Unexpected permission')); assert.equal(res.statusCode, 403);
});
test('serialization conflicts return a retry response with no successful update', async () => {
  prisma.$transaction = async () => { throw Object.assign(new Error('conflict'), { code: 'P2034' }); };
  const res = response(); await save(request(), res); assert.equal(res.statusCode, 409); assert.equal(row, null);
});
test('a transferred Public scholar can edit below obsolete Private tuition without retaining an invalid breakdown', async () => {
 row={applicant_id:7,billing_period_id:10,tuition_fee_assistance:3500,grant_prepared_at:new Date(),grant_prepared_by:9};
 const res=response();await save(request(2000),res);assert.equal(res.statusCode,200);assert.equal(row.list_amount_override,2000);assert.equal(row.tuition_fee_assistance,null);assert.equal(row.grant_prepared_at,null);assert.equal(res.body.allowance,null);
});
