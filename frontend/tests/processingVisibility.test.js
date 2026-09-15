import assert from 'node:assert/strict';
import test from 'node:test';
import { canQueueForProcessing, isVisibleInProcessingMode } from '../src/utils/processingVisibility.js';

const publicScholar = { schoolType: 'Public', processRoute: 'payroll', processEligible: true };
const privateScholar = { schoolType: 'Private', processRoute: 'billing', processEligible: true };
const unclassifiedScholar = { schoolType: 'Unclassified', processRoute: 'payroll', processEligible: false };

test('Payroll retains all five rows when three become Unclassified', () => {
  const records = [publicScholar, publicScholar, unclassifiedScholar, unclassifiedScholar, unclassifiedScholar];
  assert.equal(records.filter((record) => isVisibleInProcessingMode(record, 'payroll')).length, 5);
});

test('known school classifications stay in their own processing view', () => {
  assert.equal(isVisibleInProcessingMode(publicScholar, 'payroll'), true);
  assert.equal(isVisibleInProcessingMode(privateScholar, 'payroll'), false);
  assert.equal(isVisibleInProcessingMode(privateScholar, 'billing'), true);
  assert.equal(isVisibleInProcessingMode(publicScholar, 'billing'), false);
});

test('Unclassified records remain visible for correction in both views', () => {
  assert.equal(isVisibleInProcessingMode(unclassifiedScholar, 'payroll'), true);
  assert.equal(isVisibleInProcessingMode(unclassifiedScholar, 'billing'), true);
});

test('missing and unexpected legacy classifications are not hidden or allowed to queue', () => {
  for (const schoolType of [undefined, null, '', 'unknown']) {
    const record = { ...unclassifiedScholar, schoolType, processEligible: true };
    assert.equal(isVisibleInProcessingMode(record, 'payroll'), true);
    assert.equal(canQueueForProcessing(record, 'payroll'), false);
    assert.equal(canQueueForProcessing(record, 'billing'), false);
  }
});

test('visible Unclassified records never become eligible merely by being displayed', () => {
  assert.equal(canQueueForProcessing(unclassifiedScholar, 'payroll'), false);
  assert.equal(canQueueForProcessing({ ...unclassifiedScholar, processEligible: true }, 'payroll'), false);
});

test('valid Public payroll and Private certification eligibility is retained', () => {
  assert.equal(canQueueForProcessing(publicScholar, 'payroll'), true);
  assert.equal(canQueueForProcessing(privateScholar, 'billing'), true);
  assert.equal(canQueueForProcessing(privateScholar, 'payroll'), false);
});

test('archived, incomplete, and already-listed scholars cannot move into a new queue', () => {
  for (const overrides of [{ isArchivedPeriod: true }, { processEligible: false }, { inPayroll: true }, { processRoute: 'billing' }]) {
    assert.equal(canQueueForProcessing({ ...publicScholar, ...overrides }, 'payroll'), false);
  }
  assert.equal(canQueueForProcessing({ ...privateScholar, billed: true }, 'billing'), false);
});
