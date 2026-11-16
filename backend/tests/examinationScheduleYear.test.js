const assert = require('node:assert/strict');
const { test, beforeEach } = require('node:test');

// Exercise the actual handlers with in-memory data; never load database credentials or send email.
const prisma = {};
for (const [modulePath, exports] of [
  ['../config/prisma', prisma],
  ['../services/mailer', {}],
]) {
  const filename = require.resolve(modulePath);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}
const { getExaminationManagement, saveExaminationManagement } = require('../controllers/applicationController');

const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});
const period = (id, schoolYear, semester = '1st Semester') => ({
  id, school_year: schoolYear, semester, is_active: true, is_primary: true, status: 'active',
});
const exam = (id, academicYear) => ({
  id, academic_year: academicYear, municipality: 'Daet', venue: 'Saved venue',
  exam_date: new Date('2026-07-20T00:00:00Z'), exam_end_date: new Date('2026-07-21T00:00:00Z'),
  is_active: true, updated_at: new Date('2026-07-01T00:00:00Z'),
});
const body = (overrides = {}) => ({
  academicPeriodId: activePeriod?.id,
  academicYear: activePeriod?.school_year,
  examinations: [{ municipality: 'Daet', venue: 'Current venue', date: '2027-07-20', endDate: '2027-07-21', isActive: true }],
  ...overrides,
});
const save = async (payload = body()) => {
  const res = response();
  await saveExaminationManagement({ body: payload, user: { id: 99 } }, res);
  return res;
};
let activePeriod;
let processingPeriod;
let records;
let slots;
let results;
let applicants;
let writes;
let events;
let beforeTransaction;

beforeEach(() => {
  activePeriod = period(1, '2026-2027');
  processingPeriod = period(1, '2026-2027');
  records = [exam(10, '2026-2027'), exam(20, '2025-2026')];
  slots = [{ applicant_id: 1, exam_id: 20, appeared: true }];
  results = [{ id: 1, exam_id: 20, score: 18 }];
  applicants = [];
  writes = [];
  events = [];
  beforeTransaction = null;
  Object.assign(prisma, {
    intake_settings: { findUnique: async () => ({ id: 1, academic_period_id: activePeriod?.id || null, revision: 0 }) },
    academic_periods: {
      findFirst: async () => processingPeriod,
      findUnique: async ({ where }) => { events.push('read-period'); return activePeriod?.id === where.id ? activePeriod : processingPeriod?.id === where.id ? processingPeriod : null; },
      findMany: async () => [processingPeriod, activePeriod, period(9, '2025-2026')].filter(Boolean),
    },
    exams: {
      findMany: async ({ where }) => records.filter((record) => !where || record.academic_year === where.academic_year)
        .sort((left, right) => Number(right.updated_at) - Number(left.updated_at)),
      findFirst: async ({ where }) => {
        events.push('read-exam');
        return records.find((record) => record.academic_year === where.academic_year
          && record.municipality.toLowerCase() === where.municipality.equals.toLowerCase()) || null;
      },
      update: async ({ where, data }) => {
        writes.push({ kind: 'update-exam', id: where.id });
        const record = records.find((item) => item.id === where.id);
        Object.assign(record, data);
        return record;
      },
      create: async ({ data }) => {
        const record = { id: Math.max(0, ...records.map(({ id }) => id)) + 1, ...data };
        writes.push({ kind: 'create-exam', id: record.id });
        records.push(record);
        return record;
      },
    },
    applicants: {
      findMany: async ({ where }) => applicants.filter((applicant) => where.OR.some((filter) => filter.school_year === applicant.school_year)),
    },
    exam_slots: {
      createMany: async ({ data }) => {
        const added = data.filter((entry) => !slots.some((slot) => slot.applicant_id === entry.applicant_id && slot.exam_id === entry.exam_id));
        slots.push(...added);
        writes.push({ kind: 'create-slots', entries: added });
        return { count: added.length };
      },
    },
    $queryRaw: async (query) => {
      assert.match(query.join('?'), /^SELECT id FROM intake_settings WHERE id = 1 FOR SHARE$/);
      events.push('lock-period');
      return [{ id: 1 }];
    },
    $transaction: async (callback) => {
      if (beforeTransaction) beforeTransaction();
      const snapshot = structuredClone({ records, slots, writes });
      try {
        return await callback(prisma);
      } catch (error) {
        ({ records, slots, writes } = snapshot);
        throw error;
      }
    },
  });
});

test('management loads only the selected intake school year and preserves saved dates', async () => {
  const res = response();
  await getExaminationManagement({}, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.activePeriod.schoolYear, '2026-2027');
  assert.deepEqual(res.body.examinations.map(({ id }) => id), [10]);
  assert.equal(res.body.examinations[0].date.toISOString(), '2026-07-20T00:00:00.000Z');
  assert.equal(writes.length, 0);
});

test('a new school year with no schedules loads empty without carrying historical rows', async () => {
  activePeriod = period(2, '2027-2028');
  const historical = structuredClone(records);
  const res = response();
  await getExaminationManagement({}, res);
  assert.deepEqual(res.body.examinations, []);
  assert.equal(res.body.activePeriod.schoolYear, '2027-2028');
  assert.deepEqual(records, historical);
  assert.equal(writes.length, 0);
});

test('no selected intake returns an honest empty state rather than a fabricated academic year', async () => {
  activePeriod = null;
  prisma.exams.findMany = async ({ where }) => { assert.equal(where, undefined); return []; };
  const res = response();
  await getExaminationManagement({}, res);
  assert.deepEqual(res.body.examinations, []);
  assert.equal(res.body.activePeriod, null);
  assert.equal(res.body.intakePeriod, null);
  assert.equal(res.body.scope.schoolYear, null);
  assert.equal(res.body.scope.isCurrentIntake, false);
  assert.equal(writes.length, 0);
});

