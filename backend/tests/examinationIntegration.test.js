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
require.cache[mailerPath] = { id: mailerPath, filename: mailerPath, loaded: true, exports: { sendScholarApprovedEmail: async () => ({ sent: false }), sendExamSubmittedEmail: async () => { emailReceipts.push({ result, status: application.status }); return { sent: false }; } } };
process.env.JWT_SECRET = randomBytes(32).toString('hex');
const { defaultConfiguration, createExamTicket } = require('../services/onlineExamConfiguration');
const { objectiveConfiguration } = require('./fixtures/objectiveExam');
const { getOnlineExamQuestions, submitOnlineExam, updateExaminationAttendance, getScholarManagement, getApplicantManagement, getMyApplication, acceptApplicantAsScholar } = require('../controllers/applicationController');
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
let application;
let emailReceipts;
let transactionEvents;

beforeEach(() => {
  writes = [];
  emailReceipts = [];
  transactionEvents = [];
  records = [];
  result = null;
  scholar = null;
  slot = { id: 9, applicant_id: 7, exam_id: 3, appeared: false };
  exam = { id: 3, title: 'Test examination', municipality: 'Daet', academic_year: '2026-2027', is_active: true, exam_date: new Date(), exam_end_date: new Date() };
  settings = { examination_enabled: true, exam_delivery_mode: 'online' };
  const applicant = { id: 7, first_name: 'TEST', last_name: 'APPLICANT', municipality: 'Daet', email: 'applicant@example.com', status: 'pending', school_year: '2026-2027' };
  application = { id: 1, applicant_id: 7, status: 'Applied', school_plan: {}, initial_docs: {} };
  Object.assign(prisma, {
    academic_periods: { findFirst: async () => ({ id: 1, school_year: '2026-2027', is_active: true }) },
    application_settings: { findUnique: async () => settings },
    applicants: { findFirst: async () => applicant, findUnique: async () => applicant, findMany: async () => [applicant] },
    exams: { findFirst: async () => exam, findMany: async () => [exam], findUnique: async () => exam },
    exam_slots: { findUnique: async () => slot, findMany: async () => [slot], updateMany: async ({ where, data }) => { if (where.online_started_at === null && slot.online_started_at) return { count: 0 }; writes.push({ table: 'exam_slots', data }); slot = { ...slot, ...data }; return { count: 1 }; }, update: async ({ data }) => { writes.push({ table: 'exam_slots', data }); slot = { ...slot, ...data }; return slot; } },
    results: { findFirst: async ({ where = {} } = {}) => result && (!where.id || where.id === result.id) && (!where.exam_id || where.exam_id === result.exam_id) ? result : null, findMany: async () => result ? [result] : [], create: async ({ data }) => { if (result?.exam_slot_id === data.exam_slot_id) throw Object.assign(new Error('Duplicate examination result'), { code: 'P2002' }); writes.push({ table: 'results', data }); result = { id: 2, created_at: new Date(), ...data }; return result; } },
    application_submissions: { findFirst: async () => application, findMany: async () => [application], updateMany: async ({ where, data }) => { if (!application || (where.status?.not && application.status === where.status.not)) return { count: 0 }; writes.push({ table: 'application_submissions', data }); Object.assign(application, data); return { count: 1 }; } },
    scholar_accounts: { findFirst: async () => scholar, findMany: async () => scholar ? [scholar] : [], create: async ({ data }) => { writes.push({ table: 'scholar_accounts', data }); scholar = { id: 1, ...data }; return scholar; }, update: async ({ data }) => { writes.push({ table: 'scholar_accounts', data }); scholar = { ...scholar, ...data }; return scholar; } },
    scholar_requirements: { findFirst: async () => null, findMany: async () => [], upsert: async ({ create }) => { writes.push({ table: 'scholar_requirements', data: create }); return { id: 1, ...create }; } },
    eligibility_assessments: { findFirst: async () => null, create: async ({ data }) => { writes.push({ table: 'eligibility_assessments', data }); return { id: 1, ...data }; } },
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
  // Serialize synthetic transactions and restore their state on rollback. This
  // exercises controller use of the transaction client, not PostgreSQL itself.
  let pending = Promise.resolve();
  prisma.$transaction = (callback, options) => {
    const operation = pending.then(async () => {
      if (options) assert.equal(options.isolationLevel, 'Serializable');
      const previousScholar = scholar;
      const previousResult = result;
      const previousApplication = application && { ...application };
      const previousWrites = writes.length;
      transactionEvents.push('begin');
      const tx = { ...prisma, results: { ...prisma.results }, application_submissions: { ...prisma.application_submissions } };
      try {
        const value = await callback(tx);
        transactionEvents.push('commit');
        return value;
      } catch (error) {
        scholar = previousScholar;
        result = previousResult;
        application = previousApplication;
        writes.length = previousWrites;
        transactionEvents.push('rollback');
        throw error;
      }
    });
    pending = operation.catch(() => {});
    return operation;
  };
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
    assert.equal(portal.body.examination.attendance.status, 'Present');
    assert.deepEqual(portal.body.examination.attendance.appearedAt, res.body.attendance.appearedAt);
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
  const original = objectiveConfiguration();
  records.push({ id: 1, title: original.title, instructions: original.instructions, passing_score: original.passingScore, questions: original.questions });
  slot.appeared = true;
  const opened = response();
  await getOnlineExamQuestions({ user: { id: 7 } }, opened);
  assert.equal(opened.statusCode, 200);
  assert.equal(opened.headers['Cache-Control'], 'no-store, private');
  assert.equal(opened.body.attempt.applicantId, 7);
  assert.equal(opened.body.attempt.id, slot.id);
  assert.equal(opened.body.attempt.configurationId, slot.online_configuration_id);
  assert.ok(opened.body.questions.every((question) => !Object.hasOwn(question, 'answer')));
  const config = objectiveConfiguration();
  config.questions[0].answer = 0;
  const saved = response();
  await createOnlineExamConfigurationController(prisma).save({ user: { id: 1 }, body: { ...config, baseVersion: 1 } }, saved);
  assert.equal(saved.statusCode, 201);
  const submitted = response();
  await submitOnlineExam({ user: { id: 7 }, body: { examTicket: opened.body.examTicket, answers: { multipleChoice: { 1: 1 } }, score: 20 } }, submitted);
  assert.equal(submitted.statusCode, 201);
  assert.equal(submitted.body.result, undefined);
  assert.equal(submitted.body.receipt.recorded, true);
  assert.equal(result.score, 1);
  assert.equal(result.online_configuration_id, 1);
  assert.equal(result.passed, false);
});

test('invalid tickets are rejected before writing any examination result', async () => {
  slot.appeared = true;
  slot.online_started_at = new Date();
  slot.online_deadline_at = new Date(Date.now() + 2700000);
  slot.online_configuration_id = 0;
  for (const examTicket of [undefined, 'invalid', createExamTicket({ applicantId: 8, examId: 3, configurationId: 0 })]) {
    const res = response();
    await submitOnlineExam({ user: { id: 7 }, body: { examTicket, answers: {} } }, res);
    assert.equal(res.statusCode, 400);
  }
  assert.equal(writes.length, 0);
});

test('newly opened examinations use saved title, answer key and passing threshold', async () => {
  slot.appeared = true;
  const config = objectiveConfiguration();
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
  assert.equal(submitted.body.result, undefined);
  assert.equal(submitted.body.receipt.recorded, true);
  assert.equal(result.score, 1);
  assert.equal(result.passing_score, 1);
  assert.equal(result.passed, true);
  assert.equal(result.online_configuration_id, 1);
});

test('simultaneous saves from one base version create only one successor', async () => {
  const controller = createOnlineExamConfigurationController(prisma);
  const req = { user: { id: 1 }, body: { ...objectiveConfiguration(), baseVersion: 0 } };
  const first = response();
  const second = response();
  await Promise.all([controller.save(req, first), controller.save(req, second)]);
  assert.deepEqual([first.statusCode, second.statusCode].sort(), [201, 409]);
  assert.equal(records.length, 1);
});

test('configuration saves reject stale versions instead of overwriting another editor', async () => {
  const controller = createOnlineExamConfigurationController(prisma);
  const req = { user: { id: 1 }, body: { ...objectiveConfiguration(), baseVersion: 0 } };
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
        ...(method === 'PUT' ? { body: JSON.stringify({ ...objectiveConfiguration(), baseVersion: records.at(-1)?.id || 0 }) } : {}),
      });
      assert.equal(res.status, expected, `${method} ${id}`);
      if (expected < 300) assert.match(res.headers.get('cache-control'), /no-store/);
    }
  }
});


