const assert = require('node:assert/strict');
const { test, before, after, beforeEach } = require('node:test');
const { randomBytes } = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');

// In-memory facades only. No database, environment file or email service is used.
const prisma = {};
const prismaPath = require.resolve('../config/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
const mailerPath = require.resolve('../services/mailer');
require.cache[mailerPath] = { id: mailerPath, filename: mailerPath, loaded: true, exports: { sendExamSubmittedEmail: async () => ({ sent: false }) } };
process.env.JWT_SECRET = randomBytes(32).toString('hex');
const { defaultConfiguration, createExamTicket } = require('../services/onlineExamConfiguration');
const { getOnlineExamQuestions, submitOnlineExam, updateExaminationAttendance, getApplicantManagement, getMyApplication } = require('../controllers/applicationController');
const { createOnlineExamConfigurationController } = require('../controllers/onlineExamConfigurationController');
const routes = require('../routes/applicationRoutes');
const response = () => ({ locals: {}, statusCode: 200, headers: {}, set(key, value) { this.headers[key] = value; return this; }, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } });
let writes;
let slot;
let result;
let scholar;
let records;
let exam;
let settings;
let server;
let baseUrl;

beforeEach(() => {
  writes = [];
  records = [];
  result = null;
  scholar = null;
  slot = { id: 9, applicant_id: 7, exam_id: 3, appeared: false };
  exam = { id: 3, title: 'Test examination', municipality: 'Daet', academic_year: '2026-2027', is_active: true, exam_date: new Date(), exam_end_date: new Date() };
  settings = { examination_enabled: true, exam_delivery_mode: 'online' };
  const applicant = { id: 7, first_name: 'TEST', last_name: 'APPLICANT', municipality: 'Daet', email: 'applicant@example.com', status: 'pending', school_year: '2026-2027' };
  const application = { id: 1, applicant_id: 7, status: 'Applied', school_plan: {}, initial_docs: {} };
  Object.assign(prisma, {
    academic_periods: { findFirst: async () => ({ id: 1, school_year: '2026-2027', is_active: true }) },
    application_settings: { findUnique: async () => settings },
    applicants: { findUnique: async () => applicant, findMany: async () => [applicant] },
    exams: { findFirst: async () => exam, findMany: async () => [exam], findUnique: async () => exam },
    exam_slots: { findUnique: async () => slot, findMany: async () => [slot], update: async ({ data }) => { writes.push({ table: 'exam_slots', data }); slot = { ...slot, ...data }; return slot; } },
    results: { findFirst: async () => result, findMany: async () => result ? [result] : [], create: async ({ data }) => { writes.push({ table: 'results', data }); result = { id: 2, ...data }; return result; } },
    application_submissions: { findFirst: async () => application, findMany: async () => [application], updateMany: async ({ data }) => { writes.push({ table: 'application_submissions', data }); return { count: 1 }; } },
    scholar_accounts: { findFirst: async () => scholar, findMany: async () => scholar ? [scholar] : [] },
    scholar_requirements: { findFirst: async () => null, findMany: async () => [] },
    eligibility_assessments: { findFirst: async () => null },
    payroll_batches: { findMany: async () => [] },
    payroll_claims: { findFirst: async () => null },
    schools: { findMany: async () => [] },
    control_accounts: { findFirst: async () => ({ applicant_id: 7, is_active: true, auth_version: 0 }), findMany: async () => [] },
    activity_logs: { create: async () => ({ id: 1 }) },
    admins: { findUnique: async ({ where }) => ({ id: where.id, is_active: true, auth_version: 0, is_super_admin: where.id === 1, role: where.id === 4 ? 'billing' : 'admin', section_access: where.id === 3 ? ['examination'] : ['settings'] }) },
    online_exam_configurations: {
      findFirst: async () => records.at(-1) || null,
      findUnique: async ({ where }) => records.find(({ id }) => id === where.id) || null,
      create: async ({ data }) => {
        if (records.some(({ previous_id }) => previous_id === data.previous_id)) throw Object.assign(new Error('Conflict'), { code: 'P2002' });
        const record = { id: records.length + 1, ...data };
        records.push(record);
        return record;
      },
    },
  });
});

before(async () => {
  const app = express();
  app.use(express.json());
  app.use(routes);
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise((resolve) => server.close(resolve)); });