test('schedule saves require the academic scope loaded by the client', async () => {
  for (const overrides of [
    { academicPeriodId: undefined }, { academicYear: undefined }, { academicPeriodId: 0 },
    { academicYear: '2026-2028' }, { academicPeriodId: 'invalid' },
  ]) {
    const res = await save(body(overrides));
    assert.equal(res.statusCode, 400);
  }
  assert.equal(writes.length, 0);
});

test('a stale year, mismatched period or unavailable intake rejects every schedule write', async () => {
  const stale = body();
  activePeriod = period(2, '2027-2028');
  assert.equal((await save(stale)).statusCode, 409);
  assert.equal((await save(body({ academicPeriodId: 1 }))).statusCode, 409);
  assert.equal((await save(body({ academicYear: '2026-2027' }))).statusCode, 409);
  activePeriod = null;
  assert.equal((await save(stale)).statusCode, 409);
  assert.equal(writes.length, 0);
});

test('an intake change between preflight and transaction rejects the old page before writes', async () => {
  const loaded = body();
  beforeTransaction = () => { activePeriod = period(2, '2027-2028'); };
  const res = await save(loaded);
  assert.equal(res.statusCode, 409);
  assert.deepEqual(events, ['read-period', 'lock-period', 'read-period']);
  assert.equal(writes.length, 0);
  assert.equal(records.length, 2);
});

test('historical schedules remain selectable and read-only without changing current intake', async () => {
  const res = response();
  await getExaminationManagement({ query: { schoolYear: '2025-2026' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.scope.schoolYear, '2025-2026');
  assert.equal(res.body.scope.isCurrentIntake, false);
  assert.deepEqual(res.body.examinations.map(({ id }) => id), [20]);
  assert.equal(res.body.intakePeriod.schoolYear, '2026-2027');
  assert.equal(writes.length, 0);
});

test('changing the Scholar processing primary does not change the selected intake', async () => {
  processingPeriod = period(7, '2028-2029');
  const res = response();
  await getExaminationManagement({}, res);
  assert.equal(res.body.intakePeriod.id, 1);
  assert.deepEqual(res.body.examinations.map(({ id }) => id), [10]);
  assert.equal((await save()).statusCode, 200);
  assert.equal(records[0].academic_year, '2026-2027');
});

test('an intake selected from an inactive processing period can save schedules without activating it', async () => {
  activePeriod = { ...period(2, '2027-2028'), is_active: false, is_primary: false, status: 'upcoming' };
  const res = await save();
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.intakePeriod.isCurrentIntake, true);
  assert.equal(res.body.intakePeriod.isActive, false);
  assert.equal(res.body.intakePeriod.isPrimary, false);
  assert.equal(processingPeriod.id, 1);
  assert.equal(activePeriod.is_active, false);
});

test('saving locks and revalidates the period before updating only its year', async () => {
  const historicalExam = structuredClone(records[1]);
  const historicalSlots = structuredClone(slots);
  const historicalResults = structuredClone(results);
  const res = await save();
  assert.equal(res.statusCode, 200);
  assert.deepEqual(events.slice(0, 4), ['read-period', 'lock-period', 'read-period', 'read-exam']);
  assert.deepEqual(writes, [{ kind: 'update-exam', id: 10 }]);
  assert.equal(records[0].venue, 'Current venue');
  assert.deepEqual(records[1], historicalExam);
  assert.deepEqual(slots, historicalSlots);
  assert.deepEqual(results, historicalResults);
  assert.equal(res.body.activePeriod.id, 1);
  assert.equal(res.body.examinations[0].id, 10);
});

test('saving a new year creates new schedules and assignments without changing historical attendance/results', async () => {
  activePeriod = period(2, '2027-2028');
  applicants = [
    { id: 1, school_year: '2026-2027', municipality: 'Daet' },
    { id: 2, school_year: '2027-2028', municipality: 'Daet' },
  ];
  const historical = structuredClone({ records, slots, results });
  const res = await save();
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.examinations[0].academicYear, '2027-2028');
  assert.deepEqual(records.slice(0, 2), historical.records);
  assert.deepEqual(slots[0], historical.slots[0]);
  assert.deepEqual(results, historical.results);
  assert.deepEqual(slots[1], { applicant_id: 2, exam_id: 21, appeared: false });
});

test('semesters share saved school-year schedules but a stale semester scope must reload', async () => {
  const oldScope = body();
  activePeriod = period(3, '2026-2027', '2nd Semester');
  assert.equal((await save(oldScope)).statusCode, 409);
  const res = await save();
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.examinations[0].id, 10);
  assert.equal(res.body.activePeriod.semester, '2nd Semester');
  assert.equal(records.length, 2);
});

test('blank or null dates cannot insert placeholder examination dates', async () => {
  for (const date of ['', null, undefined]) {
    const res = await save(body({ examinations: [{ municipality: 'Daet', venue: 'Current venue', date, isActive: false }] }));
    assert.equal(res.statusCode, 400);
  }
  assert.equal(writes.length, 0);
});

test('failed transactions preserve stored schedules and retryable conflicts return 409', async (t) => {
  t.mock.method(console, 'error', () => {});
  const original = structuredClone(records);
  prisma.applicants.findMany = async () => { throw new Error('Synthetic transaction failure'); };
  assert.equal((await save()).statusCode, 500);
  assert.deepEqual(records, original);
  assert.equal(writes.length, 0);
  prisma.$transaction = async () => { throw Object.assign(new Error('Synthetic conflict'), { code: 'P2034' }); };
  assert.equal((await save()).statusCode, 409);
  assert.equal(writes.length, 0);
});
