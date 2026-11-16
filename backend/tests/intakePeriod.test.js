const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const configPath = require.resolve('../config/prisma');
require.cache[configPath] = { id: configPath, filename: configPath, loaded: true, exports: {} };
const { createIntakePeriodController } = require('../controllers/intakePeriodController');
const { findIntakePeriod, requireIntakePeriod, lockIntakePeriod, serializeIntakePeriod } = require('../services/intakePeriod');

const period = (id, year, flags = {}) => ({ id, school_year: year, semester: '1st Semester',
  is_active: false, is_primary: false, status: 'upcoming', ...flags });
const response = () => ({ statusCode: 200, locals: {}, headers: {},
  set(name, value) { this.headers[name] = value; return this; },
  status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

const fixture = () => {
  let state = { settings: { id: 1, academic_period_id: 1, revision: 0 },
    periods: [period(1, '2026-2027', { is_active: true, is_primary: true, status: 'active' }),
      period(2, '2027-2028'), period(3, '2026-2027', { semester: '2nd Semester' })],
    exams: [{ id: 10, academic_year: '2026-2027', is_active: true, venue: 'Saved venue' },
      { id: 20, academic_year: '2025-2026', is_active: true, venue: 'Historical venue' }], slots: [], results: [], writes: [], locks: [] };
  const now = new Date('2026-11-16T10:00:00Z');
  const client = {
    intake_settings: {
      findUnique: async () => state.settings,
      updateMany: async ({ where, data }) => {
        if (!state.settings || state.settings.revision !== where.revision) return { count: 0 };
        state.writes.push('intake_settings');
        Object.assign(state.settings, { ...data, revision: state.settings.revision + data.revision.increment });
        return { count: 1 };
      },
      create: async ({ data }) => { state.writes.push('intake_settings'); state.settings = { ...data }; return state.settings; },
    },
    academic_periods: { findUnique: async ({ where }) => state.periods.find(row => row.id === where.id) || null },
    exams: {
      findMany: async ({ where }) => state.exams.filter(row => row.academic_year === where.academic_year),
      updateMany: async ({ where, data }) => {
        const rows = state.exams.filter(row => row.academic_year === where.academic_year && row.is_active === where.is_active);
        state.writes.push('exams'); rows.forEach(row => Object.assign(row, data)); return { count: rows.length };
      },
    },
    exam_slots: { findMany: async ({ where }) => state.slots.filter(row => where.exam_id.in.includes(row.exam_id)
      && row.online_started_at && new Date(row.online_deadline_at) > where.online_deadline_at.gt && !row.forfeited_at) },
    results: { findMany: async ({ where }) => state.results.filter(row => where.OR.some(pair => pair.applicant_id === row.applicant_id && pair.exam_id === row.exam_id)) },
    $queryRaw: async (strings, ...values) => { state.locks.push({ sql: strings.join('?'), values }); return state.settings ? [{ id: 1 }] : []; },
    $transaction: async callback => {
      const before = structuredClone(state);
      try { return await callback(client); } catch (error) { state = before; throw error; }
    },
  };
  const controller = createIntakePeriodController({ client, now: () => now });
  const save = async (academicPeriodId = 2, revision = state.settings?.revision || 0) => {
    const res = response(); await controller.updateIntakePeriod({ body: { academicPeriodId, revision }, user: { id: 99 } }, res); return res;
  };
  return { client, controller, get state() { return state; }, now, save };
};

test('intake selection remains independent of processing primary and activation', async () => {
  const f = fixture();
  f.state.settings.academic_period_id = 2;
  assert.equal((await findIntakePeriod(f.client)).id, 2);
  assert.equal((await findIntakePeriod(f.client)).is_active, false);
  assert.equal(f.state.periods[0].is_primary, true);
  f.state.periods[0].is_primary = false;
  f.state.periods[2].is_primary = true;
  assert.equal((await findIntakePeriod(f.client)).id, 2);
  assert.deepEqual(f.state.writes, []);
});

test('missing intake selection stays unavailable rather than falling back to a processing year', async () => {
  const f = fixture(); f.state.settings.academic_period_id = null;
  assert.equal(await findIntakePeriod(f.client), null);
  f.state.settings = null;
  assert.equal(await findIntakePeriod(f.client), null);
  await assert.rejects(requireIntakePeriod(f.client, 1, '2026-2027'), error => error.statusCode === 409);
});

test('missing database delegate/schema fails closed with a generic public unavailable message', async () => {
  const publicFailure = error => error.statusCode === 503
    && error.message === 'Application and examination intake is unavailable. Please try again later or contact CAO.';
  await assert.rejects(findIntakePeriod({}), publicFailure);
  for (const code of ['P2021', 'P2022']) {
    await assert.rejects(findIntakePeriod({ intake_settings: { findUnique: async () => { throw { code }; } } }), publicFailure);
  }
});

test('save guard locks intake selection and verifies exact period and year', async () => {
  const f = fixture();
  assert.equal((await lockIntakePeriod(f.client, 1, '2026-2027')).id, 1);
  assert.match(f.state.locks[0].sql, /intake_settings.*FOR SHARE/);
  f.state.settings.academic_period_id = 2;
  await assert.rejects(lockIntakePeriod(f.client, 1, '2026-2027'), error => error.statusCode === 409);
  await assert.rejects(requireIntakePeriod(f.client, 2, '2026-2027'), error => error.statusCode === 409);
  assert.deepEqual(f.state.writes, []);
});

test('public intake response exposes real processing flags and current intake identity without private data', async () => {
  const f = fixture(); f.state.settings.academic_period_id = 2;
  const res = response(); await f.controller.getIntakePeriod({}, res);
  assert.equal(res.body.intakePeriod.schoolYear, '2027-2028');
  assert.equal(res.body.intakePeriod.isActive, false);
  assert.equal(res.body.intakePeriod.isPrimary, false);
  assert.equal(res.body.intakePeriod.isCurrentIntake, true);
  assert.equal(res.body.revision, 0);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.equal(res.body.intakePeriod.updatedBy, undefined);
  assert.equal(serializeIntakePeriod(null), null);
});

test('public empty intake response is truthful and performs no configuration write', async () => {
  const f = fixture(); f.state.settings.academic_period_id = null;
  const res = response(); await f.controller.getIntakePeriod({}, res);
  assert.deepEqual(res.body, { intakePeriod: null, revision: 0 });
  assert.deepEqual(f.state.writes, []);
});

test('new-year intake switch deactivates only prior intake examinations and preserves processing periods', async () => {
  const f = fixture(); const periodsBefore = structuredClone(f.state.periods);
  const res = await f.save();
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.intakePeriod.id, 2);
  assert.equal(res.body.revision, 1);
  assert.deepEqual(f.state.periods, periodsBefore);
  assert.equal(f.state.exams[0].is_active, false);
  assert.equal(f.state.exams[0].venue, 'Saved venue');
  assert.equal(f.state.exams[1].is_active, true);
  assert.deepEqual(f.state.writes, ['intake_settings', 'exams']);
  assert.match(f.state.locks[0].sql, /intake_settings.*FOR UPDATE/);
  assert.equal(res.locals.auditTargetId, 1);
});

test('same-year semester switch preserves annual examination activation', async () => {
  const f = fixture(); const res = await f.save(3);
  assert.equal(res.statusCode, 200);
  assert.equal(f.state.exams[0].is_active, true);
  assert.deepEqual(f.state.writes, ['intake_settings']);
});

test('unchanged selection produces no writes and stale revisions cannot overwrite a newer selection', async () => {
  const f = fixture();
  assert.equal((await f.save(1)).body.revision, 0);
  assert.deepEqual(f.state.writes, []);
  await f.save(2);
  const before = structuredClone(f.state);
  assert.equal((await f.save(1, 0)).statusCode, 409);
  assert.deepEqual(f.state, before);
});

test('invalid/unconfigured intake changes reject without editing periods or records', async () => {
  const f = fixture();
  for (const [id, revision, status] of [[0, 0, 400], [2, -1, 400], [2, '0', 400], [999, 0, 404]]) {
    assert.equal((await f.save(id, revision)).statusCode, status);
  }
  assert.deepEqual(f.state.writes, []);
});

test('unfinished unexpired online attempt blocks a cross-year intake switch', async () => {
  const f = fixture(); f.state.slots.push({ applicant_id: 7, exam_id: 10,
    online_started_at: new Date(f.now - 1000), online_deadline_at: new Date(+f.now + 1000), forfeited_at: null });
  const before = structuredClone(f.state);
  assert.equal((await f.save()).statusCode, 409);
  assert.deepEqual(f.state, before);
});

test('completed/expired/forfeited attempts do not prevent a later intake year', async () => {
  for (const outcome of ['completed', 'expired', 'forfeited']) {
    const f = fixture(); f.state.slots.push({ applicant_id: 7, exam_id: 10,
      online_started_at: new Date(f.now - 1000), online_deadline_at: new Date(+f.now + (outcome === 'expired' ? -1 : 1000)),
      forfeited_at: outcome === 'forfeited' ? f.now : null });
    if (outcome === 'completed') f.state.results.push({ applicant_id: 7, exam_id: 10 });
    assert.equal((await f.save()).statusCode, 200, outcome);
  }
});

test('same-year semester change does not strand a school-year examination attempt', async () => {
  const f = fixture(); f.state.slots.push({ applicant_id: 7, exam_id: 10,
    online_started_at: new Date(f.now - 1000), online_deadline_at: new Date(+f.now + 1000) });
  assert.equal((await f.save(3)).statusCode, 200);
});

test('an empty singleton can be configured explicitly without changing processing defaults', async () => {
  const f = fixture(); f.state.settings = null;
  assert.equal((await f.save(2, 0)).body.revision, 1);
  assert.equal(f.state.periods[0].is_primary, true);
  assert.deepEqual(f.state.writes, ['intake_settings']);
});

test('migration seeds intake once with a real processing default and preserves existing tables', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../prisma/migrations/20261116010000_application_examination_intake/migration.sql'), 'utf8');
  assert.match(sql, /CHECK \("id" = 1\)/);
  assert.match(sql, /REFERENCES "academic_periods"\("id"\) ON DELETE RESTRICT/);
  assert.match(sql, /WHERE "is_active" = TRUE/);
  assert.match(sql, /ORDER BY "is_primary" DESC, "updated_at" DESC, "id" DESC/);
  assert.doesNotMatch(sql, /UPDATE\s+"?academic_periods|DELETE\s+FROM|DROP\s+(?:TABLE|DATABASE)/i);
});
