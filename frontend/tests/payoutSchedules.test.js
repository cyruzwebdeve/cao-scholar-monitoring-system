import assert from 'node:assert/strict';
import test from 'node:test';
import { scheduleIso, scheduleLocalInput, scheduleTime, filterScheduleScholars } from '../src/utils/payoutSchedules.js';
test('schedule inputs always use Philippine time independent of browser timezone', () => {
  assert.equal(scheduleIso('2026-11-01T09:30'), '2026-11-01T01:30:00.000Z');
  assert.equal(scheduleLocalInput('2026-11-01T01:30:00.000Z'), '2026-11-01T09:30');
  assert.match(scheduleTime('2026-11-01T01:30:00Z'), /9:30/);
  assert.equal(scheduleIso(''), null);
});
test('municipality/school/search filters select batch recipients independently of venue', () => {
  const rows = [{ applicantId: 1, name: 'SYNTHETIC A', municipality: 'Capalonga', school: 'SCHOOL A' }, { applicantId: 2, name: 'SYNTHETIC B', municipality: 'Sta. Elena', school: 'SCHOOL B' }];
  assert.deepEqual(filterScheduleScholars(rows, 'Capalonga', '', '').map(row => row.applicantId), [1]);
  assert.deepEqual(filterScheduleScholars(rows, '', 'SCHOOL B', 'synthetic b').map(row => row.applicantId), [2]);
  assert.equal(filterScheduleScholars(rows, 'Capalonga', 'SCHOOL B', '').length, 0);
});
