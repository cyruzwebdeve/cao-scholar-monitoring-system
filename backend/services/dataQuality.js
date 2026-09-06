const cleanText = (value) => String(value || '').trim();
const normalizeText = (value) => cleanText(value).toLowerCase().replace(/\s+/g, ' ');
const normalizePhone = (value) => cleanText(value).replace(/\D/g, '');

const ISSUE_DEFINITIONS = Object.freeze([
  { code: 'DUPLICATE_IDENTITY', label: 'Possible duplicate identities', severity: 'high', description: 'Matching name and birth date, or a shared valid mobile number.' },
  { code: 'MISSING_CONTROL_NUMBER', label: 'Missing control numbers', severity: 'high', description: 'Applicant records without a linked portal control account.' },
  { code: 'INCOMPLETE_IDENTITY', label: 'Incomplete identity details', severity: 'medium', description: 'Birth date, birthplace, or gender is missing.' },
  { code: 'INCOMPLETE_LOCATION', label: 'Incomplete addresses', severity: 'medium', description: 'Street, barangay, or municipality is missing.' },
  { code: 'UNLINKED_SCHOOL', label: 'Unlinked schools', severity: 'medium', description: 'No maintained School Catalog record is linked.' },
  { code: 'INVALID_PHONE', label: 'Invalid mobile numbers', severity: 'medium', description: 'A Philippine 11-digit mobile number is missing or malformed.' },
]);

const addToGroup = (groups, key, applicantId) => {
  if (!key) return;
  const ids = groups.get(key) || [];
  ids.push(applicantId);
  groups.set(key, ids);
};

const assessApplicantDataQuality = ({ applicants = [], controlAccounts = [] } = {}) => {
  const accountIds = new Set(controlAccounts.map(({ applicant_id: applicantId }) => applicantId));
  const nameBirthGroups = new Map();
  const phoneGroups = new Map();

  applicants.forEach((applicant) => {
    const fullName = normalizeText([applicant.first_name, applicant.middle_name, applicant.last_name, applicant.name_ext].filter(Boolean).join(' '));
    const birthDate = applicant.date_of_birth ? new Date(applicant.date_of_birth).toISOString().slice(0, 10) : '';
    addToGroup(nameBirthGroups, fullName && birthDate ? `${fullName}|${birthDate}` : '', applicant.id);
    const phone = normalizePhone(applicant.phone);
    addToGroup(phoneGroups, /^09\d{9}$/.test(phone) ? phone : '', applicant.id);
  });

  const duplicateIds = new Set();
  [...nameBirthGroups.values(), ...phoneGroups.values()].forEach((ids) => {
    if (ids.length > 1) ids.forEach((id) => duplicateIds.add(id));
  });

  const issueIds = new Map(ISSUE_DEFINITIONS.map(({ code }) => [code, new Set()]));
  applicants.forEach((applicant) => {
    const phone = normalizePhone(applicant.phone);
    if (!/^09\d{9}$/.test(phone)) issueIds.get('INVALID_PHONE').add(applicant.id);
    if (![applicant.street, applicant.barangay, applicant.municipality].every((value) => cleanText(value))) issueIds.get('INCOMPLETE_LOCATION').add(applicant.id);
    if (![applicant.date_of_birth, applicant.birthplace, applicant.gender].every((value) => cleanText(value))) issueIds.get('INCOMPLETE_IDENTITY').add(applicant.id);
    if (!applicant.school_id) issueIds.get('UNLINKED_SCHOOL').add(applicant.id);
    if (!accountIds.has(applicant.id)) issueIds.get('MISSING_CONTROL_NUMBER').add(applicant.id);
    if (duplicateIds.has(applicant.id)) issueIds.get('DUPLICATE_IDENTITY').add(applicant.id);
  });

  const affectedIds = new Set();
  issueIds.forEach((ids) => ids.forEach((id) => affectedIds.add(id)));
  const totalChecks = applicants.length * ISSUE_DEFINITIONS.length;
  const failedChecks = [...issueIds.values()].reduce((total, ids) => total + ids.size, 0);

  return {
    totalRecords: applicants.length,
    cleanRecords: applicants.length - affectedIds.size,
    affectedRecords: affectedIds.size,
    qualityScore: totalChecks ? Math.round(((totalChecks - failedChecks) / totalChecks) * 100) : 100,
    issues: ISSUE_DEFINITIONS.map((definition) => ({ ...definition, count: issueIds.get(definition.code).size }))
      .filter(({ count }) => count > 0),
  };
};

module.exports = { assessApplicantDataQuality };
