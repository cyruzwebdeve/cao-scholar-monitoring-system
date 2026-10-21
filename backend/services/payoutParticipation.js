const { fail } = require('./payoutSchedulePolicy');
const ATTENDANCE = ['not_marked', 'present', 'absent'];
const expectedVersion = (value) => {
  if (!Number.isSafeInteger(value) || value < 0)
    fail('Reload this record before saving.');
  return value;
};
const manilaDate = (value) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
function receiptInput(body, schedule, now = new Date()) {
  expectedVersion(body.expectedVersion);
  if (!Number.isSafeInteger(body.scheduleRevision) || body.scheduleRevision < 1)
    fail('Reload the schedule before confirming.');
  if (!['received', 'withdraw'].includes(body.action))
    fail('Choose a valid receipt action.');
  if (body.action === 'withdraw')
    return { is_received: false, received_on: null, confirmed_at: null };
  if (body.confirmed !== true)
    fail('Confirm that you personally received this payout.');
  const date = body.receivedOn;
  const parsed =
    typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? new Date(`${date}T00:00:00Z`)
      : null;
  if (
    !parsed ||
    !Number.isFinite(+parsed) ||
    parsed.toISOString().slice(0, 10) !== date ||
    date < manilaDate(schedule.starts_at) ||
    date > manilaDate(now)
  )
    fail('Use an actual receipt date from the schedule date through today.');
  return { is_received: true, received_on: parsed, confirmed_at: now };
}
const attendanceView = (row) => ({
  status: row?.attendance || 'not_marked',
  version: row?.version || 0,
  updatedAt: row?.updated_at || null,
  scheduleStart: row?.session_starts_at || null,
});
const receiptView = (row) => ({
  status: row?.is_received ? 'received' : 'not_confirmed',
  version: row?.version || 0,
  receivedOn: row?.received_on?.toISOString().slice(0, 10) || null,
  confirmedAt: row?.confirmed_at || null,
  updatedAt: row?.updated_at || null,
});
module.exports = {
  ATTENDANCE,
  expectedVersion,
  manilaDate,
  receiptInput,
  attendanceView,
  receiptView,
};
