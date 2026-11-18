import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';
import { saveProcessingHandoff, readProcessingHandoff, clearProcessingHandoff, preparedBillingQueueIds } from '../src/utils/processingHandoff.js';

const key = 'pgceap-processing-handoff';
let values;
beforeEach(() => {
  values = new Map();
  globalThis.sessionStorage = {
    getItem: (name) => values.get(name) ?? null,
    setItem: (name, value) => values.set(name, value),
    removeItem: (name) => values.delete(name),
  };
});

test('legacy single-Scholar handoffs preserve their payload and both processing modes', () => {
  for (const mode of ['billing', 'payroll']) {
    assert.equal(saveProcessingHandoff({ periodId: 9, applicantId: 4, mode }), true);
    const handoff = readProcessingHandoff(mode);
    assert.equal(handoff.applicantId, 4);
    assert.equal(handoff.periodId, 9);
    assert.equal(handoff.mode, mode);
    assert.equal(handoff.applicantIds, undefined);
    assert.equal(readProcessingHandoff(mode === 'billing' ? 'payroll' : 'billing'), null);
    assert.ok(values.has(key));
  }
  clearProcessingHandoff();
  assert.equal(values.has(key), false);
});

test('batch handoffs carry only selected IDs/period/actor and cannot be consumed by another staff account', () => {
  assert.equal(saveProcessingHandoff({ periodId: 9, applicantIds: [4, 7], actorId: 12, mode: 'billing' }), true);
  const handoff = readProcessingHandoff('billing', 12);
  assert.deepEqual(handoff.applicantIds, [4, 7]);
  assert.equal(handoff.queuePrepared, true);
  assert.deepEqual(Object.keys(handoff).sort(), ['actorId', 'applicantIds', 'createdAt', 'mode', 'periodId', 'queuePrepared']);
  assert.equal(readProcessingHandoff('payroll', 12), null);
  assert.ok(values.has(key));
  assert.equal(readProcessingHandoff('billing', 13), null);
  assert.equal(values.has(key), false);
});

test('invalid, duplicate, oversized, expired and future handoffs are rejected', () => {
  for (const patch of [
    { applicantIds: [] }, { applicantIds: [4, 4] }, { applicantIds: [0] }, { applicantIds: ['4'] },
    { applicantIds: Array.from({ length: 101 }, (_, index) => index + 1) },
    { actorId: 0 }, { actorId: undefined }, { periodId: 0 }, { mode: 'payroll' },
  ]) assert.equal(saveProcessingHandoff({ periodId: 9, applicantIds: [4], actorId: 12, mode: 'billing', ...patch }), false);
  for (const createdAt of [Date.now() - 600001, Date.now() + 600000, null, 'invalid']) {
    values.set(key, JSON.stringify({ mode: 'billing', periodId: 9, applicantIds: [4], actorId: 12, queuePrepared: true, createdAt }));
    assert.equal(readProcessingHandoff('billing', 12), null);
    assert.equal(values.has(key), false);
  }
});

test('queued batch IDs are rechecked against fresh current-period Billing eligibility', () => {
  const handoff = { mode: 'billing', queuePrepared: true, actorId: 12, periodId: 9, applicantIds: [4, 5, 6, 7, 8, 9] };
  const row = (applicantId, patch = {}) => ({ applicantId, academicPeriodId: 9, schoolType: 'Private', processRoute: 'billing', processEligible: true, grantPrepared: true, billed: false, ...patch });
  const records = [row(4), row(5, { billed: true }), row(6, { processRoute: 'payroll' }), row(7, { academicPeriodId: 10 }), row(8, { grantPrepared: false }), row(9, { processEligible: false })];
  assert.deepEqual(preparedBillingQueueIds(handoff, records, 9, 12), [4]);
  assert.deepEqual(preparedBillingQueueIds(handoff, records, 10, 12), []);
  assert.deepEqual(preparedBillingQueueIds(handoff, records, 9, 13), []);
  assert.deepEqual(preparedBillingQueueIds(handoff, [row(4, { isArchivedPeriod: true })], 9, 12), []);
});

test('optional session storage failure does not claim successful navigation', () => {
  globalThis.sessionStorage = { setItem() { throw new Error('Synthetic storage blocked'); }, getItem() { throw new Error('Synthetic storage blocked'); }, removeItem() { throw new Error('Synthetic storage blocked'); } };
  assert.equal(saveProcessingHandoff({ periodId: 9, applicantIds: [4], actorId: 12, mode: 'billing' }), false);
  assert.equal(readProcessingHandoff('billing', 12), null);
  assert.doesNotThrow(clearProcessingHandoff);
});
