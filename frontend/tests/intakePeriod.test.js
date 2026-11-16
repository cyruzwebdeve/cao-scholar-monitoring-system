import test from 'node:test';
import assert from 'node:assert/strict';
import { applicationIntakeScope, createIntakeRequestGuard, intakeScopeLabel, intakeYearQuery } from '../src/utils/intakePeriod.js';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

test('intake queries distinguish current default, one historical year and all-year history', () => {
  assert.equal(intakeYearQuery(), '');
  assert.equal(intakeYearQuery('2026-2027'), '?schoolYear=2026-2027');
  assert.equal(intakeYearQuery('all'), '?schoolYear=all');
  assert.equal(intakeYearQuery('All School Years'), '?schoolYear=All%20School%20Years');
});

test('application submission uses displayed intake identity even when Scholar processing is inactive', () => {
  const period = { id: 12, schoolYear: '2027-2028', semester: '1st Semester', isActive: false, isPrimary: false, isCurrentIntake: true };
  assert.deepEqual(applicationIntakeScope(period), { academicPeriodId: 12, academicYear: '2027-2028' });
  assert.equal(period.isActive, false);
  assert.equal(period.isPrimary, false);
});

test('invalid or missing intake identity cannot be submitted or replaced with a guessed year', () => {
  for (const period of [null, {}, { id: 0, schoolYear: '2026-2027' }, { id: '1', schoolYear: '2026-2027' },
    { id: 1, schoolYear: '2026' }, { id: 1, schoolYear: '2026-2026' }, { id: 1, schoolYear: '2027-2026' }]) {
    assert.throws(() => applicationIntakeScope(period), /Load the application intake year/);
  }
});

test('intake labels distinguish current work from historical data', () => {
  assert.equal(intakeScopeLabel({ schoolYear: '2027-2028', isCurrentIntake: true }), '2027-2028 · Current intake');
  assert.equal(intakeScopeLabel({ isCurrentIntake: true }, { schoolYear: '2026-2027' }), '2026-2027 · Current intake');
  assert.equal(intakeScopeLabel({ schoolYear: '2025-2026', isCurrentIntake: false }), '2025-2026 · Historical intake');
  assert.equal(intakeScopeLabel({ schoolYear: 'all', isCurrentIntake: false }), 'All intake years · History');
  assert.equal(intakeScopeLabel(null), 'Intake year unavailable');
});

test('current intake request publishes its successful data and loading completion', async () => {
  const guard = createIntakeRequestGuard();
  const events = [];
  const result = await guard.run(async signal => {
    assert.equal(signal.aborted, false);
    return { schoolYear: '2027-2028' };
  }, { onLoading: value => events.push(['loading', value]), onSuccess: value => events.push(['data', value.schoolYear]) });
  assert.deepEqual(result, { schoolYear: '2027-2028' });
  assert.deepEqual(events, [['loading', true], ['data', '2027-2028'], ['loading', false]]);
});

test('an old successful response cannot replace the newly selected intake', async () => {
  const guard = createIntakeRequestGuard();
  const old = deferred(), newer = deferred(), events = [];
  let oldSignal;
  const oldRun = guard.run(signal => { oldSignal = signal; return old.promise; }, { onSuccess: value => events.push(value) });
  const newRun = guard.run(() => newer.promise, { onSuccess: value => events.push(value) });
  assert.equal(oldSignal.aborted, true);
  newer.resolve('2027-2028'); await newRun;
  old.resolve('2026-2027'); await oldRun;
  assert.deepEqual(events, ['2027-2028']);
});

test('an obsolete request failure cannot replace a new year with an error or end its loading state', async () => {
  const guard = createIntakeRequestGuard();
  const old = deferred(), newer = deferred(), errors = [], loading = [];
  const oldRun = guard.run(() => old.promise, { onError: error => errors.push(error.message), onLoading: value => loading.push(value) });
  const newRun = guard.run(() => newer.promise, { onError: error => errors.push(error.message), onLoading: value => loading.push(value) });
  old.reject(new Error('Old-year failure')); await oldRun;
  assert.deepEqual(errors, []);
  assert.deepEqual(loading, [true, true]);
  newer.resolve({}); await newRun;
  assert.deepEqual(loading, [true, true, false]);
});

test('a current failed request exposes a recoverable error and ends only its own loading state', async () => {
  const guard = createIntakeRequestGuard();
  const events = [];
  await guard.run(async () => { throw new Error('Current intake unavailable'); }, {
    onError: error => events.push(error.message), onLoading: value => events.push(value),
  });
  assert.deepEqual(events, [true, 'Current intake unavailable', false]);
  const next = await guard.run(async () => ({ schoolYear: '2027-2028' }));
  assert.equal(next.schoolYear, '2027-2028');
});

test('cancellation invalidates late success and error callbacks', async () => {
  for (const outcome of ['success', 'failure']) {
    const guard = createIntakeRequestGuard(), pending = deferred(), events = [];
    let signal;
    const run = guard.run(value => { signal = value; return pending.promise; }, {
      onSuccess: value => events.push(value), onError: error => events.push(error.message),
    });
    guard.cancel();
    assert.equal(signal.aborted, true);
    if (outcome === 'success') pending.resolve('old year'); else pending.reject(new Error('old failure'));
    await run;
    assert.deepEqual(events, []);
  }
});
