const normalizeSchoolName = (name) => typeof name === 'string'
  ? name.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase()
  : '';

const resolveScholarSchool = ({ applicant, requirement, application, schoolById, schoolByName }) => {
  // A dangling period-specific reference must not hide a valid applicant school.
  const periodSchool = schoolById.get(Number(requirement?.school_id));
  if (periodSchool) return periodSchool;
  const applicantSchool = schoolById.get(Number(applicant?.school_id));
  if (applicantSchool) return applicantSchool;
  return schoolByName.get(normalizeSchoolName(application?.school_plan?.school)) || null;
};

module.exports = { normalizeSchoolName, resolveScholarSchool };
