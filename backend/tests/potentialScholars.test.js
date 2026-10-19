const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPotentialScholars, initialSubmissionComplete } = require('../services/potentialScholars');
const fixture = () => ({
  period: { id: 10, school_year: '2027-2028' },
  members: [{ applicant_id: 7, application_id: 20, result_id: 30, exam_id: 40, snapshot: { resultUpdatedAt: '2026-10-01T00:00:00Z' } }],
  applicants: [{ id: 7, first_name: 'Synthetic', last_name: 'Applicant', municipality: 'TEST PLACE', school_id: 60, school_year: '2027-2028' }],
  applications: [{ id: 20, applicant_id: 7, status: 'submitted', school_plan: { incomingYearLevel: '2nd Year' }, initial_docs: { requirements: Object.fromEntries(['tax_exemption', 'valid_id', 'grades', 'registration_form'].map(key => [key, { fileName: 'synthetic.pdf', fileUrl: 'PRIVATE-DO-NOT-RETURN', status: 'Approved' }])) } }],
  results: [{ id: 30, applicant_id: 7, exam_id: 40, exam_slot_id: 50, passed: true, published_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' }],
  exams: [{ id: 40, municipality: 'Test place', academic_year: '2027-2028', updated_at: '2026-10-01T00:00:00Z' }],
  slots: [{ id: 50, applicant_id: 7, exam_id: 40 }], scholars: [], accounts: [{ applicant_id: 7, control_number: 'TEST-7' }], schools: [{ id: 60, name: 'Synthetic College', school_type: 'Public' }],
});
test('complete required files classify potential scholars without creating scholarship or returning private files', () => {
  const input = fixture(), before = JSON.stringify(input), rows = buildPotentialScholars(input);
  assert.equal(rows.length, 1); assert.equal(rows[0].status, 'Potential scholar'); assert.equal(rows[0].initialVerified, true);
  assert.equal(JSON.stringify(input), before);
  assert.doesNotMatch(JSON.stringify(rows), /PRIVATE|fileUrl|fileName|initial_docs|email|phone|score|snapshot/);
});
test('pending files remain potential until verification, while missing/rejected/unknown files exclude a record', () => {
  for (const status of ['Pending', 'Submitted', 'Under review']) {
    const input = fixture(); input.applications[0].initial_docs.requirements.valid_id.status = status;
    const rows = buildPotentialScholars(input); assert.equal(rows.length, 1); assert.equal(rows[0].initialVerified, false);
  }
  for (const status of ['Rejected', 'Not Submitted', 'unknown', '']) {
    const input = fixture(); input.applications[0].initial_docs.requirements.valid_id.status = status;
    assert.equal(buildPotentialScholars(input).length, 0);
  }
  const missing = fixture(); delete missing.applications[0].initial_docs.requirements.grades;
  assert.equal(buildPotentialScholars(missing).length, 0);
});
test('school rules preserve private tuition, first-year alternatives, optional indigency and unknown-school blocking', () => {
  const privateInput = fixture(); privateInput.schools[0].school_type = 'Private';
  assert.equal(buildPotentialScholars(privateInput).length, 0);
  privateInput.applications[0].initial_docs.requirements.tuition_receipt = { fileName: 'receipt.pdf', status: 'Approved' };
  assert.equal(buildPotentialScholars(privateInput).length, 1);
  for (const year of ['1st Year', '2nd Year']) {
    const input = fixture(); input.applications[0].school_plan.incomingYearLevel = year;
    const files = input.applications[0].initial_docs.requirements; files.report_card = files.grades; delete files.grades;
    assert.equal(buildPotentialScholars(input).length, year === '1st Year' ? 1 : 0);
  }
  assert.equal(initialSubmissionComplete([], 'Unclassified'), false);
  const unknown = fixture(); unknown.schools[0].school_type = null; assert.equal(buildPotentialScholars(unknown).length, 0);
});
test('accepted, withdrawn, stale, foreign-year and changed-assignment records never enter the queue', () => {
  const mutations = [
    x => x.scholars.push({ applicant_id: 7, is_active: true }),
    x => { x.applicants[0].deleted_at = new Date(); },
    x => { x.applications[0].status = 'withdrawn'; },
    x => { x.applicants[0].school_year = '2023-2024'; },
    x => { x.results[0].published_at = null; },
    x => { x.results[0].passed = false; },
    x => { x.results[0].updated_at = '2026-10-02T00:00:00Z'; },
    x => { x.members[0].application_id = 99; },
    x => { x.slots[0].applicant_id = 99; },
    x => { x.results[0].applicant_id = 99; },
    x => x.exams.unshift({ id: 41, municipality: 'Test place', academic_year: '2027-2028', updated_at: '2026-10-03T00:00:00Z' }),
    x => { x.members = []; },
  ];
  for (const mutate of mutations) { const input = fixture(); mutate(input); assert.equal(buildPotentialScholars(input).length, 0); }
});
test('new application supersedes old documents; duplicate passer memberships produce one row', () => {
  const input = fixture(); input.members.push(input.members[0]); assert.equal(buildPotentialScholars(input).length, 1);
  input.applications.unshift({ id: 21, applicant_id: 7, status: 'submitted', initial_docs: {} });
  assert.equal(buildPotentialScholars(input).length, 0);
});

// Exercise the actual HTTP route and its permission middleware with synthetic data.
const express = require('express'), jwt = require('jsonwebtoken');
process.env.JWT_SECRET = require('node:crypto').randomBytes(32).toString('hex');
const prisma = {}, prismaPath = require.resolve('../config/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
const { index } = require('../controllers/potentialScholarController');
const response = () => ({ statusCode: 200, headers: {}, set(k, v) { this.headers[k] = v; }, status(v) { this.statusCode = v; return this; }, json(v) { this.body = v; return this; } });
let queries, data;
const setup = () => {
  data = fixture(); queries = [];
  prisma.academic_periods = { findFirst: async () => ({ ...data.period, semester: '1st Semester', is_active: true, is_primary: true }) };
  for (const [model, key] of Object.entries({ passer_list_members: 'members', applicants: 'applicants', application_submissions: 'applications', results: 'results', exams: 'exams', exam_slots: 'slots', scholar_accounts: 'scholars', control_accounts: 'accounts', schools: 'schools' })) {
    prisma[model] = { findMany: async query => { queries.push([model, query]); return data[key]; } };
  }
  prisma.scholar_requirements = { findMany: async () => [] };
  prisma.admins = { findUnique: async ({ where }) => ({ id: where.id, is_active: true, auth_version: 0, is_super_admin: where.id === 1, role: where.id === 4 ? 'billing' : 'admin', section_access: where.id === 2 ? ['examination'] : ['applicants'] }) };
  prisma.control_accounts.findFirst = async () => ({ is_active: true, auth_version: 0 });
  prisma.applicants.findUnique = async () => ({ id: 7 }); prisma.scholar_accounts.findFirst = async () => null;
};
test('controller batches only current non-superseded posted members and emits no-store minimal records', async () => {
  setup(); const res = response(); await index({}, res);
  assert.equal(res.statusCode, 200); assert.equal(res.body.applicants.length, 1); assert.match(res.headers['Cache-Control'], /no-store/);
  const query = queries.find(([model]) => model === 'passer_list_members')[1];
  assert.deepEqual(query.where, { academic_period_id: 10, list: { status: 'posted', revisions: { none: { status: 'posted' } } } });
  data.members = []; const empty = response(); await index({}, empty); assert.deepEqual(empty.body.applicants, []);
  prisma.academic_periods.findFirst = async () => null; const noPeriod = response(); await index({}, noPeriod); assert.equal(noPeriod.body.period, null);
});
let server, base;
test.before(async () => {
  const app = express(); app.use(require('../routes/applicationRoutes'));
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); }); base = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
test('actual queue route requires administrator role and Applicants access, preserving separate examination approval access', async () => {
  const headers = (id, type = 'admin') => ({ Authorization: `Bearer ${jwt.sign({ userId: id, accountType: type, authVersion: 0 }, process.env.JWT_SECRET)}` });
  for (const [auth, expected] of [[{}, 401], [headers(7, 'control'), 403], [headers(2), 403], [headers(3), 200], [headers(4), 200], [headers(1), 200]]) {
    setup(); const res = await fetch(`${base}/applicants/complete-requirements`, { headers: auth }); assert.equal(res.status, expected);
    if (expected === 200) { const body = await res.json(); assert.equal(body.applicants.length, 1); assert.match(res.headers.get('cache-control'), /no-store/); }
  }
  setup(); const denied = await fetch(`${base}/scholars/7/accept`, { method: 'POST', headers: headers(3) }); assert.equal(denied.status, 403);
});
