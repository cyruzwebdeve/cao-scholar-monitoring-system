const test = require('node:test');
const assert = require('node:assert/strict');
// Inject a transactional in-memory database: no production records or mail.
const prismaPath = require.resolve('../config/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: {} };
const { createExaminationResultController } = require('../controllers/examinationResultController');
const { resolveExaminationProgress } = require('../services/examinationProgress');
const { buildApplicantGuidance } = require('../services/applicantGuidance');
const response = () => ({ locals: {}, statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } });
const fixture = () => {
  let state = { result: null, application: { id: 1, status: 'Applied' }, slot: { id: 3, applicant_id: 7, exam_id: 9, appeared: true }, mode: 'paper', scholar: null, year: '2026-2027', failStatus: false, periods: [{ school_year: '2026-2027', is_primary: true }] };
  const client = { $transaction: async (fn, options) => {
    assert.equal(options.isolationLevel, 'Serializable');
    const draft = structuredClone(state);
    const tx = {
      academic_periods: { findFirst: async ({ where }) => where.is_primary ? draft.periods.find(p => p.is_primary) || null : draft.periods[0] || null },
      exams: { findUnique: async () => ({ id: 9, academic_year: draft.year }) },
      applicants: { findUnique: async () => ({ id: 7 }) },
      exam_slots: { findUnique: async () => draft.slot },
      scholar_accounts: { findFirst: async () => draft.scholar },
      application_submissions: { findFirst: async () => draft.application, updateMany: async ({ data }) => { if (draft.failStatus) throw new Error('Injected failure'); Object.assign(draft.application, data); return { count: 1 }; } },
      application_settings: { findUnique: async () => ({ exam_delivery_mode: draft.mode }) },
      results: {
        findFirst: async () => draft.result,
        findUnique: async () => draft.result,
        create: async ({ data }) => { draft.result = { id: 11, published_at: null, published_by: null, ...data }; return draft.result; },
        updateMany: async ({ where, data }) => {
          if (!draft.result || draft.result.id !== where.id || +new Date(draft.result.updated_at) !== +new Date(where.updated_at)) return { count: 0 };
          Object.assign(draft.result, data); return { count: 1 };
        },
      },
    };
    const result = await fn(tx); state = draft; return result;
  } };
  const controller = createExaminationResultController(client);
  return { controller, get state() { return state; }, async call(operation, body = { score: 14, passingScore: 14, remarks: 'Checked paper' }) {
    const res = response();
    await controller[operation]({ params: { examId: '9', applicantId: '7' }, user: { id: 2 }, body }, res);
    return res;
  }, revision() { return { resultId: state.result.id, updatedAt: state.result.updated_at.toISOString() }; } };
};

test('paper score recording creates a draft result, provenance and review history atomically', async () => {
  const f = fixture(); const r = await f.call('record');
  assert.equal(r.statusCode, 201); assert.equal(f.state.result.passed, true);
  assert.equal(f.state.result.delivery_mode, 'paper'); assert.equal(f.state.result.recorded_by, 2);
  assert.equal(f.state.result.published_at, null); assert.equal(f.state.application.status, 'Examined');
  assert.equal(f.state.result.review_history[0].operation, 'record');
  assert.equal(resolveExaminationProgress({ result: f.state.result, applicantFacing: true }).status, 'Result under review');
});

test('zero is a valid paper score and does not mean passed', async () => {
  const f = fixture(); const r = await f.call('record', { score: 0, passingScore: 14, remarks: 'Checked paper' });
  assert.equal(r.statusCode, 201); assert.equal(f.state.result.score, 0); assert.equal(f.state.result.passed, false);
});

test('rejects invalid scores, thresholds and malformed optional remarks before writing', async () => {
  for (const body of [ { score: '' }, { score: null }, { score: -1 }, { score: 21 }, { score: Infinity }, { score: 13.999 }, { passingScore: 14.001 }, { passingScore: 0 }, { passingScore: 21 }, { remarks: 42 }, { remarks: null }, { remarks: 'x'.repeat(2001) } ]) {
    const f = fixture(); const r = await f.call('record', { score: 14, passingScore: 14, remarks: 'Checked paper', ...body });
    assert.equal(r.statusCode, 400); assert.equal(f.state.result, null);
  }
});

test('requires assignment, Present attendance, active year and an available application', async () => {
  for (const change of [s => { s.slot = null; }, s => { s.slot.appeared = false; }, s => { s.slot.exam_id = 10; }, s => { s.year = '2025-2026'; }, s => { s.application.status = 'Withdrawn'; }, s => { s.scholar = { is_active: true }; }]) {
    const f = fixture(); change(f.state); const r = await f.call('record');
    assert.ok([404, 409].includes(r.statusCode)); assert.equal(f.state.result, null);
  }
});

test('manual first entry cannot replace online computation or duplicate a result', async () => {
  const f = fixture(); f.state.mode = 'online'; assert.equal((await f.call('record')).statusCode, 409);
  f.state.mode = 'paper'; await f.call('record'); assert.equal((await f.call('record')).statusCode, 409);
});

test('publication exposes passed/failed outcome without granting scholarship acceptance', async () => {
  for (const score of [0, 14]) {
    const f = fixture(); await f.call('record', { score, passingScore: 14, remarks: 'Checked paper' });
    const r = await f.call('publish', f.revision()); assert.equal(r.statusCode, 200);
    assert.equal(f.state.result.published_by, 2);
    const progress = resolveExaminationProgress({ result: f.state.result, applicantFacing: true });
    assert.equal(progress.status, score >= 14 ? 'Passed' : 'Did not pass'); assert.equal(progress.isScholar, false);
    const guidance = buildApplicantGuidance({ application: f.state.application, result: f.state.result });
    assert.match(guidance.description, score >= 14 ? /separate CAO decision/ : /not a final application rejection/);
    assert.equal(f.state.result.review_history.at(-1).operation, 'publish');
    assert.equal((await f.call('publish', f.revision())).statusCode, 409);
  }
});

