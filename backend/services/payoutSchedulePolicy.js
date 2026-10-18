const PAYOUT_CLAIM_NOTICE = 'Scholars have one week (7 days) only to claim their payout. Follow the claiming dates and instructions announced by CAO.';
const fail = (message, status = 400) => { const error = new Error(message); error.status = status; throw error; };
const positiveId = value => (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) && Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : fail('A valid record is required.');
const isPayrollBatch = batch => batch && batch.total_scholars > 0 && String(batch.status).toLowerCase() !== 'draft' && !String(batch.batch_number).startsWith('BILL-') && String(batch.status).toLowerCase() !== 'billed';
function scheduleInput(body, { publishing = false, now = new Date() } = {}) {
  const text = (key, max, required = false) => {
    if (body[key] != null && typeof body[key] !== 'string') fail(`Invalid ${key}.`);
    const value = (body[key] || '').trim();
    if ((required && !value) || value.length > max) fail(`Enter ${key} within ${max} characters.`);
    return value;
  };
  const date = (value, optional = false) => {
    if (optional && !value) return null;
    if (typeof value !== 'string' || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) || Number.isNaN(new Date(value).getTime())) fail('Enter a valid date and time with a timezone.');
    return new Date(value);
  };
  const starts_at = date(body.startsAt), ends_at = date(body.endsAt, true);
  if (ends_at && ends_at <= starts_at) fail('End time must follow the start time.');
  if (publishing && starts_at <= now) fail('Choose a future start time before publishing.');
  if (!Array.isArray(body.applicantIds) || !body.applicantIds.length || body.applicantIds.length > 10000) fail('Select at least one listed Scholar.');
  const ids = body.applicantIds.map(positiveId);
  if (new Set(ids).size !== ids.length) fail('Remove duplicate recipients.');
  return { batchId: positiveId(body.batchId), ids, data: { title: text('title', 160, true), venue: text('venue', 250, true), instructions: text('instructions', 3000), starts_at, ends_at } };
}
function scheduleMessage(row, reference, event) {
  const time = new Date(row.starts_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
  const end = row.ends_at ? ` – ${new Date(row.ends_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' })}` : '';
  return event === 'cancelled'
    ? `${row.title} (${reference}) has been cancelled.${row.cancellation_reason ? ` ${row.cancellation_reason}` : ''}`
    : `${event === 'rescheduled' ? 'Updated schedule' : 'Payout schedule'}: ${row.title}. ${time}${end} (Philippine time). Venue: ${row.venue}. ${row.instructions || ''} ${PAYOUT_CLAIM_NOTICE}`.trim();
}
module.exports = { PAYOUT_CLAIM_NOTICE, fail, positiveId, isPayrollBatch, scheduleInput, scheduleMessage };
