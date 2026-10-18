const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = require('node:crypto').randomBytes(32).toString('hex');
process.env.NODE_ENV = 'test';
const prisma = {};
const prismaPath = require.resolve('../config/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
const { getDashboardDetails } = require('../controllers/dashboardDetailsController');
const { getActivityLogs } = require('../controllers/activityController');
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
let queries;
const setup = () => {
  queries = [];
  prisma.applicants = { findMany: async args => { queries.push(['applicants', args]); return args.select.id && Object.keys(args.select).length === 1 ? [{ id: 7 }] : [{ id: 7, first_name: 'Synthetic', last_name: 'Scholar', municipality: 'Test place' }]; }, findUnique: async () => ({ id: 7 }) };
  prisma.scholar_accounts = { count: async args => { queries.push(['count', args]); return 27; }, findMany: async args => { queries.push(['scholars', args]); return [{ id: 11, applicant_id: 7, scholar_id: 'TEST-7' }]; }, findFirst: async () => null };
  prisma.exam_slots = { count: async args => { queries.push(['count', args]); return 2; }, findMany: async args => { queries.push(['slots', args]); return [{ id: 1, applicant_id: 7, exam_id: 20 }, { id: 2, applicant_id: 7, exam_id: 21 }]; } };
  prisma.control_accounts = { findFirst: async () => ({ is_active: true, auth_version: 0 }) };
  prisma.admins = { findUnique: async ({ where }) => ({ id: where.id, is_active: true, auth_version: 0, is_super_admin: where.id === 1, role: where.id === 4 ? 'billing' : 'admin', section_access: where.id === 2 ? ['dashboard'] : where.id === 3 ? ['scholars'] : ['dashboard', 'scholars', 'examination'] }) };
};
const details = async (metric = 'activeScholars', query = {}, user = { role: 'SuperAdmin' }) => { const res = response(); await getDashboardDetails({ params: { metric }, query, user }, res); return res; };

test('active scholar details paginate the complete active-account population using minimal private fields', async () => {
  setup(); const res = await details('activeScholars', { page: '2' });
  assert.equal(res.statusCode, 200); assert.deepEqual(res.body.pagination, { page: 2, pageSize: 25, total: 27, pages: 2 });
  const query = queries.find(([name]) => name === 'scholars')[1];
  assert.deepEqual(query.where, { is_active: true }); assert.equal(query.skip, 25); assert.equal(query.take, 25);
  assert.equal(res.body.rows[0].name, 'SYNTHETIC SCHOLAR');
  assert.equal(res.body.rows[0].reference, 'TEST-7');
  assert.doesNotMatch(JSON.stringify(res.body), /password|fileUrl|email|phone|initial_docs/);
});
test('forfeiture details preserve one row per exam slot rather than losing repeat applicants', async () => {
  setup(); const res = await details('forfeitedAccounts');
  assert.equal(res.body.rows.length, 2); assert.equal(res.body.pagination.total, 2);
  assert.notEqual(res.body.rows[0].reference, res.body.rows[1].reference);
  assert.deepEqual(queries.find(([name]) => name === 'slots')[1].where, { forfeited_at: { not: null } });
});
test('metric names and malformed/oversized paging or search input fail before any database reads', async () => {
  for (const [metric, query] of [['unknown', {}], ['__proto__', {}], ['activeScholars', { page: '1.5' }], ['activeScholars', { page: '-1' }], ['activeScholars', { search: 'x'.repeat(101) }]]) {
    setup(); assert.equal((await details(metric, query)).statusCode, 400); assert.equal(queries.length, 0);
  }
});
test('dashboard-only staff cannot retrieve directories hidden by section permissions', async () => {
  for (const role of ['RegularAdmin', 'BillingPayrollAdmin']) {
    setup(); assert.equal((await details('activeScholars', {}, { role, sectionAccess: ['dashboard'] })).statusCode, 403);
    assert.equal((await details('forfeitedAccounts', {}, { role, sectionAccess: ['dashboard'] })).statusCode, 403); assert.equal(queries.length, 0);
  }
});
test('search restricts both totals and pages to matching non-deleted applicants and clamps stale pages', async () => {
  setup(); const res = await details('activeScholars', { search: 'Synthetic', page: '9' });
  const query = queries.find(([name]) => name === 'scholars')[1];
  assert.deepEqual(query.where.applicant_id, { in: [7] }); assert.equal(query.skip, 25);
  assert.equal(res.body.pagination.page, 2);
  assert.equal(queries.find(([name]) => name === 'applicants')[1].where.deleted_at, null);
});
test('empty lists and unavailable applicant records are handled without exposing deleted identities', async () => {
  setup(); prisma.applicants.findMany = async () => [];
  assert.equal((await details()).body.rows[0].name, 'Applicant record unavailable');
  prisma.scholar_accounts.count = async () => 0; prisma.scholar_accounts.findMany = async () => [];
  assert.deepEqual((await details()).body.pagination, { page: 1, pageSize: 25, total: 0, pages: 1 });
});
test('main summary exposes record-access flags without granting hidden sections', async () => {
  setup();
  prisma.control_accounts.findMany = async () => [];
  prisma.activity_logs = { findMany: async () => [] };
  const { getDashboardSummary } = require('../controllers/applicationController');
  for (const [user, expected] of [[{ role: 'SuperAdmin' }, true], [{ role: 'BillingPayrollAdmin', sectionAccess: ['dashboard'] }, false]]) {
    const res = response(); await getDashboardSummary({ user }, res);
    assert.deepEqual(res.body.metricAccess, { activeScholars: expected, forfeitedAccounts: expected });
  }
});
test('activity metric filters use the same Philippine-day/sign-in/admin predicates as the cards', async () => {
  setup(); let where;
  prisma.activity_logs = { findMany: async args => { where = args.where; return []; }, count: async () => 0 };
  for (const metric of ['today', 'week', 'signIns', 'adminActions']) {
    const res = response(); await getActivityLogs({ query: { metric } }, res); assert.equal(res.statusCode, 200);
    if (metric === 'today' || metric === 'week') assert.ok(where.created_at.gte instanceof Date);
    if (metric === 'signIns') assert.equal(where.action, 'USER_LOGIN');
    if (metric === 'adminActions') assert.equal(where.actor_type, 'admin');
  }
  const res = response(); await getActivityLogs({ query: { metric: 'unknown' } }, res); assert.equal(res.statusCode, 400);
});

let server, base;
test.before(async () => {
  const app = express(); app.use(require('../routes/applicationRoutes'));
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); }); base = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
test('real metric route enforces authentication, role and both dashboard and target-section access', async () => {
  const header = (id, type = 'admin') => ({ Authorization: `Bearer ${jwt.sign({ userId: id, accountType: type, authVersion: 0 }, process.env.JWT_SECRET)}` });
  for (const [headers, status] of [[{}, 401], [header(7, 'control'), 403], [header(2), 403], [header(3), 403], [header(4), 200], [header(1), 200]]) {
    setup(); const res = await fetch(`${base}/dashboard/metrics/activeScholars`, { headers }); assert.equal(res.status, status);
    if (status === 200) assert.match(res.headers.get('cache-control'), /no-store/);
  }
});
