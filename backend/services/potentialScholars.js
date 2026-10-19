const { reviewMarker, reviewFingerprint } = require('./potentialReview');
const { initialChecklist, initialApproved } = require('./passerIntake');
const { isExaminationApplicationEligible, isCurrentExaminationApplicant } = require('./examinationEligibility');
const { indexExamsByMunicipality, normalizeMunicipality } = require('./examAssignments');
const { resolveScholarSchool, normalizeSchoolName } = require('./scholarSchool');

// Completeness is a read-only queue classification, never scholarship approval.
const initialSubmissionComplete = (documents, schoolType) => {
  if (!documents.length || !['public', 'private'].includes(String(schoolType || '').toLowerCase())) return false;
  const usable = document => document.submitted && ['approved', 'complete', 'completed', 'pending', 'submitted', 'under review'].includes(String(document.status).toLowerCase());
  const groups = [...new Set(documents.map(document => document.alternativeGroup).filter(Boolean))];
  return documents.filter(document => !document.optional).every(usable)
    && groups.every(group => documents.some(document => document.alternativeGroup === group && usable(document)));
};
const buildPotentialScholars = ({ period, members, applicants, applications, results, exams, slots, scholars, accounts, schools, schoolHistory = new Map(), stagedApplications = applications }) => {
  const byId = rows => new Map(rows.map(row => [row.id, row]));
  const people = byId(applicants), scores = byId(results), assignedSlots = byId(slots);
  const latestApplications = new Map();
  applications.forEach(row => { if (!latestApplications.has(row.applicant_id)) latestApplications.set(row.applicant_id, row); });
  const currentExams = indexExamsByMunicipality(exams, period.school_year);
  const accepted = new Set(scholars.filter(row => row.is_active).map(row => row.applicant_id));
  const controls = new Map(accounts.map(row => [row.applicant_id, row.control_number]));
  const schoolById = byId(schools), schoolByName = new Map(schools.map(row => [normalizeSchoolName(row.name), row]));
  const staged = new Map();
  stagedApplications.forEach(application => {
    const marker = reviewMarker(application, period.id);
    if (marker?.status === 'potential' && !staged.has(application.applicant_id)) staged.set(application.applicant_id, { application, marker });
  });
  const seen = new Set(), queue = [];
  for (const member of members) {
    const applicant = people.get(member.applicant_id), application = latestApplications.get(member.applicant_id), result = scores.get(member.result_id);
    const exam = currentExams.get(normalizeMunicipality(applicant?.municipality));
    const slot = assignedSlots.get(result?.exam_slot_id);
    if (!staged.has(member.applicant_id) || seen.has(member.applicant_id) || accepted.has(member.applicant_id)
      || !isCurrentExaminationApplicant(applicant, period.school_year, '2025-2026') || !isExaminationApplicationEligible(application)
      || application.id !== member.application_id || !result?.passed || !result.published_at
      || result.applicant_id !== applicant.id || result.exam_id !== member.exam_id || exam?.id !== result.exam_id
      || !slot || slot.exam_id !== result.exam_id || slot.applicant_id !== applicant.id
      || !Number.isFinite(+new Date(result.updated_at)) || +new Date(result.updated_at) !== +new Date(member.snapshot?.resultUpdatedAt)) continue;
    const school = resolveScholarSchool({ applicant, application, schoolById, schoolByName, schoolHistory: schoolHistory.get(applicant.id) });
    const documents = initialChecklist(application.initial_docs, period.id, school?.school_type, period.id, application.id, application.school_plan?.incomingYearLevel);
    if (!initialSubmissionComplete(documents, school?.school_type)) continue;
    const marker = staged.get(applicant.id).marker;
    const verified = initialApproved(application.initial_docs, period.id, school.school_type, period.id, application.school_plan?.incomingYearLevel);
    const current = marker.applicationId === application.id && verified && marker.fingerprint === reviewFingerprint({ activePeriod: period, applicant, latestResult: result, application, intakeSchool: school });
    seen.add(applicant.id);
    queue.push({ id: applicant.id, name: [applicant.last_name, [applicant.first_name, applicant.middle_name].filter(Boolean).join(' ')].filter(Boolean).join(', '),
      controlNo: controls.get(applicant.id) || `Applicant #${applicant.id}`, municipality: applicant.municipality || 'Not specified',
      school: school?.name || 'Not specified', schoolType: school.school_type,
      initialVerified: initialApproved(application.initial_docs, period.id, school.school_type, period.id, application.school_plan?.incomingYearLevel),
      status: 'Potential scholar', canAccept: current, reviewId: marker.reviewId, addedAt: marker.addedAt, reviewIssue: current ? null : 'Records changed after checking. Recheck in Results and add again.' });
  }
  for (const [id, { marker }] of staged) {
    if (seen.has(id) || accepted.has(id)) continue;
    const applicant = people.get(id);
    if (!applicant || applicant.deleted_at) continue;
    queue.push({ id, name: [applicant.last_name, [applicant.first_name, applicant.middle_name].filter(Boolean).join(' ')].filter(Boolean).join(', '), controlNo: controls.get(id) || `Applicant #${id}`, municipality: applicant.municipality || 'Not specified', school: 'Recheck current record', initialVerified: false, status: 'Potential scholar', canAccept: false, reviewId: marker.reviewId, addedAt: marker.addedAt, reviewIssue: 'Application, result, assignment or requirements changed. Recheck in Results and add again.' });
  }
  return queue.sort((a, b) => a.name.localeCompare(b.name));
};
module.exports = { initialSubmissionComplete, buildPotentialScholars };
