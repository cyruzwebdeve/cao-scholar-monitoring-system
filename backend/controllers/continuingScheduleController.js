const prisma = require('../config/prisma');
const { loadContinuingSchedule } = require('../services/continuingSchedule');
const positiveId = (value) => Number.isInteger(Number(value)) && Number(value) > 0;
const timestamp = (value) => typeof value === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value)) ? new Date(value) : null;
const getContinuingSchedule = async (req, res) => {
  try {
    if (!positiveId(req.params.id)) return res.status(400).json({ message: 'Select an academic period.' });
    const period = await prisma.academic_periods.findUnique({ where: { id: Number(req.params.id) } });
    if (!period) return res.status(404).json({ message: 'Academic period not found.' });
    res.set('Cache-Control', 'no-store');
    return res.json({ schedule: await loadContinuingSchedule(prisma, period.id) });
  } catch (error) { console.error('Continuing schedule read failed:', error.code); return res.status(500).json({ message: 'Unable to load the continuing submission schedule.' }); }
};
const saveContinuingSchedule = async (req, res) => {
  try {
    if (!positiveId(req.params.id)) return res.status(400).json({ message: 'Select an academic period.' });
    const periodId = Number(req.params.id);
    const body = req.body || {};
    const opens = timestamp(body.opensAt), closes = timestamp(body.closesAt);
    const lateOpens = body.lateOpensAt ? timestamp(body.lateOpensAt) : null;
    const lateCloses = body.lateClosesAt ? timestamp(body.lateClosesAt) : null;
    if (!opens || !closes || opens >= closes) return res.status(400).json({ message: 'Opening time must be before the regular deadline. Include a timezone.' });
    if (Boolean(body.lateOpensAt) !== Boolean(body.lateClosesAt) || (body.lateOpensAt && (!lateOpens || !lateCloses || lateOpens <= closes || lateOpens >= lateCloses))) return res.status(400).json({ message: 'The late window must begin after the regular deadline and end after its opening time.' });
    const scope = body.lateScope || 'all';
    const ids = body.lateApplicantIds || [];
    if (!['all', 'selected'].includes(scope) || !Array.isArray(ids) || ids.length > 500 || ids.some((id) => !Number.isInteger(id) || id <= 0) || (lateOpens && scope === 'selected' && !ids.length)) return res.status(400).json({ message: 'Choose all scholars or up to 500 selected scholars for the late window.' });
    if (!Number.isInteger(body.revision) || body.revision < 0) return res.status(400).json({ message: 'Reload the schedule before publishing.' });
    const schedule = await prisma.$transaction(async (tx) => {
      const period = await tx.academic_periods.findUnique({ where: { id: periodId } });
      if (!period?.is_active) throw Object.assign(new Error('Select an active academic period.'), { statusCode: 400 });
      if (lateOpens && scope === 'selected') {
        const count = await tx.scholar_accounts.count({ where: { applicant_id: { in: [...new Set(ids)] }, is_active: true } });
        if (count !== new Set(ids).size) throw Object.assign(new Error('Select active scholars only.'), { statusCode: 400 });
      }
      const data = { opens_at: opens, closes_at: closes, late_opens_at: lateOpens, late_closes_at: lateCloses, late_scope: scope, late_applicant_ids: scope === 'selected' ? [...new Set(ids)] : [], updated_by: req.user.id };
      if (body.revision === 0) return tx.continuing_requirement_schedules.create({ data: { academic_period_id: periodId, ...data } });
      const changed = await tx.continuing_requirement_schedules.updateMany({ where: { academic_period_id: periodId, revision: body.revision }, data: { ...data, revision: { increment: 1 } } });
      if (changed.count !== 1) throw Object.assign(new Error('The schedule changed. Reload before publishing again.'), { statusCode: 409 });
      return tx.continuing_requirement_schedules.findUnique({ where: { academic_period_id: periodId } });
    });
    res.locals.auditTargetId = periodId;
    res.locals.auditDescription = 'Published continuing submission schedule; regular deadline retained separately from late window.';
    return res.json({ schedule, message: 'Continuing submission schedule published.' });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ message: 'The schedule changed. Reload before publishing again.' });
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    console.error('Continuing schedule save failed:', error.code);
    return res.status(500).json({ message: 'Unable to publish the continuing submission schedule.' });
  }
};
module.exports = { getContinuingSchedule, saveContinuingSchedule };