test('score and publication routes require an examination-authorized staff account', async () => {
  for (const [method, suffix] of [['POST', ''], ['PUT', ''], ['POST', '/publish']]) {
    const url = `${baseUrl}/examinations/3/results/7${suffix}`;
    for (const [user, expected] of [[null, 401], [{ userId: 7, role: 'Applicant', accountType: 'applicant', authVersion: 0 }, 403], [{ userId: 2, role: 'RegularAdmin', accountType: 'admin', authVersion: 0 }, 403], [{ userId: 4, role: 'BillingPayrollAdmin', accountType: 'admin', authVersion: 0 }, 403], [{ userId: 3, role: 'RegularAdmin', accountType: 'admin', authVersion: 0 }, 400], [{ userId: 1, role: 'SuperAdmin', accountType: 'admin', authVersion: 0 }, 400]]) {
      const token = user ? jwt.sign(user, process.env.JWT_SECRET) : '';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: '{}' });
      assert.equal(res.status, expected);
    }
  }
});


test('examination-only staff can load results without Applicants section access', async () => {
  const token = jwt.sign({ userId: 3, role: 'RegularAdmin', accountType: 'admin', authVersion: 0 }, process.env.JWT_SECRET);
  const headers = { Authorization: `Bearer ${token}` };
  const resultResponse = await fetch(`${baseUrl}/results/management`, { headers });
  assert.equal(resultResponse.status, 200);
  assert.match(resultResponse.headers.get('cache-control'), /no-store/);
  assert.equal((await fetch(`${baseUrl}/applicants/management`, { headers })).status, 403);
});

