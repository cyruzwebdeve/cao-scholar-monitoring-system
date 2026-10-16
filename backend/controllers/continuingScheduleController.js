const prisma = require('../config/prisma');
const { loadContinuingSchedule } = require('../services/continuingSchedule');
const positiveId = (value) => Number.isInteger(Number(value)) && Number(value) > 0;
const project = (schedule) => schedule ? { academic_period_id: schedule.academic_period_id, uploads_open: schedule.uploads_open !== false, revision: schedule.revision } : null;
const getContinuingSchedule = async (req, res) => {
  try {
    if (!positiveId(req.params.id)) return res.status(400).json({ message: 'Select an academic period.' });
    const period = await prisma.academic_periods.findUnique({ where: { id: Number(req.params.id) } });
    if (!period) return res.status(404).json({ message: 'Academic period not found.' });
    res.set('Cache-Control', 'no-store');
    return res.json({ schedule: project(await loadContinuingSchedule(prisma, period.id)) });
  } catch (error) { console.error('Continuing schedule read failed:', error.code); return res.status(500).json({ message: 'Unable to load the continuing submission schedule.' }); }
};
const saveContinuingSchedule = async (req, res) => {
  try {
    if (!positiveId(req.params.id)) return res.status(400).json({ message: 'Select an academic period.' });
    const periodId = Number(req.params.id);
    const body = req.body || {};
    if (typeof body.uploadsOpen !== 'boolean') return res.status(400).json({ message: 'Choose whether continuing uploads are open or closed.' });
    if (!Number.isInteger(body.revision) || body.revision < 0) return res.status(400).json({ message: 'Reload the schedule before publishing.' });
    const schedule = await prisma.$transaction(async (tx) => {
      const period = await tx.academic_periods.findUnique({ where: { id: periodId } });
      if (!period?.is_active) throw Object.assign(new Error('Select an active academic period.'), { statusCode: 400 });
      const data = { uploads_open: body.uploadsOpen, updated_by: req.user.id };
      if (body.revision === 0) return tx.continuing_requirement_schedules.create({ data: { academic_period_id: periodId, ...data } });
      const changed = await tx.continuing_requirement_schedules.updateMany({ where: { academic_period_id: periodId, revision: body.revision }, data: { ...data, revision: { increment: 1 } } });
      if (changed.count !== 1) throw Object.assign(new Error('The schedule changed. Reload before publishing again.'), { statusCode: 409 });
      return tx.continuing_requirement_schedules.findUnique({ where: { academic_period_id: periodId } });
    });
    res.locals.auditTargetId = periodId;
    res.locals.auditDescription = 'Updated period-wide continuing upload access; historical dates and submission records retained.';
    return res.json({ schedule: project(schedule), message: body.uploadsOpen ? 'Continuing uploads opened for this academic period.' : 'Continuing uploads closed for this academic period.' });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ message: 'The schedule changed. Reload before publishing again.' });
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    console.error('Continuing schedule save failed:', error.code);
    return res.status(500).json({ message: 'Unable to publish the continuing submission schedule.' });
  }
};
module.exports = { getContinuingSchedule, saveContinuingSchedule };
