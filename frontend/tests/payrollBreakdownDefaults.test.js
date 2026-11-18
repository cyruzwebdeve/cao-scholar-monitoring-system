import assert from 'node:assert/strict';
import test from 'node:test';
import { payrollTemplateColumns } from '../src/utils/payrollWorkbook.js';

const column = key => payrollTemplateColumns.find(item => item.key === key);

test('missing allocation values default to numeric zero without changing the recorded grant Amount', () => {
  for (const value of [undefined, null, '']) {
    const record = Object.freeze({ claimAmount: 3000, tuitionFeeAssistance: value, allowance: value });
    assert.equal(column('tuitionFeeAssistance').value(record), 0);
    assert.equal(column('allowance').value(record), 0);
    assert.equal(column('totalGrant').value(record), 3000);
    assert.equal(record.tuitionFeeAssistance, value);
    assert.equal(record.allowance, value);
  }
});

test('saved zero and nonzero breakdowns retain their numeric values', () => {
  for (const value of [0, 1500.25, '1500.25']) {
    const record = { claimAmount: 6500.75, tuitionFeeAssistance: value, allowance: value };
    assert.equal(column('tuitionFeeAssistance').value(record), Number(value));
    assert.equal(column('allowance').value(record), Number(value));
    assert.equal(column('totalGrant').value(record), 6500.75);
  }
});

test('invalid saved allocations retain existing blank-value handling rather than becoming valid zero amounts', () => {
  for (const value of ['invalid', NaN, Infinity]) {
    assert.equal(column('tuitionFeeAssistance').value({ tuitionFeeAssistance: value }), null);
    assert.equal(column('allowance').value({ allowance: value }), null);
  }
  assert.equal(column('tuitionFeeAssistance').currency, true);
  assert.equal(column('allowance').currency, true);
});