test('correction keeps threshold, supports optional remarks, clears publication and retains history', async () => {
  const f = fixture(); await f.call('record'); await f.call('publish', f.revision());
  const before = f.revision();
  assert.equal((await f.call('correct', { ...before, score: 5, remarks: 42 })).statusCode, 400);
  assert.equal((await f.call('correct', { ...before, score: 5, remarks: 'Corrected addition', passingScore: 1 })).statusCode, 200);
  assert.equal(f.state.result.passing_score, 14); assert.equal(f.state.result.passed, false);
  assert.equal(f.state.result.published_at, null); assert.equal(f.state.result.published_by, null);
  assert.equal(f.state.result.review_history.length, 3);
  assert.equal(f.state.result.review_history[2].previousScore, 14);
  assert.equal(f.state.result.review_history[2].reason, 'Corrected addition');
  assert.equal((await f.call('publish', before)).statusCode, 409);
  assert.equal((await f.call('publish', f.revision())).statusCode, 200);
});

test('publication/correction reject missing or stale result revision and lock accepted scholars', async () => {
  const f = fixture(); await f.call('record');
  assert.equal((await f.call('publish', {})).statusCode, 400);
  assert.equal((await f.call('publish', { ...f.revision(), resultId: 99 })).statusCode, 409);
  f.state.scholar = { is_active: true };
  assert.equal((await f.call('publish', f.revision())).statusCode, 409);
  assert.equal((await f.call('correct', { ...f.revision(), score: 15, remarks: 'Correction' })).statusCode, 409);
});

test('database failure rolls back score, history and application status together', async () => {
  const f = fixture(); f.state.failStatus = true;
  const r = await f.call('record'); assert.equal(r.statusCode, 500);
  assert.equal(f.state.result, null); assert.equal(f.state.application.status, 'Applied');
});

test('publication also supports automatically computed online results', async () => {
  const f = fixture(); await f.call('record'); f.state.result.delivery_mode = 'online';
  assert.equal((await f.call('publish', f.revision())).statusCode, 200);
  assert.equal(resolveExaminationProgress({ result: f.state.result, applicantFacing: true }).status, 'Passed');
});


test('an existing unscored result can be corrected but cannot be published empty', async () => {
  const f = fixture(); await f.call('record'); f.state.result.score = null;
  assert.equal((await f.call('publish', f.revision())).statusCode, 409);
  assert.equal((await f.call('correct', { ...f.revision(), score: 0, remarks: 'Filled missing paper score' })).statusCode, 200);
  assert.equal(f.state.result.review_history.at(-1).previousScore, null);
  assert.equal(f.state.result.score, 0);
});

test('paper record, correction and publication use the primary period even when a secondary year was updated later', async () => {
  const f = fixture(); f.state.periods = [{ school_year: '2027-2028', is_primary: false }, { school_year: '2026-2027', is_primary: true }];
  assert.equal((await f.call('record')).statusCode, 201);
  assert.equal((await f.call('correct', { ...f.revision(), score: 15, remarks: 'Synthetic checked correction' })).statusCode, 200);
  assert.equal((await f.call('publish', f.revision())).statusCode, 200);
});

test('paper result mutations reject terminal and unknown application states without writes', async () => {
  for (const status of ['Withdrawn', 'Rejected', 'Declined', 'Unknown']) {
    const f = fixture(); f.state.application.status = status;
    assert.equal((await f.call('record')).statusCode, 409); assert.equal(f.state.result, null);
  }
});

test('recording a paper score requires no manual remark and retains automatic operational history', async () => {
  for (const extras of [{}, {remarks:''}, {remarks:'   '}]) {
    const f=fixture(); const r=await f.call('record',{score:14,passingScore:14,...extras});
    assert.equal(r.statusCode,201); assert.equal(f.state.result.remarks,'');
    assert.equal(f.state.result.review_history[0].reasonSource,'system');
    assert.equal(f.state.result.review_history[0].actorId,2);
    assert.equal(f.state.result.review_history[0].reason,'Score recorded without an additional staff remark.');
  }
});
test('correction without remarks preserves historical notes, records before/after and requires republication', async () => {
  const f=fixture(); await f.call('record'); await f.call('publish',f.revision());
  const r=await f.call('correct',{...f.revision(),score:10});
  assert.equal(r.statusCode,200); assert.equal(f.state.result.remarks,'Checked paper');
  assert.equal(f.state.result.published_at,null); assert.equal(f.state.result.passing_score,14);
  const event=f.state.result.review_history.at(-1);
  assert.equal(event.previousScore,14); assert.equal(event.score,10); assert.equal(event.actorId,2);
  assert.equal(event.reasonSource,'system'); assert.equal(event.reason,'Score corrected without an additional staff remark.');
});
test('blank legacy correction remarks do not erase prior notes, while supplied text is still accepted', async () => {
  const f=fixture(); await f.call('record');
  assert.equal((await f.call('correct',{...f.revision(),score:15,remarks:' '})).statusCode,200);
  assert.equal(f.state.result.remarks,'Checked paper');
  assert.equal((await f.call('correct',{...f.revision(),score:16,remarks:'Optional legacy note'})).statusCode,200);
  assert.equal(f.state.result.remarks,'Optional legacy note');
  assert.equal(f.state.result.review_history.at(-1).reasonSource,'staff');
});