test('paper score stays hidden before publication and does not enable early scholarship acceptance', async () => {
  result = { id: 2, applicant_id: 7, exam_id: 3, exam_slot_id: 9, updated_at: new Date(), delivery_mode: 'paper', score: 14, passing_score: 14, passed: true, published_at: null };
  let portal = response();
  await getMyApplication({ user: { id: 7 } }, portal);
  assert.equal(portal.body.examination.status, 'Result under review');
  assert.equal(portal.body.examination.score, null);
  assert.equal(portal.body.examination.passingScore, null);
  const accepted = response();
  await acceptApplicantAsScholar({ params: { applicantId: '7' }, body: reviewedDecision(), user: { id: 1 } }, accepted);
  assert.equal(accepted.statusCode, 409);
  result.published_at = new Date();
  portal = response();
  await getMyApplication({ user: { id: 7 } }, portal);
  assert.equal(portal.body.examination.status, 'Passed');
  assert.equal(portal.body.examination.score, 14);
  assert.equal(portal.body.examination.isScholar, false);
});


test('unsafe legacy banks cannot start or submit an examination or write results', async () => {
  slot.appeared = true;
  const legacy = defaultConfiguration();
  for (const id of [0, 1]) {
    records = id ? [{ id, title: legacy.title, instructions: legacy.instructions, passing_score: legacy.passingScore, questions: legacy.questions }] : [];
    const opened = response();
    await getOnlineExamQuestions({ user: { id: 7 } }, opened);
    assert.equal(opened.statusCode, 409);
    assert.equal(opened.body.examTicket, undefined);
    const submitted = response();
    await submitOnlineExam({ user: { id: 7 }, body: { examTicket: createExamTicket({ applicantId: 7, examId: 3, configurationId: id }), answers: { identification: { 9: 'anything' }, essay: 'x' } } }, submitted);
    assert.equal(submitted.statusCode, 409);
    assert.equal(result, null);
    assert.equal(writes.length, 0);
  }
});


