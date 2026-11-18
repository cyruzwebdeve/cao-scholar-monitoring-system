import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_BATCH_GRANT_ROWS, batchBillingAmount, batchBillingBlocker, batchBillingDraft,
  buildBatchBillingEntries, mergeBatchBillingDrafts, readBatchBillingResults,
} from '../src/utils/batchScholarBilling.js';

const record = (id = 7, extra = {}) => ({ applicantId: id, academicPeriodId: 9, status: 'Active', schoolType: 'Private', processRoute: 'billing', notYetIncluded: true, totalGrant: 5000, grantPrepared: false, billingEligibilityReasons: [{ code: 'GRANT_PREPARATION_REQUIRED', message: 'Prepare this grant.' }], ...extra });
const result = (id = 7) => ({ applicantId: id, success: true, grant: { grantPrepared: true, totalGrant: 6500.75, tuitionFeeAssistance: 5500.25, allowance: 1000.5, grantPreparedAt: '2026-11-18T01:00:00.000Z' } });

test('batch preparation allows missing grants and requirement warnings, but blocks actual period/account/route/list restrictions', () => {
  assert.equal(batchBillingBlocker(record(7, { processEligible: false, processingWarnings: [{ code: 'REQUIREMENT_MISSING' }] }), 9), '');
  for (const mutation of [
    { academicPeriodId: 8 }, { status: 'Inactive' }, { schoolType: 'Public' }, { processRoute: 'payroll' },
    { billed: true }, { inPayroll: true }, { notYetIncluded: false }, { totalGrant: NaN },
    { processingEligibility: { eligible: false, message: 'Pre-entry period.' } },
    { billingEligibilityReasons: [{ code: 'OTHER', message: 'Account unavailable.' }] },
  ]) assert.ok(batchBillingBlocker(record(7, mutation), 9), JSON.stringify(mutation));
});

test('each Scholar uses their configured total and exact cents, with explicit zero required', () => {
  for (const [input, allowance] of [['0', 5000], ['5000', 0], ['1234.56', 3765.44]]) {
    const amount = batchBillingAmount(record(), input); assert.equal(amount.valid, true); assert.equal(amount.allowance, allowance);
  }
  for (const input of ['', ' ', undefined, null, '-1', '5000.01', '1.001', 'NaN']) assert.equal(batchBillingAmount(record(), input).valid, false, String(input));
  assert.equal(batchBillingAmount(record(7, { totalGrant: 6500.75 }), '5500.25').allowance, 1000.5);
  assert.equal(batchBillingAmount(record(7, { totalGrant: Infinity }), '1').valid, false);
});

test('entry construction binds selected Scholars to original preparation timestamps and rejects invalid rows before a request', () => {
  const records = [record(), record(8, { totalGrant: 6500.75, grantPreparedAt: '2026-11-18T01:00:00.000Z' })];
  const drafts = { 7: { ...batchBillingDraft(records[0]), tuition: '0' }, 8: { ...batchBillingDraft(records[1]), tuition: '5500.25' } };
  assert.deepEqual(buildBatchBillingEntries(records, drafts, [7, 8, 7], 9), {
    entries: [{ applicantId: 7, tuitionFeeAssistance: 0, preparedAt: null }, { applicantId: 8, tuitionFeeAssistance: 5500.25, preparedAt: records[1].grantPreparedAt }], errors: {}, message: '',
  });
  drafts[8].tuition = '6500.76';
  const invalid = buildBatchBillingEntries(records, drafts, [7, 8], 9);
  assert.equal(invalid.entries.length, 1); assert.ok(invalid.errors[8]); assert.ok(invalid.message);
  assert.ok(buildBatchBillingEntries(records, drafts, [], 9).message);
  assert.ok(buildBatchBillingEntries(records, drafts, Array.from({ length: MAX_BATCH_GRANT_ROWS + 1 }, (_, index) => index + 1), 9).message);
});

test('refresh preserves changed/failed draft values and their original timestamps while refreshing untouched rows', () => {
  const previous = {
    7: { tuition: '1111', preparedAt: 'original', dirty: true, error: '' },
    8: { tuition: '2222', preparedAt: 'old', dirty: false, error: 'Review changed values.' },
    9: { tuition: 'old', preparedAt: 'old', dirty: false, error: '' },
  };
  const records = [record(), record(8), record(9, { tuitionFeeAssistance: 3000, grantPreparedAt: 'fresh' })];
  const merged = mergeBatchBillingDrafts(records, previous);
  assert.deepEqual(merged[7], previous[7]); assert.deepEqual(merged[8], previous[8]);
  assert.deepEqual(merged[9], { tuition: '3000', preparedAt: 'fresh', dirty: false, error: '' });
  assert.equal(previous[9].tuition, 'old');
});

test('only consistent authoritative success results count as saved; failures, missing and duplicate responses stay unconfirmed', () => {
  const good = result();
  assert.deepEqual(readBatchBillingResults({ results: [good, { applicantId: 8, success: false, message: 'Locked.', statusCode: 409 }] }, [7, 8]), [good, { applicantId: 8, success: false, message: 'Locked.', statusCode: 409 }]);
  for (const body of [null, {}, { results: [] }, { results: [good, good] }, { results: [result(8)] },
    { results: [{ ...good, grant: { ...good.grant, allowance: 1000 } }] },
    { results: [{ ...good, grant: { ...good.grant, grantPreparedAt: 'invalid' } }] },
    { results: [{ ...good, grant: { ...good.grant, totalGrant: undefined } }] },
    { results: [{ ...good, grant: { ...good.grant, tuitionFeeAssistance: '5500.25' } }] },
    { results: [{ ...good, grant: { ...good.grant, allowance: null } }] }]) {
    assert.equal(readBatchBillingResults(body, [7])[0].success, false);
  }
});
