// Only application-stage states may enter or complete a qualifying examination.
const EXAMINATION_APPLICATION_STATES = new Set(['pending', 'applied', 'submitted', 'for review', 'examined', 'passed_exam']);
const isExaminationApplicationEligible = (application) => Boolean(application && EXAMINATION_APPLICATION_STATES.has(String(application.status || '').trim().toLowerCase()));
const isCurrentExaminationApplicant = (applicant, schoolYear, legacySchoolYear) => Boolean(applicant && !applicant.deleted_at && (!applicant.school_year || applicant.school_year === schoolYear || applicant.school_year === legacySchoolYear));
module.exports = { isExaminationApplicationEligible, isCurrentExaminationApplicant };