test('reopening a timed attempt retains its deadline and original bank after staff saves', async () => {
  slot.appeared = true;
  const original = objectiveConfiguration();
  records.push({ id: 1, title: original.title, instructions: '', passing_score: 14, questions: original.questions });
  const first = response();
  await getOnlineExamQuestions({ user: { id: 7 } }, first);
  assert.equal(first.statusCode, 200);
  const deadline = slot.online_deadline_at.getTime();
  assert.equal(deadline - slot.online_started_at.getTime(), 45 * 60 * 1000);
  records.push({ id: 2, title: 'New bank', instructions: '', passing_score: 14, questions: original.questions });
  const second = response();
  await getOnlineExamQuestions({ user: { id: 7 } }, second);
  assert.equal(second.statusCode, 200);
  assert.equal(second.body.title, original.title);
  assert.equal(slot.online_deadline_at.getTime(), deadline);
  assert.equal(second.body.attempt.deadlineAt.getTime(), deadline);
  assert.equal(writes.filter(({ table }) => table === 'exam_slots').length, 1);
});

test('expired attempts cannot reopen, refresh their deadline or write late results', async () => {
  slot.appeared = true;
  slot.online_started_at = new Date(Date.now() - 2700000);
  slot.online_deadline_at = new Date(Date.now() - 1);
  slot.online_configuration_id = 1;
  const deadline = slot.online_deadline_at.getTime();
  const opened = response();
  await getOnlineExamQuestions({ user: { id: 7 } }, opened);
  assert.equal(opened.statusCode, 410);
  assert.equal(opened.body.examTicket, undefined);
  const submitted = response();
  await submitOnlineExam({ user: { id: 7 }, body: { examTicket: createExamTicket({ applicantId: 7, examId: 3, configurationId: 1 }), answers: {} } }, submitted);
  assert.equal(submitted.statusCode, 410);
  assert.equal(slot.online_deadline_at.getTime(), deadline);
  assert.equal(result, null);
  assert.equal(writes.length, 0);
});

test('legacy untimed and mismatched-version tickets cannot bypass persisted attempt checks', async () => {
  slot.appeared = true;
  const ticket = createExamTicket({ applicantId: 7, examId: 3, configurationId: 2 });
  const untimed = response();
  await submitOnlineExam({ user: { id: 7 }, body: { examTicket: ticket, answers: {} } }, untimed);
  assert.equal(untimed.statusCode, 409);
  slot.online_started_at = new Date();
  slot.online_deadline_at = new Date(Date.now() + 2700000);
  slot.online_configuration_id = 1;
  const mismatch = response();
  await submitOnlineExam({ user: { id: 7 }, body: { examTicket: ticket, answers: {} } }, mismatch);
  assert.equal(mismatch.statusCode, 409);
  assert.equal(result, null);
  assert.equal(writes.length, 0);
});


const openAtomicTestAttempt = async () => {
  const config = objectiveConfiguration();
  records.push({ id: 1, title: config.title, instructions: config.instructions, passing_score: config.passingScore, questions: config.questions });
  slot.appeared = true;
  const opened = response();
  await getOnlineExamQuestions({ user: { id: 7 } }, opened);
  assert.equal(opened.statusCode, 200);
  writes = [];
  return { user: { id: 7 }, body: { examTicket: opened.body.examTicket, answers: { multipleChoice: { 1: 1 } } } };
};

test('online result and Examined status commit together before receipt delivery', async () => {
  const req = await openAtomicTestAttempt();
  const res = response();
  await submitOnlineExam(req, res);
  assert.equal(res.statusCode, 201);
  assert.deepEqual(transactionEvents, ['begin', 'commit']);
  assert.equal(application.status, 'Examined');
  assert.equal(result.exam_slot_id, slot.id);
  assert.deepEqual(writes.map(({ table }) => table), ['results', 'application_submissions']);
  assert.equal(emailReceipts.length, 1);
  assert.equal(emailReceipts[0].status, 'Examined');
  assert.equal(emailReceipts[0].result.id, result.id);
  assert.equal(res.body.result, undefined);
  assert.equal(res.body.receipt.recorded, true);
});

