const assert = require('node:assert/strict');
const test = require('node:test');
const { before, after } = test;
const express = require('express');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = require('node:crypto').randomBytes(32).toString('hex');
process.env.NODE_ENV = 'test';
delete process.env.DOCUMENT_BLOB_READ_WRITE_TOKEN;
const prisma = {};
const prismaPath = require.resolve('../config/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
const { uploadMyRequirement, uploadScholarRequirementByAdmin, openContinuingRequirements, updateScholarBillingMetadata } = require('../controllers/applicationController');
delete process.env.DOCUMENT_BLOB_READ_WRITE_TOKEN;
const { reviewDocument, approvePendingDocuments, streamDocument, streamMyDocument } = require('../controllers/documentReviewController');
const { getWaveSet, getEffectiveRequirements, getScopedDocument } = require('../services/requirementWaves');
const { buildReviewRecords } = require('../services/documentReview');
const clone = (value) => structuredClone(value);
const response = () => ({ locals: {}, statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, setHeader() {}, send(body) { this.sent = body; return this; } });
let application; let inactive; let schoolType; let deadline; let conflicts; let writes;
const setup = (options = {}) => {
  inactive = options.inactive || false; schoolType = options.schoolType || 'private'; deadline = options.deadline || null; conflicts = 0; writes = 0;
  application = { id: 1, applicant_id: 7, status: 'Accepted', initial_docs: options.docs || { requirements: { tax_exemption: { fileName: 'legacy.pdf', fileData: 'data:application/pdf;base64,JVBERi0xLjQK', status: 'Approved', reviewedBy: 2, reviewedAt: '2026-09-01T00:00:00Z' } } } };
  const period = { id: 10, is_active: true, is_primary: true, school_year: '2026-2027', semester: '1st Semester', requirements_deadline: deadline };
  const applications = {
    findFirst: async () => clone(application), findUnique: async () => clone(application),
    updateMany: async ({ where, data }) => {
      if (where.initial_docs && JSON.stringify(application.initial_docs) !== JSON.stringify(where.initial_docs.equals)) { conflicts += 1; return { count: 0 }; }
      application = { ...application, ...clone(data) }; writes += 1; return { count: 1 };
    },
  };
  Object.assign(prisma, {
    application_submissions: applications,
    academic_periods: { findFirst: async ({ where }) => where?.id === 99 ? null : { ...period, id: where?.id || 10 } },
    scholar_accounts: { findFirst: async () => inactive ? null : { id: 1, applicant_id: 7, is_active: true } },
    admins: { findUnique: async ({ where }) => ({ id: where.id, is_active: true, auth_version: 0, is_super_admin: where.id === 9, role: where.id === 4 ? 'billing' : 'admin', section_access: where.id === 3 ? ['examination'] : ['scholars'] }) },
    control_accounts: { findFirst: async () => ({ applicant_id: 7, is_active: true, auth_version: 0 }) },
    activity_logs: { create: async () => ({ id: 1 }) },
    applicants: { findUnique: async () => ({ id: 7, school_id: 1 }) },
    scholar_requirements: { findMany: async () => [], findUnique: async () => ({ applicant_id: 7, school_id: 1, billing_period_id: 10 }) },
    schools: { findMany: async () => [{ id: 1, name: 'TEST SCHOOL', school_type: schoolType }], findUnique: async () => ({ id: 1, name: 'TEST SCHOOL', school_type: schoolType }) },
    $transaction: async (callback) => callback(prisma),
  });
};
const file = (name = 'fixture.pdf') => ({ fileName: name, fileData: 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4\nsynthetic fixture\n%%EOF').toString('base64') });
const ownDocument = async (key = 'tax_exemption', query = {}, user = { id: 7, role: 'Scholar' }) => {
  const res = response(); res.headers = {}; res.setHeader = (name, value) => { res.headers[name] = value; };
  await streamMyDocument({ params: { requirementKey: key }, query: { academicPeriodId: '10', submissionWave: 'initial', ...query }, user }, res);
  return res;
};

test('own document stream serves authenticated applicant and scholar files without private URLs', async () => {
  for (const role of ['Applicant', 'Scholar']) {
    setup({ inactive: role === 'Applicant' });
    let lookup;
    prisma.application_submissions.findFirst = async (args) => { lookup = args; return clone(application); };
    const res = await ownDocument('tax_exemption', {}, { id: 7, role });
    assert.equal(lookup.where.applicant_id, 7);
    assert.equal(res.statusCode, 200); assert.ok(Buffer.isBuffer(res.sent));
    assert.equal(res.headers['Content-Type'], 'application/pdf');
    assert.equal(res.headers['Cache-Control'], 'private, no-store');
    assert.equal(res.headers['X-Content-Type-Options'], 'nosniff');
    assert.equal(res.body, undefined);
  }
});
test('own document stream fails closed for foreign or missing applications and staff roles', async () => {
  setup(); assert.equal((await ownDocument('tax_exemption', {}, { id: 8, role: 'Scholar' })).statusCode, 404);
  prisma.application_submissions.findFirst = async () => null;
  assert.equal((await ownDocument()).statusCode, 404);
  for (const role of ['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']) assert.equal((await ownDocument('tax_exemption', {}, { id: 7, role })).statusCode, 403);
});
test('own document scope rejects malformed keys, waves, periods, and archived-version requests', async () => {
  setup();
  for (const key of ['unknown', 'priority_pwd', '../grades']) assert.equal((await ownDocument(key)).statusCode, 400);
  for (const query of [{ academicPeriodId: '0' }, { academicPeriodId: '1.5' }, { academicPeriodId: 'no' }, { submissionWave: 'other' }, { versionId: 'archived' }]) assert.equal((await ownDocument('tax_exemption', query)).statusCode, 400);
  assert.equal((await ownDocument('tax_exemption', { submissionWave: 'continuing' })).statusCode, 400);
  assert.equal((await ownDocument('valid_id')).statusCode, 404);
});
test('own initial preview inherits originals while continuing never falls back to initial files', async () => {
  setup(); await adminUpload('grades');
  assert.equal((await ownDocument('grades', { academicPeriodId: '11' })).statusCode, 200);
  assert.equal((await ownDocument('grades', { submissionWave: 'continuing' })).statusCode, 404);
  await open(); await scholarUpload('grades');
  assert.equal((await ownDocument('grades', { submissionWave: 'continuing' })).statusCode, 200);
  assert.equal((await ownDocument('grades', { academicPeriodId: '11', submissionWave: 'continuing' })).statusCode, 404);
});
test('own file route rejects anonymous and staff users and never opens the staff review endpoint to applicants', async () => {
  setup();
  const path = '/applications/me/requirements/tax_exemption/file?academicPeriodId=10&submissionWave=initial';
  for (const headers of [{}, authHeader(9), authHeader(4), authHeader(3)]) {
    const res = await fetch(baseUrl + path, { headers }); assert.equal(res.status, headers.Authorization ? 403 : 401);
  }
  const res = await fetch(baseUrl + path, { headers: authHeader(7, 'control') }); assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'private, no-store');
  const staff = await fetch(baseUrl + '/document-reviews/1/tax_exemption/file?academicPeriodId=10&submissionWave=initial', { headers: authHeader(7, 'control') });
  assert.equal(staff.status, 403);
});
const adminUpload = async (key, periodId = 10, name) => { const res = response(); await uploadScholarRequirementByAdmin({ params: { applicantId: '7', requirementKey: key }, body: { academicPeriodId: periodId, ...file(name) }, user: { id: 9, role: 'SuperAdmin' } }, res); return res; };
const open = async (periodId = 10) => { if (periodId !== 99) for (const key of ['tax_exemption', 'valid_id', 'grades', 'registration_form', ...(schoolType === 'private' ? ['tuition_receipt'] : [])]) { if (!getWaveSet(application.initial_docs, 10, 'initial').requirements[key]?.fileName) await adminUpload(key); } const res = response(); await openContinuingRequirements({ params: { applicantId: '7' }, body: { academicPeriodId: periodId }, user: { id: 9, role: 'SuperAdmin' } }, res); return res; };
const scholarUpload = async (key, periodId = 10, name) => { const res = response(); await uploadMyRequirement({ body: { requirement: key, academicPeriodId: periodId, ...file(name) }, user: { id: 7, role: 'Scholar' } }, res); return res; };
const review = async (key, document, decision = 'approved', extra = {}) => {
  const res = response(); await reviewDocument({ params: { applicationId: '1', requirementKey: key }, body: { academicPeriodId: 10, submissionWave: 'continuing', versionId: document.versionId, revision: document.revision, decision, notes: decision === 'rejected' ? 'Please provide a readable scan.' : '', ...extra }, user: { id: 11 } }, res); return res;
};

test('first-year report card can replace initial COG but cannot replace continuing college grades', async () => {
  setup({ schoolType: 'public' }); application.school_plan = { incomingYearLevel: '1st Year' };
  for (const key of ['tax_exemption', 'valid_id', 'report_card', 'registration_form']) assert.equal((await adminUpload(key)).statusCode, 200);
  assert.equal((await ownDocument('report_card')).statusCode, 200);
  const initial = clone(getWaveSet(application.initial_docs, 10, 'initial'));
  assert.equal(initial.requirements.grades, undefined);
  assert.equal((await scholarUpload('report_card')).statusCode, 400);
  assert.equal((await scholarUpload('grades')).statusCode, 200);
  assert.deepEqual(getWaveSet(application.initial_docs, 10, 'initial'), initial);
  assert.equal(getWaveSet(application.initial_docs, 10, 'continuing').requirements.report_card, undefined);
  assert.equal(getWaveSet(application.initial_docs, 10, 'continuing').requirements.grades.status, 'Pending');
});

test('initial report-card uploads fail closed for higher-year or unknown entry level', async () => {
  for (const year of ['2nd Year', null]) {
    setup(); application.school_plan = { incomingYearLevel: year };
    assert.equal((await adminUpload('report_card')).statusCode, 400);
    assert.equal(writes, 0);
  }
});

test('Admin can record all six initial files for Private scholars without overwriting legacy data', async () => {
  setup();
  for (const key of ['tax_exemption', 'indigency', 'valid_id', 'grades', 'registration_form', 'tuition_receipt']) assert.equal((await adminUpload(key)).statusCode, 200);
  const initial = getWaveSet(application.initial_docs, 10, 'initial');
  assert.equal(Object.keys(initial.requirements).length, 6);
  assert.equal(initial.requirements.grades.status, 'Approved');
  assert.equal(initial.requirements.grades.uploadedByRole, 'SuperAdmin');
  assert.equal(application.initial_docs.requirements.tax_exemption.fileName, 'legacy.pdf');
  assert.equal(initial.history[0].fileName, 'legacy.pdf');
});
test('Public initial and continuing tuition receipts are rejected', async () => {
  setup({ schoolType: 'public' });
  assert.equal((await adminUpload('tuition_receipt')).statusCode, 400);
  await open(); assert.equal((await scholarUpload('tuition_receipt')).statusCode, 400);
});
test('Scholar cannot upload the initial trio or submit before CAO opens continuing wave', async () => {
  setup();
  for (const key of ['tax_exemption', 'indigency', 'valid_id']) assert.equal((await scholarUpload(key)).statusCode, 400);
  assert.equal((await scholarUpload('grades')).statusCode, 403);
  assert.equal(writes, 0);
});
test('second wave can open within the same period without modifying initial files', async () => {
  setup(); await adminUpload('grades', 10, 'initial-grades.pdf');
  assert.equal((await open()).statusCode, 200);
  const before = clone(getWaveSet(application.initial_docs, 10, 'initial'));
  assert.equal((await scholarUpload('grades', 10, 'continuing-grades.pdf')).statusCode, 200);
  assert.deepEqual(getWaveSet(application.initial_docs, 10, 'initial'), before);
  assert.equal(getWaveSet(application.initial_docs, 10, 'continuing').requirements.grades.status, 'Pending');
  assert.equal(getEffectiveRequirements(application.initial_docs, 10).requirements.grades.fileName, 'continuing-grades.pdf');
});
test('continuing must not fall back to initial grade files or approvals', async () => {
  setup(); await adminUpload('grades'); await open();
  assert.equal(getEffectiveRequirements(application.initial_docs, 10).requirements.grades, undefined);
  assert.equal(getWaveSet(application.initial_docs, 10, 'initial').requirements.grades.status, 'Approved');
});
test('next active academic period opens automatically but keeps separate continuing files', async () => {
  setup(); await adminUpload('grades', 10, 'period-10.pdf'); await open(10); await scholarUpload('grades', 10, 'continuing-10.pdf');
  assert.equal((await scholarUpload('grades', 11)).statusCode, 200);
  await adminUpload('grades', 11, 'period-11.pdf');
  assert.equal(getWaveSet(application.initial_docs, 11, 'initial').requirements.grades.fileName, 'period-11.pdf');
  assert.equal(getWaveSet(application.initial_docs, 10, 'continuing').requirements.grades.fileName, 'continuing-10.pdf');
});
test('simultaneous Admin uploads retain both documents through JSON compare-and-swap retries', async () => {
  setup(); const results = await Promise.all([adminUpload('grades'), adminUpload('registration_form')]);
  assert.deepEqual(results.map(({ statusCode }) => statusCode), [200, 200]);
  const docs = getWaveSet(application.initial_docs, 10, 'initial').requirements;
  assert.ok(docs.grades && docs.registration_form); assert.ok(conflicts > 0);
});
test('concurrent Admin and Scholar uploads retain separate waves', async () => {
  setup(); await open();
  const results = await Promise.all([adminUpload('grades', 10, 'initial.pdf'), scholarUpload('grades', 10, 'continuing.pdf')]);
  assert.deepEqual(results.map(({ statusCode }) => statusCode), [200, 200]);
  assert.equal(getWaveSet(application.initial_docs, 10, 'initial').requirements.grades.fileName, 'initial.pdf');
  assert.equal(getWaveSet(application.initial_docs, 10, 'continuing').requirements.grades.fileName, 'continuing.pdf');
});
test('replacement retains old file, approval, and metadata as an addressable previous version', async () => {
  setup(); await open(); await scholarUpload('grades', 10, 'old.pdf');
  const old = clone(getWaveSet(application.initial_docs, 10, 'continuing').requirements.grades);
  assert.equal((await review('grades', old)).statusCode, 200);
  await scholarUpload('grades', 10, 'new.pdf');
  const archived = getScopedDocument(application.initial_docs, 10, 'continuing', 'grades', old.versionId);
  assert.equal(archived.fileName, 'old.pdf'); assert.equal(archived.status, 'Approved');
  assert.equal(getWaveSet(application.initial_docs, 10, 'continuing').requirements.grades.status, 'Pending');
});
test('review of a replaced file is rejected instead of approving the new upload', async () => {
  setup(); await open(); await scholarUpload('grades');
  const old = clone(getWaveSet(application.initial_docs, 10, 'continuing').requirements.grades);
  await scholarUpload('grades', 10, 'new.pdf');
  assert.equal((await review('grades', old)).statusCode, 409);
  assert.equal(getWaveSet(application.initial_docs, 10, 'continuing').requirements.grades.status, 'Pending');
});
test('competing review revisions are rejected and prior decisions retained', async () => {
  setup(); await open(); await scholarUpload('grades');
  const current = clone(getWaveSet(application.initial_docs, 10, 'continuing').requirements.grades);
  assert.equal((await review('grades', current, 'rejected')).statusCode, 200);
  assert.equal((await review('grades', current)).statusCode, 409);
  const rejected = clone(getWaveSet(application.initial_docs, 10, 'continuing').requirements.grades);
  assert.equal((await review('grades', rejected)).statusCode, 200);
  assert.equal(getWaveSet(application.initial_docs, 10, 'continuing').requirements.grades.reviewHistory[0].status, 'Rejected');
});
test('scoped bulk approval changes only pending files in the selected period and wave', async () => {
  setup(); await adminUpload('grades'); await open(); await scholarUpload('grades'); await scholarUpload('registration_form');
  await open(11); await scholarUpload('grades', 11);
  const documents = Object.entries(getWaveSet(application.initial_docs, 10, 'continuing').requirements).map(([requirementKey, file]) => ({ requirementKey, versionId: file.versionId, revision: file.revision }));
  const res = response(); await approvePendingDocuments({ params: { applicationId: '1' }, body: { academicPeriodId: 10, submissionWave: 'continuing', documents }, user: { id: 11 } }, res);
  assert.equal(res.statusCode, 200); assert.equal(res.body.approvedCount, 2);
  assert.equal(getWaveSet(application.initial_docs, 11, 'continuing').requirements.grades.status, 'Pending');
});
test('review queue identifies identical requirement types by period and wave', async () => {
  setup(); await adminUpload('grades'); await open(); await scholarUpload('grades');
  const records = buildReviewRecords({ applications: [application], applicantsById: new Map(), accountsByApplicant: new Map(), legacyPeriodId: 10 });
  const grades = records.filter(({ requirementKey }) => requirementKey === 'grades');
  assert.equal(grades.length, 2); assert.notEqual(grades[0].id, grades[1].id);
  assert.deepEqual(new Set(grades.map(({ submissionWave }) => submissionWave)), new Set(['initial','continuing']));
  assert.equal(records.some((r) => 'fileData' in r || 'fileUrl' in r), false);
});
test('archived file streaming selects exact wave and version without returning newer contents', async () => {
  setup(); await open(); await scholarUpload('grades', 10, 'old.pdf');
  const version = getWaveSet(application.initial_docs, 10, 'continuing').requirements.grades.versionId;
  await scholarUpload('grades', 10, 'new.pdf');
  const res = response(); await streamDocument({ params: { applicationId: '1', requirementKey: 'grades' }, query: { academicPeriodId: '10', submissionWave: 'continuing', versionId: version } }, res);
  assert.equal(res.statusCode, 200); assert.ok(res.sent); assert.match(res.sent.toString(), /%PDF/);
});
test('inactive scholars and invalid/inactive period selections cannot write any wave', async () => {
  setup({ inactive: true }); assert.equal((await adminUpload('grades')).statusCode, 409); assert.equal((await open()).statusCode, 404); assert.equal(writes, 0);
  setup(); assert.equal((await adminUpload('grades', 99)).statusCode, 400); assert.equal((await open(99)).statusCode, 400); assert.equal(writes, 0);
});
test('period closure blocks continuing uploads without blocking authorized initial intake', async () => {
  setup({ deadline: new Date('2020-01-01T00:00:00Z') }); await open();
  prisma.continuing_requirement_schedules = { findUnique: async () => ({ uploads_open: false }) };
  assert.equal((await scholarUpload('grades')).statusCode, 403);
  assert.equal((await adminUpload('grades')).statusCode, 200);
  delete prisma.continuing_requirement_schedules;
});


test('priority proof review merges only its own proof and preserves initial/continuing sets', async () => {
  setup(); await adminUpload('grades'); await open(); await scholarUpload('grades');
  application.initial_docs.requirements.priority_pwd = { ...file('proof.pdf'), status: 'Pending' };
  application.eligibility = { pwd: 'Yes' };
  const beforeSets = clone(application.initial_docs.requirementSets);
  const res = response();
  await reviewDocument({ params: { applicationId: '1', requirementKey: 'priority_pwd' }, body: { decision: 'approved', notes: '' }, user: { id: 11 } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(application.initial_docs.requirementSets, beforeSets);
  assert.equal(application.initial_docs.requirements.priority_pwd.status, 'Approved');
});

let server; let baseUrl;
before(async () => {
  const app = express(); app.use(express.json()); app.use(require('../routes/applicationRoutes'));
  server = app.listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise((resolve) => server.close(resolve)); });
const authHeader = (id, accountType = 'admin') => ({ Authorization: `Bearer ${jwt.sign({ userId: id, accountType, authVersion: 0 }, process.env.JWT_SECRET)}` });
test('actual wave-opening and initial-upload routes reject anonymous, Scholar and staff without Scholars access', async () => {
  for (const headers of [{}, authHeader(7, 'control'), authHeader(3)]) {
    for (const url of ['/scholars/7/continuing-requirements/open', '/scholars/7/requirements/grades']) {
      setup(); const res = await fetch(baseUrl + url, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ academicPeriodId: 10, ...file() }) });
      assert.equal(res.status, headers.Authorization ? 403 : 401); assert.equal(writes, 0);
    }
  }
});
test('Billing with Scholars access can open continuing requirements and upload initial files through real controllers', async () => {
  for (const url of ['/scholars/7/continuing-requirements/open', '/scholars/7/requirements/grades']) {
    setup();
    const res = await fetch(baseUrl + url, { method: 'PUT', headers: { ...authHeader(4), 'Content-Type': 'application/json' }, body: JSON.stringify({ academicPeriodId: 10, ...file() }) });
    assert.equal(res.status, 200);
    assert.ok(writes > 0);
  }
});

test('actual Scholar-only continuing endpoint denies staff and enforces wave opening for Scholar', async () => {
  setup();
  const body = JSON.stringify({ academicPeriodId: 10, requirement: 'grades', ...file() });
  const admin = await fetch(baseUrl + '/applications/me/requirements', { method: 'PUT', headers: { ...authHeader(9), 'Content-Type': 'application/json' }, body });
  assert.equal(admin.status, 403);
  const closed = await fetch(baseUrl + '/applications/me/requirements', { method: 'PUT', headers: { ...authHeader(7, 'control'), 'Content-Type': 'application/json' }, body });
  assert.equal(closed.status, 403);
  await open();
  const opened = await fetch(baseUrl + '/applications/me/requirements', { method: 'PUT', headers: { ...authHeader(7, 'control'), 'Content-Type': 'application/json' }, body });
  assert.equal(opened.status, 200);
});


test('bulk approval rejects a replacement made after the approval dialog opened', async () => {
  setup(); await open(); await scholarUpload('grades');
  const document = clone(getWaveSet(application.initial_docs, 10, 'continuing').requirements.grades);
  await scholarUpload('grades', 10, 'new.pdf');
  const res = response();
  await approvePendingDocuments({ params: { applicationId: '1' }, body: { academicPeriodId: 10, submissionWave: 'continuing', documents: [{ requirementKey: 'grades', versionId: document.versionId, revision: document.revision }] }, user: { id: 11 } }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(getWaveSet(application.initial_docs, 10, 'continuing').requirements.grades.status, 'Pending');
});


test('continuing in a later period reuses original initial identity documents but requires new academic files', async () => {
  setup(); await adminUpload('valid_id', 10, 'initial-id.pdf'); await adminUpload('indigency', 10); await adminUpload('grades', 10, 'initial-grade.pdf');
  await open(11);
  const effective = getEffectiveRequirements(application.initial_docs, 11);
  assert.equal(effective.requirements.valid_id.fileName, 'initial-id.pdf');
  assert.equal(effective.requirements.grades, undefined);
  await scholarUpload('grades', 11, 'next-period-grade.pdf');
  assert.equal(getEffectiveRequirements(application.initial_docs, 11).requirements.grades.fileName, 'next-period-grade.pdf');
  assert.equal(getWaveSet(application.initial_docs, 10, 'initial').requirements.grades.fileName, 'initial-grade.pdf');
});

test('missing explicit academic period is rejected before any wave is written', async () => {
  setup(); const res = response();
  await uploadScholarRequirementByAdmin({ params: { applicantId: '7', requirementKey: 'grades' }, body: file(), user: { id: 9 } }, res);
  assert.equal(res.statusCode, 400); assert.equal(writes, 0);
});

test('Scheduled period opens automatically after all initial approvals without per-scholar opening', async () => {
  setup({ schoolType: 'public' });
  prisma.continuing_requirement_schedules = { findUnique: async () => ({ opens_at: new Date(Date.now() - 60000), closes_at: new Date(Date.now() + 60000), late_scope: 'all', late_applicant_ids: [] }) };
  for (const key of ['tax_exemption', 'indigency', 'valid_id', 'grades', 'registration_form']) assert.equal((await adminUpload(key)).statusCode, 200);
  assert.equal((await scholarUpload('grades')).statusCode, 200);
  assert.equal(getWaveSet(application.initial_docs, 10, 'initial').requirements.grades.status, 'Approved');
  assert.equal(getWaveSet(application.initial_docs, 10, 'continuing').requirements.grades.status, 'Pending');
  delete prisma.continuing_requirement_schedules;
});
test('Scheduled period rejects incomplete initial set even if legacy manual opening exists', async () => {
  setup({ schoolType: 'public' }); application.initial_docs.requirementWaves = { 10: { continuingOpenedAt: '2026-10-01' } };
  prisma.continuing_requirement_schedules = { findUnique: async () => ({ opens_at: new Date(Date.now() - 60000), closes_at: new Date(Date.now() + 60000), late_scope: 'all', late_applicant_ids: [] }) };
  assert.equal((await scholarUpload('grades')).statusCode, 403);
  delete prisma.continuing_requirement_schedules;
});
test('period access ignores retired late selections and enforces global close/reopen', async () => {
  setup({ schoolType: 'public', deadline: new Date(Date.now() - 60000) });
  for (const key of ['tax_exemption', 'indigency', 'valid_id', 'grades', 'registration_form']) await adminUpload(key);
  let uploadsOpen = false;
  prisma.continuing_requirement_schedules = { findUnique: async () => ({ uploads_open: uploadsOpen }) };
  assert.equal((await scholarUpload('grades')).statusCode, 403);
  uploadsOpen = true; assert.equal((await scholarUpload('grades')).statusCode, 200);
  delete prisma.continuing_requirement_schedules;
});
test('Schedule mutation routes reject unauthenticated users, scholars and staff lacking Scholars access', async () => {
  for (const headers of [{}, authHeader(7, 'control'), authHeader(3)]) {
    setup(); const res = await fetch(baseUrl + '/scholars/continuing-schedules/10', { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    assert.equal(res.status, headers.Authorization ? 403 : 401);
  }
});

test('Preparation accepts Payroll permission for Public and rejects the wrong destination permission', async () => {
  for (const type of ['public', 'private']) {
    setup({ schoolType: type });
    prisma.payroll_claims = { findFirst: async () => null };
    let saved = 0;
    prisma.scholar_requirements.upsert = async ({ create }) => { saved += 1; return create; };
    const req = { params: { applicantId: '7' }, body: { academicPeriodId: 10, billingStatus: 'Ready for billing' }, user: { id: 11, role: 'RegularAdmin', sectionAccess: ['billing'] } };
    let res = response(); await updateScholarBillingMetadata(req, res); assert.equal(res.statusCode, 403); assert.equal(saved, 0);
    req.user.sectionAccess = ['payroll'];
    res = response(); await updateScholarBillingMetadata(req, res); assert.equal(res.statusCode, 200); assert.equal(saved, 1);
  }
});

test('authorized Admin initial capture works for a posted passer without creating a Scholar account', async () => {
  setup({ inactive: true, schoolType: 'public' }); application.status = 'Examined';
  const result = { id: 5, passed: true, published_at: '2026-10-16', updated_at: '2026-10-16' };
  prisma.passer_list_members = { findMany: async () => [{ application_id: 1, result_id: 5, snapshot: { resultUpdatedAt: result.updated_at } }] };
  prisma.results = { findFirst: async () => result };
  try {
    let res = await adminUpload('grades'); assert.equal(res.statusCode, 200); assert.equal(getWaveSet(application.initial_docs, 10, 'initial').requirements.grades.status, 'Approved');
    assert.equal(await prisma.scholar_accounts.findFirst(), null);
    result.updated_at = '2026-10-17';
    prisma.passer_list_members.findMany = async () => [{ application_id: 1, result_id: 5, snapshot: { resultUpdatedAt: '2026-10-16' } }];
    const before = writes; res = await adminUpload('valid_id'); assert.equal(res.statusCode, 409); assert.equal(writes, before);
  } finally { delete prisma.passer_list_members; delete prisma.results; }
});
test('Passer List and pre-Scholar intake routes deny anonymous, applicant, Billing-only and wrong-section staff', async () => {
  for (const headers of [{}, authHeader(7,'control'), authHeader(4), authHeader(11)]) {
    setup();
    for (const [method,path] of [['POST','/passer-lists'],['POST','/passer-lists/1/post'],['GET','/passers/7/intake'],['PUT','/passers/7/requirements/grades']]) {
      const res = await fetch(baseUrl+path,{method,headers:{...headers,'Content-Type':'application/json'},...(method==='GET'?{}:{body:'{}'})});
      assert.equal(res.status, headers.Authorization ? 403 : 401);
    }
  }
});

test('priority-proof approval verifies the file without creating or tagging a Scholar', async () => {
  setup({ inactive: true }); application.status='Examined';application.eligibility={pwd:'Yes'};
  application.initial_docs.requirements.priority_pwd={fileName:'TEST-proof.pdf',fileData:file().fileData,status:'Pending'};
  prisma.scholar_accounts.create=async()=>{throw new Error('Proof approval must not create a Scholar');};
  const res=response();await reviewDocument({params:{applicationId:'1',requirementKey:'priority_pwd'},body:{decision:'approved',notes:'Verified test proof'},user:{id:9}},res);
  assert.equal(res.statusCode,200);assert.equal(application.initial_docs.requirements.priority_pwd.status,'Approved');assert.equal(application.status,'Examined');assert.equal(await prisma.scholar_accounts.findFirst(),null);
});

test('grant preparation and receipt routes reject unauthenticated, applicant and wrong-section accounts',async()=>{
 for(const headers of [{},authHeader(7,'control'),authHeader(3)]){
  setup();for(const [method,path] of [['PUT','/scholars/7/grant-preparation'],['GET','/scholars/7/tuition-receipt?academicPeriodId=10']]){
   const res=await fetch(baseUrl+path,{method,headers:{...headers,'Content-Type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify({academicPeriodId:10,tuitionFeeAssistance:3500})})});assert.equal(res.status,headers.Authorization?403:401);
  }
 }
});
test('Payroll preparation mutation rejects unauthenticated, Scholar and staff without Payroll access', async () => {
 for (const headers of [{}, authHeader(7,'control'), authHeader(4), authHeader(3)]) {
  setup(); const res=await fetch(baseUrl+'/scholars/7/payroll-preparation',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({academicPeriodId:10})});
  assert.equal(res.status,headers.Authorization?403:401);assert.equal(writes,0);
 }
});
