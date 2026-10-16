import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesPayrollListStatus } from '../src/utils/payrollListStatus.js';

test('Payroll filters select list inclusion independently of legacy payment flags', () => {
  const records = [{ id: 1, inPayroll: true, paid: false }, { id: 2, inPayroll: false, paid: true }, { id: 3 }];
  assert.deepEqual(records.filter((record) => matchesPayrollListStatus(record, 'Included in payroll list')).map(({ id }) => id), [1]);
  assert.deepEqual(records.filter((record) => matchesPayrollListStatus(record, 'Not included yet')).map(({ id }) => id), [2, 3]);
  assert.equal(records.filter((record) => matchesPayrollListStatus(record, 'All Payroll Statuses')).length, 3);
  assert.equal(matchesPayrollListStatus(records[0], 'Paid'), false);
});

test('Not included yet excludes either current-period list membership and retains unlisted Private candidates', () => {
  const records = [
    { id: 1, billed: true, inPayroll: false, notYetIncluded: false },
    { id: 2, billed: false, inPayroll: true, notYetIncluded: false },
    { id: 3, billed: false, inPayroll: false, notYetIncluded: true, processRoute: 'billing', schoolType: 'Private' },
    { id: 4, billed: false, inPayroll: false, notYetIncluded: true, processRoute: 'payroll', schoolType: 'Public' },
    { id: 5, billed: false, inPayroll: false, notYetIncluded: false },
  ];
  assert.deepEqual(records.filter(record => matchesPayrollListStatus(record, 'Not included yet')).map(record => record.id), [3, 4]);
  assert.equal(records.filter(record => matchesPayrollListStatus(record, 'All Payroll Statuses')).length, 5);
  assert.deepEqual(records.filter(record => matchesPayrollListStatus(record, 'Included in payroll list')).map(record => record.id), [2]);
});
