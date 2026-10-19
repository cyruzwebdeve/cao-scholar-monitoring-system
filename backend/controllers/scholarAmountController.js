const prisma = require('../config/prisma');
const { validateGrantAmount, resolveBillingAmount } = require('../services/billingGrant');
const { lockGrantRecords, validateTuitionAssistance, error } = require('../services/grantPreparation');
const { loadResolvedScholarSchool, schoolClassification } = require('../services/scholarSchool');
const { resolveProcessingRoute } = require('../services/processingRoute');
const { loadContinuingSchedule } = require('../services/continuingSchedule');
const { findPrimaryActivePeriod } = require('../services/academicPeriod');
const { hasSectionAccess } = require('../services/sectionAccess');
const save = async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    const applicantId = Number(req.params.applicantId), periodId = Number(req.body.academicPeriodId);
    if (![applicantId, periodId].every(id => Number.isSafeInteger(id) && id > 0)) throw error('Select a Scholar and academic period.');
    const amount = validateGrantAmount(req.body.amount);
    const expected = validateGrantAmount(req.body.expectedAmount);
    const result = await prisma.$transaction(async tx => {
      await lockGrantRecords(tx, periodId, [applicantId]);
      const [period, scholar, applicant, application, requirement, primary] = await Promise.all([
        tx.academic_periods.findFirst({ where: { id: periodId, is_active: true } }),
        tx.scholar_accounts.findFirst({ where: { applicant_id: applicantId, is_active: true } }),
        tx.applicants.findUnique({ where: { id: applicantId } }),
        tx.application_submissions.findFirst({ where: { applicant_id: applicantId }, orderBy: { submitted_at: 'desc' } }),
        tx.scholar_requirements.findUnique({ where: { applicant_id_billing_period_id: { applicant_id: applicantId, billing_period_id: periodId } } }),
        findPrimaryActivePeriod(tx),
      ]);
      if (!period || !primary || !scholar || !applicant || applicant.deleted_at || !application) throw error('Select an active Scholar and active academic period.', 409);
      const school = await loadResolvedScholarSchool(tx, { applicantId, applicant, application, requirement });
      const schoolType = schoolClassification(school?.school_type);
      if (schoolType === 'Unclassified') throw error('Classify this school before editing the amount.', 409);
      const route = resolveProcessingRoute({ requirement, schoolType, docs: application.initial_docs, period, schedule: await loadContinuingSchedule(tx, periodId), applicantId, legacyPeriodId: primary.id });
      if (!hasSectionAccess(req.user, route)) throw error('Access Denied. This record belongs to the other processing section.', 403);
      if (await tx.payroll_claims.findFirst({ where: { applicant_id: applicantId, academic_period_id: periodId } })) throw error('The amount is locked because this Scholar is already included in a generated list.', 409);
      const previous = resolveBillingAmount(schoolType, requirement?.list_amount_override);
      if (expected !== previous) throw error('Another staff member changed this amount. Refresh before editing.', 409);
      if (schoolType === 'Private' && requirement?.grant_prepared_at) validateTuitionAssistance(Number(requirement.tuition_fee_assistance), amount);
      const timestamp = new Date(Math.max(Date.now(), +new Date(requirement?.grant_prepared_at || 0) + 1));
      const fields = { list_amount_override: amount, updated_by: req.user.id, ...(schoolType === 'Private' && requirement?.grant_prepared_at ? { grant_prepared_at: timestamp, grant_prepared_by: req.user.id } : schoolType === 'Public' && requirement?.grant_prepared_at ? { tuition_fee_assistance: null, grant_prepared_at: null, grant_prepared_by: null } : {}) };
      await tx.scholar_requirements.upsert({ where: { applicant_id_billing_period_id: { applicant_id: applicantId, billing_period_id: periodId } }, create: { applicant_id: applicantId, billing_period_id: periodId, ...fields }, update: fields });
      return { previous, grantPreparedAt: fields.grant_prepared_at || null, allowance: schoolType === 'Private' && requirement?.grant_prepared_at ? (Math.round(amount * 100) - Math.round(Number(requirement.tuition_fee_assistance) * 100)) / 100 : null };
    }, { isolationLevel: 'Serializable' });
    res.locals.auditTargetId = applicantId;
    res.locals.auditAction = 'SCHOLAR_LIST_AMOUNT_UPDATED';
    res.locals.auditDescription = `Updated the list amount for academic period ${periodId} from PHP ${result.previous} to PHP ${amount}.`;
    return res.json({ message: 'Scholar amount saved for this academic period.', amount, grantPreparedAt: result.grantPreparedAt, allowance: result.allowance });
  } catch (failure) {
    if (['P2002', 'P2034'].includes(failure.code)) return res.status(409).json({ message: 'The record or generated list changed. Refresh before retrying.' });
    if (!failure.statusCode) console.error('Scholar amount update failed:', failure.code || failure.name);
    return res.status(failure.statusCode || 500).json({ message: failure.statusCode ? failure.message : 'Unable to save the Scholar amount.' });
  }
};
module.exports = { save };