test('a failed application-status write rolls back the score and permits a safe retry', async (t) => {
  const req = await openAtomicTestAttempt();
  const update = prisma.application_submissions.updateMany;
  prisma.application_submissions.updateMany = async () => { throw new Error('Synthetic status-write failure'); };
  t.mock.method(console, 'error', () => {});
  const failed = response();
  await submitOnlineExam(req, failed);
  assert.equal(failed.statusCode, 500);
  assert.equal(result, null);
  assert.equal(application.status, 'Applied');
  assert.equal(writes.length, 0);
  assert.equal(emailReceipts.length, 0);
  assert.deepEqual(transactionEvents, ['begin', 'rollback']);
  prisma.application_submissions.updateMany = update;
  const retried = response();
  await submitOnlineExam(req, retried);
  assert.equal(retried.statusCode, 201);
  assert.equal(application.status, 'Examined');
  assert.equal(emailReceipts.length, 1);
});

test('withdrawn or missing applications cannot leave a committed online result', async () => {
  const req = await openAtomicTestAttempt();
  for (const state of [{ id: 1, applicant_id: 7, status: 'Withdrawn' }, null]) {
    application = state;
    const res = response();
    await submitOnlineExam(req, res);
    assert.equal(res.statusCode, 409);
    assert.match(res.body.message, /Contact CAO/);
    assert.equal(result, null);
    assert.deepEqual(application, state);
    assert.equal(writes.length, 0);
    assert.equal(emailReceipts.length, 0);
  }
  assert.deepEqual(transactionEvents, ['begin', 'rollback', 'begin', 'rollback']);
});

test('simultaneous submissions commit one score/status pair and send one receipt', async () => {
  const req = await openAtomicTestAttempt();
  const responses = [response(), response()];
  await Promise.all(responses.map((res) => submitOnlineExam(req, res)));
  assert.deepEqual(responses.map(({ statusCode }) => statusCode).sort(), [201, 409]);
  assert.deepEqual(transactionEvents, ['begin', 'commit', 'begin', 'rollback']);
  assert.equal(result.exam_slot_id, slot.id);
  assert.equal(application.status, 'Examined');
  assert.equal(writes.filter(({ table }) => table === 'results').length, 1);
  assert.equal(writes.filter(({ table }) => table === 'application_submissions').length, 1);
  assert.equal(emailReceipts.length, 1);
  const repeated = response();
  await submitOnlineExam(req, repeated);
  assert.equal(repeated.statusCode, 409);
  assert.equal(emailReceipts.length, 1);
});

test('retired payout endpoints preserve access checks and never write records or success logs', async () => {
  let auditWrites = 0;
  prisma.activity_logs.create = async () => { auditWrites += 1; return { id: 1 }; };
  prisma.admins.findUnique = async ({ where }) => ({ id: where.id, is_active: true, auth_version: 0, is_super_admin: where.id === 1, role: 'billing', section_access: where.id === 4 ? ['billing', 'payroll', 'scholars'] : [] });
  const allowed = jwt.sign({ userId: 4, role: 'BillingPayrollAdmin', accountType: 'admin', authVersion: 0 }, process.env.JWT_SECRET);
  const deniedSection = jwt.sign({ userId: 2, role: 'BillingPayrollAdmin', accountType: 'admin', authVersion: 0 }, process.env.JWT_SECRET);
  const applicantToken = jwt.sign({ userId: 7, role: 'Applicant', accountType: 'applicant', authVersion: 0 }, process.env.JWT_SECRET);
  for (const [method, path] of [
    ['PUT', '/applications/7/payout-compliant'], ['PUT', '/applications/7/paid'],
    ['POST', '/payroll/billing-batch'], ['PUT', '/payroll/billing-batch/3/release'],
    ['GET', '/scholars/eligible'], ['GET', '/scholars?status=Paid'],
  ]) {
    for (const [token, status] of [[null, 401], [applicantToken, 403], [deniedSection, 403], [allowed, 410]]) {
      const res = await fetch(`${baseUrl}${path}`, {
        method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(method === 'GET' ? {} : { body: '{"totalAmount":"invalid"}' }),
      });
      assert.equal(res.status, status, `${method} ${path}`);
      if (status === 410) {
        const body = await res.json();
        assert.equal(body.code, 'LEGACY_PAYOUT_WORKFLOW_RETIRED');
        assert.match(body.message, /ends at payroll-list generation/);
      }
    }
  }
  assert.equal(writes.length, 0);
  assert.equal(auditWrites, 0);
});

