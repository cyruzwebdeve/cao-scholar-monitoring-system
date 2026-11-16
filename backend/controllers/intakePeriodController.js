const prisma = require('../config/prisma');
const { readIntakeSettings, serializeIntakePeriod } = require('../services/intakePeriod');

const failure = (message, statusCode = 409) => Object.assign(new Error(message), { statusCode });

const assertNoRunningAttempts = async (client, schoolYear, now) => {
  const exams = await client.exams.findMany({ where: { academic_year: schoolYear }, select: { id: true } });
  if (!exams.length) return;
  const slots = await client.exam_slots.findMany({
    where: { exam_id: { in: exams.map(exam => exam.id) }, online_started_at: { not: null },
      online_deadline_at: { gt: now }, forfeited_at: null },
    select: { applicant_id: true, exam_id: true },
  });
  if (!slots.length) return;
  const results = await client.results.findMany({
    where: { OR: slots.map(slot => ({ applicant_id: slot.applicant_id, exam_id: slot.exam_id })) },
    select: { applicant_id: true, exam_id: true },
  });
  const completed = new Set(results.map(result => `${result.applicant_id}:${result.exam_id}`));
  if (slots.some(slot => !completed.has(`${slot.applicant_id}:${slot.exam_id}`))) {
    throw failure('An online examination is still in progress for the current intake. Wait for it to finish or expire before changing the intake school year.');
  }
};

const createIntakePeriodController = ({ client = prisma, now = () => new Date() } = {}) => {
  const getIntakePeriod = async (req, res) => {
    try {
      res.set('Cache-Control', 'no-store');
      const settings = await readIntakeSettings(client);
      const period = settings?.academic_period_id
        ? await client.academic_periods.findUnique({ where: { id: settings.academic_period_id } }) : null;
      return res.json({ intakePeriod: serializeIntakePeriod(period), revision: settings?.revision || 0 });
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
      console.error('Intake period read failed:', error.code);
      return res.status(500).json({ message: 'Unable to load the application and examination intake.' });
    }
  };

  const updateIntakePeriod = async (req, res) => {
    try {
      const academicPeriodId = Number(req.body?.academicPeriodId);
      const revision = req.body?.revision;
      if (!Number.isSafeInteger(academicPeriodId) || academicPeriodId <= 0
        || !Number.isSafeInteger(revision) || revision < 0) {
        return res.status(400).json({ message: 'Choose an intake period and reload its current revision before saving.' });
      }
      const result = await client.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM intake_settings WHERE id = 1 FOR UPDATE`;
        const settings = await readIntakeSettings(tx);
        if ((settings?.revision || 0) !== revision) throw failure('The intake selection changed. Reload Settings before saving.');
        const period = await tx.academic_periods.findUnique({ where: { id: academicPeriodId } });
        if (!period) throw failure('That academic period is not configured.', 404);
        if (settings?.academic_period_id === period.id) return { period, settings, changed: false };
        const previous = settings?.academic_period_id
          ? await tx.academic_periods.findUnique({ where: { id: settings.academic_period_id } }) : null;
        const schoolYearChanged = previous && previous.school_year !== period.school_year;
        const changedAt = now();
        if (schoolYearChanged) await assertNoRunningAttempts(tx, previous.school_year, changedAt);
        const data = { academic_period_id: period.id, updated_by: req.user.id, updated_at: changedAt };
        let updated;
        if (settings) {
          const changed = await tx.intake_settings.updateMany({
            where: { id: 1, revision }, data: { ...data, revision: { increment: 1 } },
          });
          if (changed.count !== 1) throw failure('The intake selection changed. Reload Settings before saving.');
          updated = await readIntakeSettings(tx);
        } else {
          updated = await tx.intake_settings.create({ data: { id: 1, ...data, revision: 1 } });
        }
        if (schoolYearChanged) {
          await tx.exams.updateMany({
            where: { academic_year: previous.school_year, is_active: true },
            data: { is_active: false, updated_at: changedAt },
          });
        }
        return { period, settings: updated, changed: true };
      }, { maxWait: 10_000, timeout: 30_000 });
      res.set('Cache-Control', 'no-store, private');
      res.locals.auditTargetId = 1;
      res.locals.auditDescription = result.changed
        ? `Selected ${result.period.school_year} ${result.period.semester} for application and examination intake; Scholar processing periods retained.`
        : 'Retained the existing application and examination intake.';
      return res.json({
        intakePeriod: serializeIntakePeriod(result.period), revision: result.settings.revision,
        message: result.changed ? 'Application and examination intake updated. Previous intake records remain available in history.' : 'This is already the selected application and examination intake.',
      });
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
      if (error.code === 'P2010' && error.meta?.code === '42P01') {
        return res.status(503).json({ message: 'Application and examination intake is unavailable. Please try again later or contact CAO.' });
      }
      if (['P2002', 'P2034'].includes(error.code)) return res.status(409).json({ message: 'The intake changed during saving. Reload Settings and try again.' });
      console.error('Intake period update failed:', error.code);
      return res.status(500).json({ message: 'Unable to update the application and examination intake.' });
    }
  };
  return { getIntakePeriod, updateIntakePeriod };
};

module.exports = { createIntakePeriodController, ...createIntakePeriodController() };
