const { findPrimaryActivePeriod } = require('./academicPeriod');
const { isCurrentExaminationApplicant, isExaminationApplicationEligible } = require('./examinationEligibility');
const { normalizeMunicipality } = require('./examAssignments');
const { getPostedPasser, initialApproved } = require('./passerIntake');
const { loadResolvedScholarSchool } = require('./scholarSchool');
const { evaluateEligibility } = require('./eligibilityRecommendation');
const { AttemptError } = require('./onlineExamAttempt');
const { assertPotentialReview } = require('./potentialReview');
const STALE_DEFAULT_SCHOOL_YEAR = '2025-2026';

const loadScholarReview = async (transaction, applicantId, review) => {
      const activePeriod = await findPrimaryActivePeriod(transaction);
      if (!activePeriod || activePeriod.id !== review.academicPeriodId) throw new AttemptError('The primary period changed. Reload Results Management before deciding.');
      const [applicant, latestResult, application, existingScholar, exam, slot] = await Promise.all([
        transaction.applicants.findFirst({
          where: { id: applicantId, deleted_at: null },
          select: { id: true, email: true, first_name: true, school_id: true, school_year: true, municipality: true, deleted_at: true },
        }),
        transaction.results.findFirst({ where: { id: review.resultId, applicant_id: applicantId, exam_id: review.examId } }),
        transaction.application_submissions.findFirst({ where: { applicant_id: applicantId }, orderBy: { submitted_at: 'desc' } }),
        transaction.scholar_accounts.findFirst({ where: { applicant_id: applicantId } }),
        transaction.exams.findUnique({ where: { id: review.examId } }),
        transaction.exam_slots.findUnique({ where: { applicant_id_exam_id: { applicant_id: applicantId, exam_id: review.examId } } }),
      ]);
      if (!isCurrentExaminationApplicant(applicant, activePeriod.school_year, STALE_DEFAULT_SCHOOL_YEAR)) throw new AttemptError('The applicant is unavailable in the primary academic year.');
      if (!isExaminationApplicationEligible(application) || application.id !== review.applicationId) throw new AttemptError('The application changed or is unavailable. Reload before deciding.');
      if (!exam || exam.academic_year !== activePeriod.school_year || normalizeMunicipality(exam.municipality) !== normalizeMunicipality(applicant.municipality) || !slot || slot.exam_id !== exam.id || slot.applicant_id !== applicantId) throw new AttemptError('Use the applicant’s assigned examination in the primary academic year.');
      const scheduledExam = await transaction.exams.findFirst({ where: { academic_year: activePeriod.school_year, municipality: { equals: String(applicant.municipality || '').trim(), mode: 'insensitive' } }, orderBy: { updated_at: 'desc' } });
      if (scheduledExam?.id !== exam.id) throw new AttemptError('The assigned examination changed. Reload before deciding.');
      if (!latestResult || latestResult.id !== review.resultId || latestResult.exam_id !== review.examId || latestResult.applicant_id !== applicantId || latestResult.exam_slot_id !== slot.id || +new Date(latestResult.updated_at) !== +new Date(review.updatedAt)) throw new AttemptError('The reviewed result changed. Reload before deciding.');
      if (existingScholar?.is_active) return { scholar: existingScholar, alreadyAccepted: true };
      if (!latestResult.passed) throw new AttemptError('Only applicants with a passing reviewed result can be accepted.', 400);
      if (!latestResult.published_at) throw new AttemptError('Publish the reviewed examination result before scholarship acceptance.');

      if (!await getPostedPasser(transaction, applicantId, activePeriod.id, latestResult, application.id)) throw new AttemptError('Post this reviewed passing result in a locked Passer List before acceptance.', 400);
      const intakeSchool = await loadResolvedScholarSchool(transaction, { applicantId, applicant, application });
      if (!initialApproved(application.initial_docs, activePeriod.id, intakeSchool?.school_type, activePeriod.id, application.school_plan?.incomingYearLevel)) throw new AttemptError('Upload and approve all required initial documents before accepting as Scholar. Barangay Indigency is optional.', 400);

      return { activePeriod, applicant, latestResult, application, existingScholar, intakeSchool };
};

const acceptReviewedScholar = async (transaction, applicantId, review, actorId, potentialReviewId = null) => {
  const reviewReason = String(review.reviewReason || '').trim();
  const context = await loadScholarReview(transaction, applicantId, review);
  if (context.alreadyAccepted) return context;
  const { activePeriod, applicant, latestResult, application, existingScholar } = context;
  if (potentialReviewId) assertPotentialReview(context, potentialReviewId);
      const assessment = evaluateEligibility({ application, result: latestResult });
      const schoolYear = applicant.school_year === STALE_DEFAULT_SCHOOL_YEAR || !applicant.school_year
        ? activePeriod.school_year
        : applicant.school_year;
      const yearPrefix = String(schoolYear).split('-')[0];
      const scholarId = existingScholar?.scholar_id || `PGCEAP-${yearPrefix}-${String(applicantId).padStart(5, '0')}`;

      const savedScholar = existingScholar
        ? await transaction.scholar_accounts.update({
          where: { id: existingScholar.id },
          data: { result_id: latestResult.id, scholar_id: scholarId, is_active: true, issued_by: actorId, issued_at: new Date(), updated_at: new Date() },
        })
        : await transaction.scholar_accounts.create({
          data: { applicant_id: applicantId, result_id: latestResult.id, scholar_id: scholarId, is_active: true, issued_by: actorId },
        });
      await transaction.eligibility_assessments.create({
        data: {
          applicant_id: applicantId,
          application_id: application.id,
          result_id: latestResult.id,
          academic_period_id: activePeriod.id,
          policy_version: assessment.policyVersion,
          policy_name: assessment.policyName,
          recommendation: assessment.recommendation,
          total_score: assessment.totalScore,
          max_score: assessment.maxScore,
          threshold_score: assessment.threshold,
          summary: assessment.summary,
          scorecard: assessment.factors,
          input_snapshot: assessment.inputSnapshot,
          generated_at: new Date(assessment.generatedAt),
          reviewed_by: actorId,
          review_decision: 'accepted',
          review_reason: reviewReason || null,
          reviewed_at: new Date(),
        },
      });
      await transaction.scholar_requirements.upsert({
        where: { applicant_id_billing_period_id: { applicant_id: applicantId, billing_period_id: activePeriod.id } },
        create: { applicant_id: applicantId, billing_period_id: activePeriod.id, updated_by: actorId },
        update: { updated_by: actorId },
      });
      return { scholar: savedScholar, applicant, schoolYear, assessment };
};
module.exports = { loadScholarReview, acceptReviewedScholar };
