const prisma = require('../config/prisma');
const { lockGrantRecords, error } = require('../services/grantPreparation');
const { loadResolvedScholarSchool, schoolClassification } = require('../services/scholarSchool');
const { hasSectionAccess } = require('../services/sectionAccess');
const sendToPayroll = async (req, res) => {
  try {
    if (!hasSectionAccess(req.user, 'payroll')) throw error('Payroll section access is required.', 403);
    const applicantId = Number(req.params.applicantId), periodId = Number(req.body?.academicPeriodId);
    if (![applicantId, periodId].every(id => Number.isSafeInteger(id) && id > 0)) throw error('Select a Scholar and academic period.');
    await prisma.$transaction(async tx => {
      await lockGrantRecords(tx, periodId, [applicantId]);
      const [period, scholar, applicant, application, requirement, membership, previousList] = await Promise.all([
        tx.academic_periods.findFirst({ where: { id: periodId, is_active: true } }),
        tx.scholar_accounts.findFirst({ where: { applicant_id: applicantId, is_active: true } }),
        tx.applicants.findUnique({ where: { id: applicantId } }),
        tx.application_submissions.findFirst({ where: { applicant_id: applicantId }, orderBy: { submitted_at: 'desc' } }),
        tx.scholar_requirements.findUnique({ where: { applicant_id_billing_period_id: { applicant_id: applicantId, billing_period_id: periodId } } }),
        tx.payroll_claims.findMany({ where: { applicant_id: applicantId } }),
        tx.payroll_batches.findMany({ where: { billing_period_id: periodId } }),
      ]);
      if (!period || !scholar || !applicant || applicant.deleted_at || !application) throw error('Select an active Scholar and active academic period.', 409);
      if (membership.some(claim => claim.academic_period_id === periodId || previousList.some(batch => batch.id === claim.payroll_batch_id))) throw error('This Scholar is already included in a Billing or Payroll list for this period.', 409);
      if (!previousList.some(batch => ['billed', 'generated'].includes(batch.status))) throw error('Generate the regular list for this period before preparing remaining Scholars for Payroll.', 409);
      const school = await loadResolvedScholarSchool(tx, { applicantId, applicant, application, requirement });
      if (!['Public', 'Private'].includes(schoolClassification(school?.school_type))) throw error('Correct the school classification first.', 409);
      if (requirement?.payroll_requested_at) return;
      const data = { payroll_requested_at: new Date(), payroll_requested_by: req.user.id, updated_by: req.user.id };
      await tx.scholar_requirements.upsert({ where: { applicant_id_billing_period_id: { applicant_id: applicantId, billing_period_id: periodId } }, create: { applicant_id: applicantId, billing_period_id: periodId, ...data }, update: data });
    }, { isolationLevel: 'Serializable' });
    res.locals.auditTargetId = applicantId;
    res.locals.auditDescription = `Selected Payroll processing for an unlisted Scholar in academic period ${periodId}; no list generated.`;
    return res.json({ message: 'Scholar sent to Payroll for this academic period. Prepare any required Private grant, then include the Scholar in a normal payroll list.' });
  } catch (failure) {
    if (['P2002', 'P2034'].includes(failure.code)) return res.status(409).json({ message: 'The record changed. Refresh before retrying.' });
    if (!failure.statusCode) console.error('Payroll preparation failed:', failure.code || failure.name);
    return res.status(failure.statusCode || 500).json({ message: failure.statusCode ? failure.message : 'Unable to prepare Payroll routing.' });
  }
};
module.exports = { sendToPayroll };