test('actual attendance mutation writes only attendance, then both dashboards derive For review', async () => {
  for (const deliveryMode of ['paper', 'online']) {
    settings.exam_delivery_mode = deliveryMode;
    const res = response();
    await updateExaminationAttendance({ params: { examId: '3', applicantId: '7' }, body: { status: 'present' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.attendance.status, 'Present');
    const management = response();
    await getApplicantManagement({}, management);
    assert.equal(management.statusCode, 200);
    assert.equal(management.body.applicants[0].status, 'For review');
    assert.equal(management.body.applicants[0].resultStatus, 'For review');
    const portal = response();
    await getMyApplication({ user: { id: 7, email: 'applicant@example.com' } }, portal);
    assert.equal(portal.statusCode, 200);
    assert.equal(portal.body.examination.status, 'For review');
    assert.equal(portal.body.examination.completed, false);
    assert.equal(portal.body.examination.access.allowed, deliveryMode === 'online');
  }
  assert.ok(writes.every(({ table }) => table === 'exam_slots'));
});

test('saved results and priority acceptance are not replaced by attendance review', async () => {
  slot.appeared = true;
  for (const passed of [true, false]) {
    result = { id: 2, applicant_id: 7, exam_id: 3, passed, score: passed ? 15 : 5 };
    const res = response();
    await getApplicantManagement({}, res);
    assert.equal(res.body.applicants[0].resultStatus, passed ? 'Passed' : 'Failed');
    const portal = response();
    await getMyApplication({ user: { id: 7 } }, portal);
    assert.equal(portal.body.examination.status, 'Waiting for results');
    assert.equal(portal.body.examination.resultStatus, 'Waiting for results');
  }
  result = null;
  scholar = { applicant_id: 7, is_active: true, notes: 'verified proof' };
  const res = response();
  await getApplicantManagement({}, res);
  assert.equal(res.body.applicants[0].status, 'Accepted as scholar');
});

test('question access still requires Present, active dates and online mode', async () => {
  const req = { user: { id: 7 } };
  for (const mode of ['pending', 'paper', 'inactive', 'outside']) {
    slot.appeared = mode !== 'pending';
    settings.exam_delivery_mode = mode === 'paper' ? 'paper' : 'online';
    exam.is_active = mode !== 'inactive';
    exam.exam_date = mode === 'outside' ? new Date('2099-01-01') : new Date();
    const res = response();
    await getOnlineExamQuestions(req, res);
    assert.equal(res.statusCode, 403, mode);
    assert.equal(res.body.questions, undefined);
  }
});

test('an opened exam is scored with its original key after settings staff save a new version', async () => {
  slot.appeared = true;
  const opened = response();
  await getOnlineExamQuestions({ user: { id: 7 } }, opened);
  assert.equal(opened.statusCode, 200);
  assert.equal(opened.headers['Cache-Control'], 'no-store, private');
  assert.ok(opened.body.questions.every((question) => !Object.hasOwn(question, 'answer')));
  const config = defaultConfiguration();
  config.questions[0].answer = 0;
  const saved = response();
  await createOnlineExamConfigurationController(prisma).save({ user: { id: 1 }, body: { ...config, baseVersion: 0 } }, saved);
  assert.equal(saved.statusCode, 201);
  const submitted = response();
  await submitOnlineExam({ user: { id: 7 }, body: { examTicket: opened.body.examTicket, answers: { multipleChoice: { 1: 1 } }, score: 20 } }, submitted);
  assert.equal(submitted.statusCode, 201);
  assert.equal(submitted.body.result.score, 1);
  assert.equal(submitted.body.result.online_configuration_id, 0);
  assert.equal(submitted.body.result.passed, false);
});

test('invalid tickets are rejected before writing any examination result', async () => {
  slot.appeared = true;
  for (const examTicket of [undefined, 'invalid', createExamTicket({ applicantId: 8, examId: 3, configurationId: 0 })]) {
    const res = response();
    await submitOnlineExam({ user: { id: 7 }, body: { examTicket, answers: {} } }, res);
    assert.equal(res.statusCode, 400);
  }
  assert.equal(writes.length, 0);
});

test('newly opened examinations use saved title, answer key and passing threshold', async () => {
  slot.appeared = true;
  const config = defaultConfiguration();
  config.title = 'Configured examination';
  config.passingScore = 1;
  config.questions[0].answer = 0;
  const saved = response();
  await createOnlineExamConfigurationController(prisma).save({ user: { id: 1 }, body: { ...config, baseVersion: 0 } }, saved);
  const opened = response();
  await getOnlineExamQuestions({ user: { id: 7 } }, opened);
  assert.equal(opened.body.title, 'Configured examination');
  const submitted = response();
  await submitOnlineExam({ user: { id: 7 }, body: { examTicket: opened.body.examTicket, answers: { multipleChoice: { 1: 0 } } } }, submitted);
  assert.equal(submitted.statusCode, 201);
  assert.equal(submitted.body.result.score, 1);
  assert.equal(submitted.body.result.passing_score, 1);
  assert.equal(submitted.body.result.passed, true);
  assert.equal(submitted.body.result.online_configuration_id, 1);
});

test('simultaneous saves from one base version create only one successor', async () => {
  const controller = createOnlineExamConfigurationController(prisma);
  const req = { user: { id: 1 }, body: { ...defaultConfiguration(), baseVersion: 0 } };
  const first = response();
  const second = response();
  await Promise.all([controller.save(req, first), controller.save(req, second)]);
  assert.deepEqual([first.statusCode, second.statusCode].sort(), [201, 409]);
  assert.equal(records.length, 1);
});

test('configuration saves reject stale versions instead of overwriting another editor', async () => {
  const controller = createOnlineExamConfigurationController(prisma);
  const req = { user: { id: 1 }, body: { ...defaultConfiguration(), baseVersion: 0 } };
  const first = response();
  await controller.save(req, first);
  assert.equal(first.statusCode, 201);
  const stale = response();
  await controller.save(req, stale);
  assert.equal(stale.statusCode, 409);
  assert.equal(records.length, 1);
});

test('real configuration routes deny anonymous, applicant, billing and staff without Settings access', async () => {
  for (const method of ['GET', 'PUT']) {
    for (const [id, accountType, expected] of [[null, null, 401], [7, 'applicant', 403], [4, 'admin', 403], [3, 'admin', 403], [2, 'admin', method === 'GET' ? 200 : 201], [1, 'admin', method === 'GET' ? 200 : 201]]) {
      const token = id ? jwt.sign({ userId: id, accountType, authVersion: 0 }, process.env.JWT_SECRET) : null;
      const res = await fetch(`${baseUrl}/online-examination/configuration`, {
        method,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
        ...(method === 'PUT' ? { body: JSON.stringify({ ...defaultConfiguration(), baseVersion: records.at(-1)?.id || 0 }) } : {}),
      });
      assert.equal(res.status, expected, `${method} ${id}`);
      if (expected < 300) assert.match(res.headers.get('cache-control'), /no-store/);
    }
  }
});
