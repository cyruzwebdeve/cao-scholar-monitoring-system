const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('node:crypto');
const prisma = {}, prismaPath = require.resolve('../config/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
const secret = randomBytes(32).toString('hex'); process.env.JWT_SECRET = secret;
const reached = [];
const factory = require('../controllers/scholarCertificationController');
factory.createScholarCertificationController = () => Object.fromEntries(['index', 'prepare', 'save', 'file'].map(action => [action, (req, res) => { reached.push(action); res.json({ action }); }]));
const router = require('../routes/applicationRoutes');
let server, base, role, sections;
Object.assign(prisma, {
  admins: { findUnique: async ({ where }) => ({ id: where.id, role: role === 'BillingPayrollAdmin' ? 'billing' : 'admin', is_super_admin: role === 'SuperAdmin', is_active: true, auth_version: 0, section_access: sections }) },
  control_accounts: { findFirst: async () => ({ applicant_id: 7, is_active: true, auth_version: 0 }) },
  applicants: { findUnique: async () => ({ id: 7, email: 'synthetic@example.test', first_name: 'Synthetic', last_name: 'Scholar' }) },
  scholar_accounts: { findFirst: async () => role === 'Scholar' ? { id: 4, is_active: true } : null },
  activity_logs: { create: async () => ({}) },
});
before(async () => {
  const app = express(); app.use(express.json()); app.use(router); server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
const endpoints = [['GET', '/scholars/7/certifications', 'index'], ['POST', '/scholars/7/certifications/prepare', 'prepare'], ['POST', '/scholars/7/certifications', 'save'], ['GET', '/scholars/7/certifications/1/file', 'file']];
async function request(method, path, withAuth = true) {
  const accountType = ['Applicant', 'Scholar'].includes(role) ? 'applicant' : 'admin';
  const token = jwt.sign({ userId: accountType === 'admin' ? 99 : 7, accountType, authVersion: 0 }, secret);
  return fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(withAuth ? { Authorization: `Bearer ${token}` } : {}) }, ...(method === 'GET' ? {} : { body: '{}' }) });
}
test('all certification routes enforce authentication, authorized staff roles and Scholars section assignment', async () => {
  for (const [method, path, action] of endpoints) {
    role = 'RegularAdmin'; sections = ['scholars']; reached.length = 0;
    let res = await request(method, path, false); assert.equal(res.status, 401); assert.match(res.headers.get('cache-control'), /private/); assert.deepEqual(reached, []);
    for (role of ['Applicant', 'Scholar']) { res = await request(method, path); assert.equal(res.status, 403); assert.deepEqual(reached, []); }
    for (role of ['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']) {
      sections = ['scholars']; reached.length = 0; res = await request(method, path); assert.equal(res.status, 200); assert.deepEqual(reached, [action]); assert.match(res.headers.get('cache-control'), /no-store/);
      if (role !== 'SuperAdmin') { sections = ['billing']; reached.length = 0; res = await request(method, path); assert.equal(res.status, 403); assert.deepEqual(reached, []); }
    }
  }
});
