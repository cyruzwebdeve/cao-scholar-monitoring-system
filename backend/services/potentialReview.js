const { createHash, randomUUID } = require('node:crypto');
const { AttemptError } = require('./onlineExamAttempt');
const { getInitialRequirements } = require('./requirementWaves');
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? value instanceof Date ? value.toISOString() : Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const reviewFingerprint = ({ activePeriod, applicant, latestResult, application, intakeSchool }) => createHash('sha256').update(JSON.stringify(canonical({
  period: [activePeriod.id, activePeriod.school_year, activePeriod.semester],
  applicant: [applicant.id, applicant.school_id, applicant.school_year, applicant.municipality],
  application: { id: application.id, status: application.status, identity: application.identity, address: application.address, family: application.family, eligibility: application.eligibility, school_plan: application.school_plan },
  requirements: getInitialRequirements(application.initial_docs, activePeriod.id, activePeriod.id).requirements,
  result: [latestResult.id, latestResult.exam_id, latestResult.exam_slot_id, latestResult.score == null ? null : String(latestResult.score), latestResult.passing_score == null ? null : String(latestResult.passing_score), latestResult.passed, latestResult.published_at, latestResult.updated_at],
  school: intakeSchool && [intakeSchool.id, intakeSchool.name, intakeSchool.school_type],
}))).digest('hex');
const reviewMarker = (application, periodId) => application?.initial_docs?.potentialScholarReviews?.[String(periodId)];
const makePotentialReview = (context, actorId) => ({
  status: 'potential', reviewId: randomUUID(), fingerprint: reviewFingerprint(context), addedBy: actorId, addedAt: new Date().toISOString(),
  applicationId: context.application.id, academicPeriodId: context.activePeriod.id, examId: context.latestResult.exam_id,
  resultId: context.latestResult.id, updatedAt: new Date(context.latestResult.updated_at).toISOString(),
});
const assertPotentialReview = (context, reviewId) => {
  const marker = reviewMarker(context.application, context.activePeriod.id);
  if (!marker || marker.status !== 'potential' || marker.reviewId !== reviewId || marker.fingerprint !== reviewFingerprint(context)) throw new AttemptError('The potential-scholar review changed. Check the requirements in Results and add this applicant again.', 409);
  return marker;
};
const validReview = review => review && ['examId','resultId','applicationId','academicPeriodId'].every(key => Number.isSafeInteger(review[key]) && review[key] > 0)
  && typeof review.updatedAt === 'string' && Number.isFinite(+new Date(review.updatedAt));
const publicApplication = application => application ? { ...application, initial_docs: Object.fromEntries(Object.entries(application.initial_docs || {}).filter(([key]) => key !== 'potentialScholarReviews')) } : application;
module.exports = { publicApplication, reviewFingerprint, reviewMarker, makePotentialReview, assertPotentialReview, validReview };
