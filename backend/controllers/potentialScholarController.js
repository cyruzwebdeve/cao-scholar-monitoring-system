const prisma = require('../config/prisma');
const { findPrimaryActivePeriod } = require('../services/academicPeriod');
const { loadSchoolHistory } = require('../services/scholarSchool');
const { buildPotentialScholars } = require('../services/potentialScholars');
const index = async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    const period = await findPrimaryActivePeriod(prisma);
    if (!period) return res.json({ period: null, applicants: [] });
    const stagedApplications = await prisma.application_submissions.findMany({ where: { initial_docs: { path: ['potentialScholarReviews', String(period.id), 'status'], equals: 'potential' } }, orderBy: [{ submitted_at: 'desc' }, { id: 'desc' }], select: { id: true, applicant_id: true, initial_docs: true } });
    const ids = [...new Set(stagedApplications.map(application => application.applicant_id).filter(Boolean))];
    if (!ids.length) return res.json({ period: { id: period.id, schoolYear: period.school_year, semester: period.semester }, applicants: [] });
    const members = await prisma.passer_list_members.findMany({ where: { applicant_id: { in: ids }, academic_period_id: period.id, list: { status: 'posted', revisions: { none: { status: 'posted' } } } }, select: { applicant_id: true, application_id: true, result_id: true, exam_id: true, snapshot: true } });
    const [applicants, applications, results, exams, slots, scholars, accounts, schools, schoolHistory] = await Promise.all([
      prisma.applicants.findMany({ where: { id: { in: ids }, deleted_at: null }, select: { id: true, first_name: true, middle_name: true, last_name: true, municipality: true, school_id: true, school_year: true, deleted_at: true } }),
      prisma.application_submissions.findMany({ where: { applicant_id: { in: ids } }, orderBy: [{ submitted_at: 'desc' }, { id: 'desc' }], select: { id: true, applicant_id: true, status: true, identity: true, address: true, family: true, eligibility: true, school_plan: true, initial_docs: true } }),
      prisma.results.findMany({ where: { id: { in: members.map(member => member.result_id) } }, select: { id: true, applicant_id: true, exam_id: true, exam_slot_id: true, score: true, passing_score: true, passed: true, published_at: true, updated_at: true } }),
      prisma.exams.findMany({ where: { academic_year: period.school_year }, orderBy: { updated_at: 'desc' }, select: { id: true, municipality: true, academic_year: true, updated_at: true } }),
      prisma.exam_slots.findMany({ where: { applicant_id: { in: ids } }, select: { id: true, applicant_id: true, exam_id: true } }),
      prisma.scholar_accounts.findMany({ where: { applicant_id: { in: ids }, is_active: true }, select: { applicant_id: true, is_active: true } }),
      prisma.control_accounts.findMany({ where: { applicant_id: { in: ids } }, select: { applicant_id: true, control_number: true } }),
      prisma.schools.findMany({ select: { id: true, name: true, school_type: true } }),
      loadSchoolHistory(prisma, ids),
    ]);
    return res.json({ period: { id: period.id, schoolYear: period.school_year, semester: period.semester }, applicants: buildPotentialScholars({ period, members, applicants, applications, results, exams, slots, scholars, accounts, schools, schoolHistory, stagedApplications }) });
  } catch (error) {
    console.error('Potential scholar queue unavailable:', error.code || error.name);
    return res.status(500).json({ message: 'Unable to load applicants with complete requirements. Please retry.' });
  }
};

