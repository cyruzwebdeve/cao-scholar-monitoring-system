const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { once } = require('node:events');
const prisma = {
  scholar_accounts: { findUnique: async ({ where }) => ({ applicant_id: where.applicant_id }) },
  applicants: { findFirst: async ({ where }) => ({ id: where.id }) },
  scholar_graduations: { findUnique: async ({ where }) => { seenIds.push(where.applicant_id); return null; } },
};
let server, base, seenIds = [];
function mock(name, exports) { const path = require.resolve(name); require.cache[path] = { id: path, filename: path, loaded: true, exports }; }
mock('../config/prisma', prisma);
// Authentication is substituted only in this test. Production role and section middleware and routes are exercised unchanged.
mock('../middleware/auth', { authenticate: (req, res, next) => {
  const role = req.get('x-test-role'); if (!role) return res.status(401).json({ message: 'Unauthorized' });
  req.user = { id: 7, role, sectionAccess: req.get('x-test-section') === 'scholars' ? ['scholars'] : ['reports'] }; next();
}, authenticateOptional: (_req, _res, next) => next() });
mock('../middleware/activityAudit', { auditSuccessfulMutation: (_req, _res, next) => next() });
before(async () => { const app = express(); app.use(express.json()); app.use('/api', require('../routes/applicationRoutes')); server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}/api`; });
after(async () => { if (server) { server.close(); server.closeAllConnections(); await once(server, 'close'); } });
test('graduation routes require authentication and deny Applicant access', async () => {
  for (const headers of [{}, { 'x-test-role': 'Applicant' }]) {
    for (const endpoint of ['/graduations/me', '/graduations/me/proof', '/scholar-graduations', '/scholar-graduations/9', '/scholar-graduations/9/proof']) {
      const response = await fetch(base + endpoint, { headers }); assert.equal(response.status, headers['x-test-role'] ? 403 : 401);
    }
  }
});
test('Scholar cannot enter staff directory, write another Scholar or review their own record', async () => {
  const headers = { 'x-test-role': 'Scholar', 'Content-Type': 'application/json' };
  for (const [method, path] of [['GET', '/scholar-graduations'], ['GET', '/scholar-graduations/9'], ['PUT', '/scholar-graduations/9'], ['PUT', '/scholar-graduations/7/review']]) {
    const response = await fetch(base + path, { method, headers, ...(method === 'PUT' && { body: '{}' }) }); assert.equal(response.status, 403);
  }
  seenIds = []; const response = await fetch(base + '/graduations/me?applicantId=9', { headers }); assert.equal(response.status, 200); assert.deepEqual(seenIds, [7]);
});
test('staff must have Scholars access for record and proof/review routes', async () => {
  for (const role of ['RegularAdmin', 'BillingPayrollAdmin']) {
    for (const [method, path] of [['GET', '/scholar-graduations'], ['GET', '/scholar-graduations/9'], ['GET', '/scholar-graduations/9/proof'], ['PUT', '/scholar-graduations/9'], ['PUT', '/scholar-graduations/9/review']]) {
      const response = await fetch(base + path, { method, headers: { 'x-test-role': role, 'Content-Type': 'application/json' }, ...(method === 'PUT' && { body: '{}' }) }); assert.equal(response.status, 403);
    }
    seenIds = []; const response = await fetch(base + '/scholar-graduations/9', { headers: { 'x-test-role': role, 'x-test-section': 'scholars' } }); assert.equal(response.status, 200); assert.deepEqual(seenIds, [9]);
  }
  const response = await fetch(base + '/graduations/me', { headers: { 'x-test-role': 'RegularAdmin', 'x-test-section': 'scholars' } }); assert.equal(response.status, 403);
});
