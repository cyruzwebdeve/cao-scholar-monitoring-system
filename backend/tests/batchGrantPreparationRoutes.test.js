const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('node:crypto');
const prisma = {}, prismaPath = require.resolve('../config/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
const secret = randomBytes(32).toString('hex'); process.env.JWT_SECRET = secret;
let reached = 0, server, base, role, sections;
require('../controllers/grantPreparationController').saveBatch = (_req, res) => { reached += 1; res.json({ reached: true }); };
const router = require('../routes/applicationRoutes');
Object.assign(prisma, {
  admins: { findUnique: async ({ where }) => ({ id: where.id, role: role === 'BillingPayrollAdmin' ? 'billing' : 'admin',
    is_super_admin: role === 'SuperAdmin', is_active: true, auth_version: 0, section_access: sections }) },
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
async function call(withAuth = true) {
  const accountType = ['Applicant', 'Scholar'].includes(role) ? 'applicant' : 'admin';
  const token = jwt.sign({ userId: accountType === 'admin' ? 99 : 7, accountType, authVersion: 0 }, secret);
  return fetch(`${base}/scholars/grant-preparation/batch`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(withAuth ? { Authorization: `Bearer ${token}` } : {}) }, body: '{}' });
}
test('the batch grant route requires authentication, allowed staff role and Billing section access', async () => {
  role = 'RegularAdmin'; sections = ['billing']; reached = 0;
  let res = await call(false); assert.equal(res.status, 401); assert.equal(reached, 0); assert.match(res.headers.get('cache-control'), /private/);
  for (role of ['Applicant', 'Scholar']) { res = await call(); assert.equal(res.status, 403); assert.equal(reached, 0); }
  for (role of ['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']) {
    sections = ['billing']; reached = 0; res = await call(); assert.equal(res.status, 200); assert.equal(reached, 1); assert.match(res.headers.get('cache-control'), /no-store/);
    if (role !== 'SuperAdmin') {
      for (sections of [[], ['scholars'], ['payroll']]) { reached = 0; res = await call(); assert.equal(res.status, 403); assert.equal(reached, 0); }
    }
  }
});
