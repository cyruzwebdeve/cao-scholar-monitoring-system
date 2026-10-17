import assert from 'node:assert/strict';
import test from 'node:test';
import { certificationListGroups } from '../src/utils/certificationListGroups.js';
const records = [
  { applicantId: 1, name: 'SYNTHETIC ONE', school: 'SCHOOL A' },
  { applicantId: 2, name: 'SYNTHETIC TWO', school: 'SCHOOL B' },
  { applicantId: 3, name: 'SYNTHETIC THREE', school: 'SCHOOL B' },
  { applicantId: 4, name: 'SYNTHETIC FOUR', school: 'SCHOOL C' },
];
test('four Payroll scholars from different schools stay in one complete batch in original order', () => {
  const groups = certificationListGroups(records, 'payroll');
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].scholars.map(record => record.applicantId), [1, 2, 3, 4]);
  assert.deepEqual(records.map(record => record.applicantId), [1, 2, 3, 4]);
});
test('Billing keeps its school-specific letters and original order within each school', () => {
  const groups = certificationListGroups(records, 'billing');
  assert.deepEqual(groups.map(group => group.school), ['SCHOOL A', 'SCHOOL B', 'SCHOOL C']);
  assert.deepEqual(groups.map(group => group.scholars.map(record => record.applicantId)), [[1], [2, 3], [4]]);
});
test('Payroll names-only batch can download without school metadata; Billing still requires a school', () => {
  assert.equal(certificationListGroups([{ name: 'SYNTHETIC' }], 'payroll')[0].scholars.length, 1);
  assert.throws(() => certificationListGroups([{ name: 'SYNTHETIC' }], 'billing'), /no school/);
  assert.throws(() => certificationListGroups(records, 'other'), /Invalid list type/);
  assert.throws(() => certificationListGroups([], 'payroll'), /scholar list is required/);
});