const { loadScholarReview, acceptReviewedScholar } = require('../services/scholarAcceptance');
const { reviewFingerprint, reviewMarker, makePotentialReview, validReview } = require('../services/potentialReview');
const { AttemptError } = require('../services/onlineExamAttempt');
const { sendScholarApprovedEmail } = require('../services/mailer');
const writeError = (res, error) => {
  if (error instanceof AttemptError) return res.status(error.status).json({ message: error.message });
  if (['P2002', 'P2034'].includes(error.code)) return res.status(409).json({ message: 'Records changed during this request. Refresh and review before retrying. No batch was accepted.' });
  console.error('Potential scholar operation failed:', error.code || error.name);
  return res.status(500).json({ message: 'Unable to save this decision. Refresh before retrying.' });
};
const add = async (req, res) => {
  const applicantId = Number(req.params.applicantId), review = req.body || {};
  if (!Number.isSafeInteger(applicantId) || applicantId <= 0 || !validReview(review) || !/^[a-f0-9]{64}$/.test(review.reviewToken || '')) return res.status(400).json({ message: 'Open the current Results record and check its initial requirements before adding.' });
  try {
    const marker = await prisma.$transaction(async tx => {
      const context = await loadScholarReview(tx, applicantId, review);
      if (context.alreadyAccepted) throw new AttemptError('This applicant is already an active scholar.', 409);
      if (reviewFingerprint(context) !== review.reviewToken) throw new AttemptError('The checked requirements or result changed. Reload and check again.', 409);
      const existing = reviewMarker(context.application, context.activePeriod.id);
      if (existing?.status === 'potential' && existing.fingerprint === review.reviewToken) return existing;
      const marker = makePotentialReview(context, req.user.id);
      const saved = await tx.application_submissions.updateMany({ where: { id: context.application.id, initial_docs: { equals: context.application.initial_docs } }, data: { initial_docs: { ...context.application.initial_docs, potentialScholarReviews: { ...context.application.initial_docs?.potentialScholarReviews, [context.activePeriod.id]: marker } } } });
      if (saved.count !== 1) throw new AttemptError('The requirements changed while adding. Reload and check again.', 409);
      return marker;
    }, { isolationLevel: 'Serializable' });
    res.locals.auditAction = 'APPLICANT_ADDED_TO_POTENTIAL_SCHOLARS';
    res.locals.auditTargetId = applicantId;
    res.locals.auditDescription = 'Added an individually checked applicant to Potential Scholars; scholarship approval remains pending.';
    return res.status(201).json({ message: 'Added to Potential Scholars. Final acceptance is still required.', potentialReview: { reviewId: marker.reviewId, addedAt: marker.addedAt } });
  } catch (error) { return writeError(res, error); }
};
const acceptBatch = async (req, res) => {
  const selected = req.body?.selected;
  if (!Array.isArray(selected) || selected.length < 1 || selected.length > 50 || new Set(selected.map(row => row?.applicantId)).size !== selected.length || selected.some(row => !Number.isSafeInteger(row?.applicantId) || row.applicantId <= 0 || typeof row.reviewId !== 'string' || !/^[0-9a-f-]{36}$/i.test(row.reviewId))) return res.status(400).json({ message: 'Select between 1 and 50 distinct potential scholars with current reviews.' });
  try {
    const decisions = await prisma.$transaction(async tx => {
      const period = await findPrimaryActivePeriod(tx);
      if (!period || req.body.academicPeriodId !== period.id) throw new AttemptError('The academic period changed. Reload Potential Scholars.', 409);
      const decisions = [];
      // A deterministic order and one serializable transaction prevent partial batches.
      for (const selection of [...selected].sort((a, b) => a.applicantId - b.applicantId)) {
        const application = await tx.application_submissions.findFirst({ where: { applicant_id: selection.applicantId }, orderBy: { submitted_at: 'desc' } });
        const marker = reviewMarker(application, period.id);
        if (!marker || marker.status !== 'potential' || marker.reviewId !== selection.reviewId) throw new AttemptError(`Applicant #${selection.applicantId} needs a current potential-scholar review. No selected applicants were accepted.`, 409);
        const decision = await acceptReviewedScholar(tx, selection.applicantId, marker, req.user.id, selection.reviewId);
        if (decision.alreadyAccepted) throw new AttemptError(`Applicant #${selection.applicantId} was already accepted. Refresh the selection.`, 409);
        const consumed = { ...marker, status: 'accepted', acceptedAt: new Date().toISOString(), acceptedBy: req.user.id };
        const saved = await tx.application_submissions.updateMany({ where: { id: application.id, initial_docs: { equals: application.initial_docs } }, data: { initial_docs: { ...application.initial_docs, potentialScholarReviews: { ...application.initial_docs.potentialScholarReviews, [period.id]: consumed } } } });
        if (saved.count !== 1) throw new AttemptError('A selected review changed. Refresh and retry; no batch was accepted.', 409);
        decisions.push(decision);
      }
      return decisions;
    }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 120000 });
    // Keep existing approval email behavior strictly after the whole batch commits.
    let emailsSent = 0;
    for (const decision of decisions) {
      try {
        const delivery = await sendScholarApprovedEmail({ to: decision.applicant.email, firstName: decision.applicant.first_name, scholarId: decision.scholar.scholar_id, schoolYear: decision.schoolYear });
        if (delivery.sent) emailsSent++;
      } catch { /* A mail failure cannot undo a committed scholarship decision. */ }
    }
    res.locals.auditAction = 'POTENTIAL_SCHOLARS_BATCH_ACCEPTED';
    res.locals.auditDescription = `Explicitly accepted ${decisions.length} individually checked potential scholars in one batch.`;
    return res.status(201).json({ message: `${decisions.length} selected applicants accepted as Scholars.`, acceptedIds: decisions.map(decision => decision.scholar.applicant_id), notification: { emailsSent, emailsNotSent: decisions.length - emailsSent } });
  } catch (error) { return writeError(res, error); }
};
module.exports = { index, add, acceptBatch };
