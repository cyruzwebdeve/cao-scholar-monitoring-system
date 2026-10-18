const { isFirstYearEntry } = require('./initialAcademicEvidence');
const { getInitialRequirements, INITIAL_KEYS } = require('./requirementWaves');
const { initialApproved } = require('./continuingSchedule');
const { isExaminationApplicationEligible } = require('./examinationEligibility');
const LABELS = { tax_exemption: 'Certificate of Tax Exemption', indigency: 'Barangay Indigency (optional)', valid_id: 'Photocopy of ID (any valid ID)', grades: 'Certificate of Grades (previous semester attended)', report_card: 'Grade 12 Report Card (optional, incoming/1st-year college)', registration_form: 'Registration Form (currently enrolled semester)', tuition_receipt: 'Official Receipt of Tuition Fee (private schools)' };
const getPostedPasser = async (client, applicantId, periodId, result = null, applicationId = null) => {
  if (!client.passer_list_members) return null; // Fail closed for older clients/test facades.
  const members = await client.passer_list_members.findMany({ where: { applicant_id: applicantId, academic_period_id: periodId, list: { status: 'posted', revisions: { none: { status: 'posted' } } } }, include: { list: true }, orderBy: { id: 'desc' } });
  return members.find((member) => (!applicationId || member.application_id === applicationId) && (!result || (result.passed && result.published_at && member.result_id === result.id && +new Date(member.snapshot.resultUpdatedAt) === +new Date(result.updated_at)))) || null;
};
const canRecordInitial = async (client, applicantId, periodId, application) => {
  if (!isExaminationApplicationEligible(application)) return false;
  const member = await getPostedPasser(client, applicantId, periodId, null, application.id);
  if (!member) return false;
  const result = await client.results.findFirst({ where: { id: member.result_id, applicant_id: applicantId } });
  return Boolean(await getPostedPasser(client, applicantId, periodId, result || { passed: false }, application.id));
};
const initialChecklist = (docs, periodId, schoolType, legacyPeriodId = periodId, applicationId = null, entryYearLevel = null) => {
  const files = getInitialRequirements(docs, periodId, legacyPeriodId).requirements;
  return INITIAL_KEYS.filter((key) => (String(schoolType).toLowerCase() === 'private' || key !== 'tuition_receipt') && (key !== 'report_card' || isFirstYearEntry(entryYearLevel) || files[key]?.fileName)).map((key) => ({ requirementKey: key, label: LABELS[key], optional: ['indigency', 'report_card'].includes(key) || (key === 'grades' && isFirstYearEntry(entryYearLevel)), alternativeGroup: isFirstYearEntry(entryYearLevel) && ['grades', 'report_card'].includes(key) ? 'initial_grades' : null, fileName: files[key]?.fileName || null, submitted: Boolean(files[key]?.fileName), status: files[key]?.status || 'Not Submitted', applicationId, academicPeriodId: periodId, submissionWave: 'initial', versionId: files[key]?.versionId || null }));
};
module.exports = { getPostedPasser, canRecordInitial, initialChecklist, initialApproved };
