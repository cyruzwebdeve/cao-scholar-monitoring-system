const assert = require('node:assert/strict');
const { test, before, after, beforeEach } = require('node:test');
const express = require('express');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('node:crypto');
const prisma = {};
const prismaPath = require.resolve('../config/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
process.env.JWT_SECRET = randomBytes(32).toString('hex');
const routes = require('../routes/applicationRoutes');
let state, server, base;
const batch = { id: 1, batch_number: 'PAY-0001', billing_period_id: 10, total_scholars: 2, status: 'generated' };
const applicant = id => ({ id, first_name: 'Synthetic', last_name: String(id), municipality: id === 7 ? 'Capalonga' : 'Sta. Elena', school_id: 1, email: `synthetic${id}@example.test` });
const withRecipients = row => row ? { ...structuredClone(row), recipients: state.recipients.filter(r => r.schedule_id === row.id).map(r => ({ ...r })) } : null;
before(async () => { const app = express(); app.use(express.json()); app.use(routes); server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); base = 'http://127.0.0.1:' + server.address().port; });
after(async () => new Promise(resolve => server.close(resolve)));
beforeEach(() => {
 state = { schedules: [], recipients: [], notices: [], failNotices: false };
 prisma.admins = { findUnique: async ({ where }) => ({ id: where.id, is_active: true, auth_version: 0, is_super_admin: where.id === 1, role: where.id === 3 ? 'billing' : 'admin', section_access: where.id === 2 ? ['settings'] : ['payroll'] }) };
 prisma.applicants = { findUnique: async ({ where }) => applicant(where.id), findMany: async ({ where }) => [7,8].filter(id => where.id.in.includes(id)).map(applicant) };
 prisma.control_accounts = { findFirst: async () => ({ is_active: true, auth_version: 0 }) };
 prisma.scholar_accounts = { findFirst: async ({ where }) => where.applicant_id === 99 ? null : ({ id: 1 }) };
 prisma.activity_logs = { create: async () => ({ id: 1 }) };
 prisma.academic_periods = { findMany: async () => [{ id: 10, school_year: '2027-2028', semester: '2nd Semester' }] };
 prisma.payroll_batches = { findUnique: async ({ where }) => where.id === 1 ? batch : where.id === 2 ? { ...batch, id: 2, batch_number: 'BILL-0002', status: 'billed' } : null, findMany: async () => [batch] };
 prisma.payroll_claims = { findMany: async () => [7,8].map(applicant_id => ({ applicant_id })) };
 prisma.scholar_requirements = { findMany: async () => [] };
 prisma.schools = { findMany: async () => [{ id: 1, name: 'Synthetic school' }] };
 prisma.payout_schedules = {
  findUnique: async ({ where }) => withRecipients(state.schedules.find(row => row.id === where.id)),
  findMany: async ({ where } = {}) => state.schedules.filter(row => !where || (where.status.in.includes(row.status) && state.recipients.some(r => r.schedule_id === row.id && r.applicant_id === where.recipients.some.applicant_id))).map(withRecipients),
  create: async ({ data }) => { const row = { id: state.schedules.length + 1, revision: 1, cancellation_reason: '', updated_at: new Date(), ...data }; state.schedules.push(row); return row; },
  update: async ({ where, data }) => { const row = state.schedules.find(row => row.id === where.id); Object.assign(row, { ...data, revision: row.revision + 1 }); return row; },
 };
 prisma.payout_schedule_recipients = {
  deleteMany: async ({ where }) => { state.recipients = state.recipients.filter(r => r.schedule_id !== where.schedule_id); },
  createMany: async ({ data }) => { for (const row of data) { if (row.active && state.recipients.some(r => r.active && r.payroll_batch_id === row.payroll_batch_id && r.applicant_id === row.applicant_id)) throw Object.assign(new Error('Duplicate'), { code: 'P2002' }); state.recipients.push({ ...row }); } },
  updateMany: async ({ where, data }) => { state.recipients.filter(r => r.schedule_id === where.schedule_id).forEach(r => Object.assign(r, data)); },
 };
 prisma.scholar_notifications = { createMany: async ({ data }) => { if (state.failNotices) throw new Error('Synthetic notification failure'); state.notices.push(...data); } };
 prisma.$transaction = async (callback, options) => { assert.equal(options.isolationLevel, 'Serializable'); const snapshot = structuredClone(state); try { return await callback(prisma); } catch (error) { state = snapshot; throw error; } };
});
const token = (id, accountType = 'admin') => jwt.sign({ userId: id, accountType, authVersion: 0 }, process.env.JWT_SECRET);
async function request(path, { id = 1, accountType, method = 'GET', body } = {}) {
 const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(id ? { Authorization: 'Bearer ' + token(id, accountType) } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
 return { status: response.status, body: await response.json(), cache: response.headers.get('cache-control') };
}
const payload = extra => ({ action: 'publish', batchId: 1, applicantIds: [7], title: 'Synthetic schedule', venue: 'Designated school venue', startsAt: '2030-01-01T01:00:00Z', endsAt: null, instructions: 'Bring identification.', ...extra });
const save = body => request('/payroll/schedules', { method: 'POST', body });
const edit = body => request('/payroll/schedules/1', { method: 'PUT', body });
test('real routes enforce authentication, Payroll section, staff role and Scholar-only ownership', async () => {
 for (const [id, accountType, expected] of [[null,undefined,401],[2,'admin',403],[7,'applicant',403],[99,'applicant',403],[3,'admin',200],[1,'admin',200]]) {
  assert.equal((await request('/payroll/schedules/management', { id, accountType })).status, expected);
  assert.equal((await request('/payroll/schedule-batches/1', { id, accountType })).status, expected);
  assert.equal((await request('/payroll/schedules', { id, accountType, method: 'POST', body: payload() })).status, expected === 200 ? (id === 1 ? 409 : 201) : expected);
 }
 assert.equal((await request('/payout-schedules/me', { id: 1 })).status, 403);
 assert.equal((await request('/payout-schedules/me', { id: 99, accountType: 'applicant' })).status, 403);
 assert.equal((await request('/payroll/schedules/1', { id: 2, method: 'PUT', body: payload() })).status, 403);
});
test('drafts stay private; publishing targets only selected batch members without leaking the roster', async () => {
 assert.equal((await save(payload({ action: 'draft' }))).status, 201); assert.equal(state.notices.length, 0);
 assert.deepEqual((await request('/payout-schedules/me', { id: 7, accountType: 'applicant' })).body.schedules, []);
 assert.equal((await edit(payload({ revision: 1 }))).status, 200); assert.equal(state.notices.length, 1); assert.equal(state.notices[0].applicant_id, 7);
 const mine = await request('/payout-schedules/me', { id: 7, accountType: 'applicant' });
 assert.match(mine.cache, /no-store/); assert.equal(mine.body.schedules.length, 1); assert.equal(mine.body.schedules[0].reference, 'PAY-0001'); assert.equal('applicantIds' in mine.body.schedules[0], false);
 assert.deepEqual((await request('/payout-schedules/me', { id: 8, accountType: 'applicant' })).body.schedules, []);
});
test('published changes notify the same recipients; stale changes and audience replacement are rejected', async () => {
 await save(payload());
 assert.equal((await edit(payload({ revision: 0 }))).status, 409);
 assert.equal((await edit(payload({ revision: 1, applicantIds: [8] }))).status, 409);
 assert.equal((await edit(payload({ revision: 1, venue: 'New venue', startsAt: '2030-02-01T01:00:00Z' }))).status, 200);
 assert.equal(state.notices.length, 2); assert.match(state.notices[1].message, /Updated schedule.*New venue/);
 assert.equal((await edit(payload({ revision: 1 }))).status, 409);
});
test('duplicate published assignments roll back; cancellation notifies and frees the recipient', async () => {
 await save(payload()); assert.equal((await save(payload())).status, 409); assert.equal(state.schedules.length, 1); assert.equal(state.notices.length, 1);
 assert.equal((await save(payload({ applicantIds: [8] }))).status, 201);
 assert.equal((await edit({ action: 'cancel', revision: 1, cancellationReason: 'Venue unavailable.' })).status, 200);
 assert.equal(state.notices.length, 3); assert.match(state.notices[2].message, /cancelled.*Venue unavailable/);
 assert.equal((await edit({ action: 'cancel', revision: 2, cancellationReason: '' })).status, 409);
 assert.equal((await save(payload())).status, 201);
 const mine = await request('/payout-schedules/me', { id: 7, accountType: 'applicant' }); assert.deepEqual(mine.body.schedules.map(row => row.status), ['cancelled','published']);
});
test('nonmembers and Billing batches are rejected; notification failure rolls back schedule and recipients', async () => {
 assert.equal((await save(payload({ applicantIds: [100] }))).status, 400);
 assert.equal((await save(payload({ batchId: 2 }))).status, 404);
 assert.equal((await request('/payroll/schedule-batches/2')).status, 404);
 assert.equal(state.schedules.length, 0);
 state.failNotices = true; assert.equal((await save(payload())).status, 500); assert.equal(state.schedules.length, 0); assert.equal(state.recipients.length, 0);
});
