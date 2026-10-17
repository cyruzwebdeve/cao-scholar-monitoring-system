const prisma = require('../config/prisma');
const { fail, positiveId, isPayrollBatch, scheduleInput, scheduleMessage } = require('../services/payoutSchedulePolicy');
const serialize = (row, admin = false) => ({
  id: row.id, batchId: row.payroll_batch_id, title: row.title, startsAt: row.starts_at, endsAt: row.ends_at,
  venue: row.venue, instructions: row.instructions, status: row.status, cancellationReason: row.cancellation_reason,
  revision: row.revision, updatedAt: row.updated_at,
  ...(admin ? { applicantIds: row.recipients.map(r => r.applicant_id) } : {}),
});
const handle = operation => async (req, res) => {
  try { return await operation(req, res); } catch (error) {
    if (error.code === 'P2034' || error.code === 'P2002') return res.status(409).json({ message: 'This schedule or its recipients changed. Reload schedules; a Scholar may already have a published schedule in this batch.' });
    if (!error.status) console.error('Payout schedule operation failed:', error.code || error.name);
    return res.status(error.status || 500).json({ message: error.status ? error.message : 'Unable to load or save payout schedules. Please retry.' });
  }
};
async function batchAndRoster(client, id) {
  const batch = await client.payroll_batches.findUnique({ where: { id } });
  if (!isPayrollBatch(batch)) fail('Select a saved Payroll batch.', 404);
  const claims = await client.payroll_claims.findMany({ where: { payroll_batch_id: id } });
  const ids = claims.map(row => row.applicant_id);
  const [applicants, requirements, schools] = await Promise.all([
    client.applicants.findMany({ where: { id: { in: ids }, deleted_at: null } }),
    client.scholar_requirements.findMany({ where: { applicant_id: { in: ids }, billing_period_id: batch.billing_period_id } }),
    client.schools.findMany({ select: { id: true, name: true } }),
  ]);
  const schoolNames = new Map(schools.map(row => [row.id, row.name]));
  const periodSchools = new Map(requirements.map(row => [row.applicant_id, row.school_id]));
  return { batch, scholars: applicants.map(row => ({ applicantId: row.id, name: [row.first_name, row.middle_name, row.last_name, row.name_ext].filter(Boolean).join(' '), municipality: row.municipality || '', school: schoolNames.get(periodSchools.get(row.id) || row.school_id) || '' })) };
}
const management = handle(async (req, res) => {
  const [batches, periods, schedules] = await Promise.all([
    prisma.payroll_batches.findMany({ orderBy: { prepared_at: 'desc' } }),
    prisma.academic_periods.findMany({ select: { id: true, school_year: true, semester: true } }),
    prisma.payout_schedules.findMany({ include: { recipients: true }, orderBy: { starts_at: 'desc' } }),
  ]);
  const periodById = new Map(periods.map(row => [row.id, row]));
  return res.json({ batches: batches.filter(isPayrollBatch).map(row => ({ id: row.id, reference: row.batch_number, scholarCount: row.total_scholars, schoolYear: periodById.get(row.billing_period_id)?.school_year || 'Legacy period', semester: periodById.get(row.billing_period_id)?.semester || '' })), schedules: schedules.map(row => serialize(row, true)) });
});
const roster = handle(async (req, res) => { const { batch, scholars } = await batchAndRoster(prisma, positiveId(req.params.id)); return res.json({ batch: { id: batch.id, reference: batch.batch_number }, scholars }); });
const mine = handle(async (req, res) => {
  const rows = await prisma.payout_schedules.findMany({ where: { status: { in: ['published', 'cancelled'] }, recipients: { some: { applicant_id: req.user.id } } }, orderBy: { starts_at: 'desc' } });
  const batches = await prisma.payroll_batches.findMany({ where: { id: { in: [...new Set(rows.map(row => row.payroll_batch_id))] } } });
  const batchById = new Map(batches.map(row => [row.id, row]));
  const periods = await prisma.academic_periods.findMany({ where: { id: { in: [...new Set(batches.map(row => row.billing_period_id))] } } });
  const periodById = new Map(periods.map(row => [row.id, row]));
  return res.json({ schedules: rows.map(row => { const batch = batchById.get(row.payroll_batch_id), period = periodById.get(batch?.billing_period_id); return { ...serialize(row), reference: batch?.batch_number, schoolYear: period?.school_year, semester: period?.semester }; }) });
});
const save = handle(async (req, res) => {
  const id = req.params.id ? positiveId(req.params.id) : null;
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) fail('Enter valid schedule details.');
  if (!['draft', 'publish', 'cancel'].includes(req.body.action)) fail('Choose a valid schedule action.');
  const result = await prisma.$transaction(async tx => {
    const existing = id ? await tx.payout_schedules.findUnique({ where: { id }, include: { recipients: true } }) : null;
    if (id && !existing) fail('Schedule not found.', 404);
    if (existing && (!Number.isSafeInteger(req.body.revision) || existing.revision !== req.body.revision)) fail('This schedule changed. Reload before saving.', 409);
    if (existing?.status === 'cancelled') fail('A cancelled schedule cannot be changed.', 409);
    let row, batch, ids, event;
    if (req.body.action === 'cancel') {
      if (!existing || existing.status !== 'published') fail('Only a published schedule can be cancelled.');
      const cancellationReason = req.body.cancellationReason ?? '';
      if (typeof cancellationReason !== 'string' || cancellationReason.trim().length > 1000) fail('Enter a cancellation note within 1000 characters.');
      ids = existing.recipients.map(r => r.applicant_id);
      batch = await tx.payroll_batches.findUnique({ where: { id: existing.payroll_batch_id } });
      row = await tx.payout_schedules.update({ where: { id }, data: { status: 'cancelled', cancellation_reason: cancellationReason.trim(), revision: { increment: 1 }, updated_by: req.user.id } });
      await tx.payout_schedule_recipients.updateMany({ where: { schedule_id: id }, data: { active: false } });
      event = 'cancelled';
    } else {
      const publishing = req.body.action === 'publish';
      if (existing?.status === 'published' && !publishing) fail('A published schedule cannot return to draft.');
      const input = scheduleInput(req.body, { publishing }); ids = input.ids;
      if (existing?.status === 'published' && (existing.payroll_batch_id !== input.batchId || existing.recipients.length !== ids.length || existing.recipients.some(r => !ids.includes(r.applicant_id)))) fail('Published recipients are fixed. Cancel this schedule to select a different group.', 409);
      const roster = await batchAndRoster(tx, input.batchId); batch = roster.batch;
      const listed = new Set(roster.scholars.map(r => r.applicantId));
      if (ids.some(value => !listed.has(value))) fail('Every recipient must belong to the selected Payroll batch.');
      const data = { ...input.data, payroll_batch_id: batch.id, status: publishing ? 'published' : 'draft', updated_by: req.user.id };
      row = existing ? await tx.payout_schedules.update({ where: { id }, data: { ...data, revision: { increment: 1 } } }) : await tx.payout_schedules.create({ data: { ...data, created_by: req.user.id } });
      await tx.payout_schedule_recipients.deleteMany({ where: { schedule_id: row.id } });
      await tx.payout_schedule_recipients.createMany({ data: ids.map(applicant_id => ({ schedule_id: row.id, payroll_batch_id: batch.id, applicant_id, active: publishing })) });
      if (publishing) event = existing?.status === 'published' ? 'rescheduled' : 'published';
    }
    if (event) await tx.scholar_notifications.createMany({ data: ids.map(applicant_id => ({ applicant_id, academic_period_id: batch.billing_period_id, notification_type: 'payout_schedule', title: event === 'cancelled' ? 'Payout schedule cancelled' : event === 'rescheduled' ? 'Payout schedule updated' : 'New payout schedule', message: scheduleMessage(row, batch.batch_number, event), reference: batch.batch_number })) });
    return { ...row, recipients: ids.map(applicant_id => ({ applicant_id })) };
  }, { isolationLevel: 'Serializable' });
  res.locals.auditTargetId = result.id;
  return res.status(id ? 200 : 201).json({ schedule: serialize(result, true), message: result.status === 'draft' ? 'Schedule draft saved. Scholars have not been notified.' : result.status === 'cancelled' ? 'Schedule cancelled. Selected Scholars have been notified.' : 'Schedule published. Selected Scholars have been notified.' });
});
module.exports = { management, roster, mine, save };
