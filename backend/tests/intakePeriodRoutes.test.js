const test = require('node:test');
const { before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('node:crypto');
const prisma = {};
const id = require.resolve('../config/prisma');
require.cache[id] = { id, filename: id, loaded: true, exports: prisma };
const secret = randomBytes(32).toString('hex');
process.env.JWT_SECRET = secret;
const handlers = require('../controllers/intakePeriodController');
const reached = [];
handlers.getIntakePeriod = (req, res) => { reached.push('get'); res.json({ intakePeriod: null, revision: 0 }); };
handlers.updateIntakePeriod = (req, res) => { reached.push('save'); res.status(204).end(); };
const router = require('../routes/applicationRoutes');
let server, base, role, sections;
prisma.admins = { findUnique: async ({ where }) => ({ id: where.id, role: role === 'BillingPayrollAdmin' ? 'billing' : 'admin',
  is_super_admin: role === 'SuperAdmin', is_active: true, auth_version: 0, section_access: sections }) };
prisma.control_accounts = { findFirst: async () => ({ applicant_id: 7, is_active: true, auth_version: 0 }) };
prisma.applicants = { findUnique: async () => ({ id: 7, email: 'synthetic@example.test', first_name: 'Synthetic', last_name: 'Applicant' }) };
prisma.scholar_accounts = { findFirst: async () => role === 'Scholar' ? { id: 4, is_active: true } : null };
prisma.activity_logs = { create: async () => ({}) };
before(async () => {
  const app = express(); app.use(express.json()); app.use(router);
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
const request = async (method, withAuth = true) => {
  const accountType = ['Applicant', 'Scholar'].includes(role) ? 'applicant' : 'admin';
  const token = jwt.sign({ userId: accountType === 'admin' ? 99 : 7, accountType, authVersion: 0 }, secret);
  return fetch(base + '/intake-period', { method,
    headers: { 'Content-Type': 'application/json', ...(withAuth ? { Authorization: `Bearer ${token}` } : {}) },
    ...(method === 'GET' ? {} : { body: '{}' }) });
};

test('public intake year can be read without exposing an administrative write', async () => {
  reached.length = 0;
  const res = await request('GET', false);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { intakePeriod: null, revision: 0 });
  assert.deepEqual(reached, ['get']);
  reached.length = 0;
  assert.equal((await request('PUT', false)).status, 401);
  assert.deepEqual(reached, []);
});

test('intake changes require Settings permission for every eligible staff role', async () => {
  for (role of ['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']) {
    sections = ['settings']; reached.length = 0;
    assert.equal((await request('PUT')).status, 204, role);
    assert.deepEqual(reached, ['save']);
    if (role !== 'SuperAdmin') {
      sections = []; reached.length = 0;
      assert.equal((await request('PUT')).status, 403, role);
      assert.deepEqual(reached, []);
    }
  }
});

test('Applicant and Scholar accounts cannot change the intake selection', async () => {
  for (role of ['Applicant', 'Scholar']) {
    reached.length = 0;
    assert.equal((await request('PUT')).status, 403, role);
    assert.deepEqual(reached, []);
  }
});
