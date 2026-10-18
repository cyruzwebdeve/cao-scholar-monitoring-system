const assert = require('node:assert/strict');
const test = require('node:test');
const { positiveId, isPayrollBatch, scheduleInput, scheduleMessage } = require('../services/payoutSchedulePolicy');
const input = extra => ({ batchId: 1, title: 'Synthetic schedule', venue: 'Designated school', startsAt: '2030-01-01T09:00:00+08:00', endsAt: '2030-01-01T10:00:00+08:00', instructions: 'Bring identification.', applicantIds: [7, 8], ...extra });
test('schedule validation requires a proper interval, explicit timezone and unique listed IDs', () => {
 const result = scheduleInput(input(), { publishing: true });
 assert.equal(result.data.starts_at.toISOString(), '2030-01-01T01:00:00.000Z');
 assert.deepEqual(result.ids, [7, 8]);
 for (const extra of [{ applicantIds: [] }, { applicantIds: [7,7] }, { applicantIds: [true] }, { batchId: [] }, { title: '' }, { venue: '' }, { instructions: 'x'.repeat(3001) }, { startsAt: '2030-01-01T09:00' }, { endsAt: '2029-01-01T09:00:00Z' }]) assert.throws(() => scheduleInput(input(extra)));
 assert.throws(() => scheduleInput(input({ startsAt: '2020-01-01T09:00:00Z', endsAt: '' }), { publishing: true }), /future/);
 assert.equal(positiveId('10'), 10);
 for (const value of [null, true, '', -1, '1.5', 0]) assert.throws(() => positiveId(value));
});
test('Billing and unfinished batches cannot be schedule sources', () => {
 assert.equal(!!isPayrollBatch({ batch_number: 'BILL-0001', status: 'generated', total_scholars: 1 }), false);
 assert.equal(!!isPayrollBatch({ batch_number: 'PAY-0001', status: 'draft', total_scholars: 1 }), false);
 assert.equal(!!isPayrollBatch({ batch_number: 'PAY-0001', status: 'generated', total_scholars: 0 }), false);
 assert.equal(!!isPayrollBatch({ batch_number: 'PAYROLL-LEGACY', status: 'generated', total_scholars: 2 }), true);
});
test('targeted notices show Philippine time and venue and describe informational changes', () => {
 const row = { title: 'Synthetic schedule', starts_at: new Date('2030-01-01T01:00:00Z'), venue: 'SCHOOL A', instructions: '', cancellation_reason: 'Venue unavailable.' };
 assert.match(scheduleMessage(row, 'PAY-0001', 'published'), /9:00.*Philippine time.*SCHOOL A/);
 assert.match(scheduleMessage(row, 'PAY-0001', 'rescheduled'), /Updated schedule/);
 assert.match(scheduleMessage(row, 'PAY-0001', 'cancelled'), /cancelled.*Venue unavailable/);
});


test('publication and reschedule notices include the one-week reminder without changing dates or cancelled notices', () => {
 const row = { title: 'Synthetic schedule', starts_at: new Date('2030-01-01T01:00:00Z'), ends_at: new Date('2030-01-01T02:00:00Z'), venue: 'Test venue', instructions: '' };
 const before = JSON.stringify(row);
 for (const event of ['published', 'rescheduled']) assert.match(scheduleMessage(row, 'TEST', event), /one week \(7 days\) only to claim their payout/);
 assert.doesNotMatch(scheduleMessage(row, 'TEST', 'cancelled'), /one week|claim their payout/);
 assert.equal(JSON.stringify(row), before);
});