test('applicant portal returns list membership without legacy payment fields', async () => {
  const claim = { applicant_id: 7, payroll_batch_id: 12, claim_amount: 3000, claim_status: 'paid', claimed_date: new Date(), claimed_notes: 'SYNTHETIC-PAYMENT-REFERENCE', created_at: new Date('2026-10-01T00:00:00Z') };
  const batch = { id: 12, batch_number: 'PAYROLL-TEST', status: 'released', released_at: new Date(), prepared_at: claim.created_at };
  prisma.payroll_claims.findFirst = async () => claim;
  prisma.payroll_batches.findMany = async () => [batch];
  prisma.payroll_batches.findUnique = async () => batch;
  const res = response();
  await getMyApplication({ user: { id: 7 } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.payrollList.reference, 'PAYROLL-TEST');
  assert.equal(res.body.payrollList.status, 'Included in payroll list');
  assert.equal(res.body.allowance, undefined);
  assert.doesNotMatch(JSON.stringify(res.body), /claimedDate|releasedAt|SYNTHETIC-PAYMENT-REFERENCE/);
  assert.equal(claim.claim_status, 'paid');
});

test('scholar list history retains inclusion without payment confirmations', async () => {
  const prepared = new Date('2026-10-01T00:00:00Z');
  prisma.academic_periods.findMany = async () => [{ id: 1, school_year: '2026-2027', semester: 'First Semester', is_active: true }];
  prisma.scholar_accounts.findMany = async () => [{ id: 4, applicant_id: 7, is_active: true }];
  const claim = { applicant_id: 7, payroll_batch_id: 12, academic_period_id: 1, claim_amount: 3000, claim_status: 'paid', claimed_date: new Date(), claimed_notes: 'SYNTHETIC-PAYMENT-REFERENCE', created_at: prepared };
  prisma.payroll_claims = { findMany: async () => [claim] };
  prisma.payroll_batches.findMany = async () => [{ id: 12, billing_period_id: 1, batch_number: 'PAYROLL-TEST', status: 'released', prepared_at: prepared }];
  const res = response();
  await getScholarManagement({ query: {} }, res);
  assert.equal(res.statusCode, 200);
  const record = res.body.scholars[0];
  assert.equal(record.inPayroll, true);
  assert.equal(record.payReference, 'PAYROLL-TEST');
  assert.equal(record.dateProcessed, prepared);
  assert.equal(record.paid, undefined);
  assert.equal(record.claimStatus, undefined);
  assert.equal(record.batchStatus, undefined);
  assert.equal(record.financialHistory[0].payReference, 'PAYROLL-TEST');
  assert.doesNotMatch(JSON.stringify(record), /SYNTHETIC-PAYMENT-REFERENCE|"paid"|"released"/);
  assert.equal(claim.claim_status, 'paid');
});

test('lifecycle reporting ends with separate certification/payroll lists and retains operational activity', async () => {
  const period = { id: 1, school_year: '2026-2027', semester: 'First Semester', is_active: true };
  prisma.academic_periods.findMany = async () => [period];
  const batches = [{ id: 10, batch_number: 'BILL-TEST', status: 'billed' }, { id: 11, batch_number: 'PAYROLL-TEST', status: 'generated' }, { id: 12, batch_number: 'PAYROLL-LEGACY', status: 'released' }];
  const claims = [{ applicant_id: 7, payroll_batch_id: 10 }, { applicant_id: 8, payroll_batch_id: 11 }, { applicant_id: 9, payroll_batch_id: 12, claim_status: 'paid', claim_amount: 3000, claimed_date: new Date() }];
  prisma.payroll_batches.findMany = async () => batches;
  prisma.payroll_claims = { findMany: async ({ select }) => { assert.deepEqual(select, { applicant_id: true, payroll_batch_id: true }); return claims; } };
  prisma.activity_logs.groupBy = async () => [{ action: 'PAYROLL_LIST_GENERATED', _count: { action: 2 } }];
  prisma.activity_logs.findMany = async () => [{ id: 5, action: 'PAYROLL_LIST_GENERATED', description: 'Generated list' }];
  const { getLifecycleReport } = require('../controllers/lifecycleReportController');
  const res = response();
  await getLifecycleReport({ query: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.funnel.certificationListed, 1);
  assert.equal(res.body.funnel.payrollListed, 2);
  assert.equal(res.body.funnel.paid, undefined);
  assert.equal(res.body.finance, undefined);
  assert.deepEqual(res.body.lists, { certificationLists: 1, payrollLists: 2, certificationEntries: 1, payrollEntries: 2 });
  assert.equal(res.body.audit.actionCounts[0].action, 'PAYROLL_LIST_GENERATED');
  assert.equal(res.body.audit.recent[0].id, '5');
});

const reviewedDecision = () => ({ applicationId: 1, academicPeriodId: 1, examId: 3, resultId: result?.id || 2, updatedAt: result?.updated_at?.toISOString() || new Date().toISOString(), reviewReason: 'Synthetic eligibility review' });
const publishedResult = () => ({ id: 2, applicant_id: 7, exam_id: 3, exam_slot_id: 9, score: 20, passing_score: 14, passed: true, published_at: new Date(), updated_at: new Date(), created_at: new Date() });
const acceptReviewed = async (body = reviewedDecision()) => { const res = response(); await acceptApplicantAsScholar({ params: { applicantId: '7' }, body, user: { id: 1 } }, res); return res; };

test('withdrawn, rejected, declined, missing and unknown-state applications cannot retrieve questions or start time', async () => {
  slot.appeared = true;
  for (const status of ['Withdrawn', 'Rejected', 'Declined', 'Unknown', null]) {
    application = status ? { id: 1, applicant_id: 7, status } : null;
    const res = response(); await getOnlineExamQuestions({ user: { id: 7 } }, res);
    assert.equal(res.statusCode, 403); assert.equal(slot.online_started_at, undefined); assert.equal(writes.length, 0);
  }
});

test('online submission preserves terminal and unknown application decisions and rolls back all writes', async () => {
  const req = await openAtomicTestAttempt();
  const initialWrites = writes.length;
  for (const status of ['Rejected', 'Declined', 'Withdrawn', 'Unknown']) {
    application.status = status;
    const res = response(); await submitOnlineExam(req, res);
    assert.equal(res.statusCode, 409); assert.equal(application.status, status); assert.equal(result, null);
    assert.equal(writes.length, initialWrites); assert.equal(emailReceipts.length, 0);
  }
});

test('a zero-row exact application update rolls back a submitted result instead of confirming success', async () => {
  const req = await openAtomicTestAttempt(); const initialWrites = writes.length;
  prisma.application_submissions.updateMany = async ({ where }) => { assert.equal(where.id, 1); assert.equal(where.status, 'Applied'); return { count: 0 }; };
  const res = response(); await submitOnlineExam(req, res);
  assert.equal(res.statusCode, 409); assert.equal(result, null); assert.equal(writes.length, initialWrites); assert.equal(emailReceipts.length, 0);
});

test('acceptance commits the exact published review with its eligibility snapshot and requirements atomically', async () => {
  result = publishedResult();
  const res = await acceptReviewed(); assert.equal(res.statusCode, 201); assert.equal(scholar.result_id, result.id);
  assert.deepEqual(transactionEvents, ['begin', 'commit']);
  assert.deepEqual(writes.map(w => w.table), ['scholar_accounts', 'eligibility_assessments', 'scholar_requirements']);
  const snapshot = writes.find(w => w.table === 'eligibility_assessments').data;
  assert.equal(snapshot.application_id, 1); assert.equal(snapshot.result_id, 2); assert.equal(snapshot.academic_period_id, 1);
  const repeated = await acceptReviewed(); assert.equal(repeated.statusCode, 200); assert.equal(writes.length, 3);
});

test('acceptance rejects underspecified, mismatched result/application/period and historical-exam reviews', async () => {
  result = publishedResult();
  for (const delta of [null, { resultId: 999 }, { applicationId: 99 }, { academicPeriodId: 99 }, { examId: 99 }, { updatedAt: new Date(Date.now() - 10000).toISOString() }]) {
    const res = await acceptReviewed(delta ? { ...reviewedDecision(), ...delta } : {});
    assert.equal(res.statusCode, delta ? 409 : 400); assert.equal(scholar, null); assert.equal(writes.length, 0);
  }
  const currentExam = exam; exam = { ...exam, academic_year: '2025-2026' };
  const res = await acceptReviewed(); assert.equal(res.statusCode, 409); assert.equal(writes.length, 0); exam = currentExam;
});

test('acceptance rereads the result inside the transaction and rejects a competing correction', async () => {
  result = publishedResult(); const review = reviewedDecision(); const transaction = prisma.$transaction;
  prisma.$transaction = (callback, options) => { result = { ...result, score: 0, passed: false, published_at: null, updated_at: new Date(+result.updated_at + 1) }; return transaction(callback, options); };
  const res = await acceptReviewed(review); assert.equal(res.statusCode, 409); assert.equal(scholar, null); assert.equal(writes.length, 0);
});

test('acceptance rejects terminal application states and retains the eligibility override requirement', async () => {
  result = publishedResult();
  for (const status of ['Rejected', 'Declined', 'Withdrawn']) { application.status = status; const res = await acceptReviewed(); assert.equal(res.statusCode, 409); assert.equal(writes.length, 0); }
  application.status = 'Examined'; const res = await acceptReviewed({ ...reviewedDecision(), reviewReason: '' });
  assert.equal(res.statusCode, 400); assert.equal(res.body.code, 'ELIGIBILITY_OVERRIDE_REASON_REQUIRED'); assert.equal(writes.length, 0);
});

test('acceptance rollback and serialization conflicts do not leave scholar or decision writes', async (t) => {
  result = publishedResult(); t.mock.method(console, 'error', () => {});
  prisma.eligibility_assessments.create = async () => { throw new Error('Synthetic assessment failure'); };
  const failed = await acceptReviewed(); assert.equal(failed.statusCode, 500); assert.equal(scholar, null); assert.equal(writes.length, 0);
  prisma.$transaction = async () => { throw Object.assign(new Error('Synthetic serialization conflict'), { code: 'P2034' }); };
  const conflicted = await acceptReviewed(); assert.equal(conflicted.statusCode, 409); assert.equal(writes.length, 0);
});

test('current schedule projection ignores a historical result and expired attempt guidance matches server denial', async () => {
  result = { ...publishedResult(), exam_id: 999 };
  const portal = response(); await getMyApplication({ user: { id: 7 } }, portal);
  assert.equal(portal.body.examination.completed, false); assert.equal(portal.body.examination.score, null);
  const management = response(); await getApplicantManagement({}, management); assert.equal(management.body.applicants[0].resultId, null); assert.equal(management.body.applicants[0].examId, 3); assert.equal(management.body.applicants[0].applicationId, 1); assert.equal(management.body.applicants[0].academicPeriodId, 1);
  result = null; slot = { ...slot, appeared: true, online_started_at: new Date(Date.now() - 60 * 60 * 1000), online_deadline_at: new Date(Date.now() - 15 * 60 * 1000), online_configuration_id: 1 };
  const expired = response(); await getMyApplication({ user: { id: 7 } }, expired);
  assert.equal(expired.body.examination.status, 'Attempt expired'); assert.equal(expired.body.examination.access.allowed, false);
  assert.equal(expired.body.guidance.actions[0].route, null); assert.match(expired.body.guidance.headline, /expired/);
  const questions = response(); await getOnlineExamQuestions({ user: { id: 7 } }, questions); assert.equal(questions.statusCode, 410);
});
