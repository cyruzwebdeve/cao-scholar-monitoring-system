const normalizeSchoolName = (name) => typeof name === 'string'
  ? name.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase()
  : '';

const schoolClassification = (value) => {
  const type = String(value || '').trim().toLowerCase();
  return type === 'public' ? 'Public' : type === 'private' ? 'Private' : 'Unclassified';
};

const loadSchoolHistory = async (client, applicantIds) => {
  if (!applicantIds.length) return new Map();
  const records = await client.scholar_requirements.findMany({
    where: { applicant_id: { in: applicantIds }, school_id: { not: null } },
    select: { applicant_id: true, school_id: true },
    orderBy: [{ updated_at: 'desc' }, { id: 'desc' }],
  });
  const byApplicant = new Map();
  records.forEach((record) => {
    const history = byApplicant.get(record.applicant_id) || [];
    history.push(record);
    byApplicant.set(record.applicant_id, history);
  });
  return byApplicant;
};

const resolveScholarSchool = ({ applicant, requirement, application, schoolById, schoolByName, schoolHistory = [] }) => {
  // A dangling period-specific reference must not hide a valid applicant school.
  const periodSchool = schoolById.get(Number(requirement?.school_id));
  if (periodSchool) return periodSchool;
  const applicantSchool = schoolById.get(Number(applicant?.school_id));
  if (applicantSchool) return applicantSchool;
  const plannedName = normalizeSchoolName(application?.school_plan?.school);
  const plannedSchool = schoolByName.get(plannedName);
  if (plannedSchool) return plannedSchool;
  // Reuse a matching historical link, but never silently undo a school transfer.
  for (const record of schoolHistory) {
    const school = schoolById.get(Number(record.school_id));
    if (school && (!plannedName || normalizeSchoolName(school.name) === plannedName)) return school;
  }
  return null;
};

const loadResolvedScholarSchool = async (client, { applicantId, applicant, requirement, application }) => {
  const [schools, history] = await Promise.all([
    client.schools.findMany({ select: { id: true, name: true, school_type: true } }),
    loadSchoolHistory(client, [applicantId]),
  ]);
  return resolveScholarSchool({
    applicant, requirement, application,
    schoolById: new Map(schools.map((school) => [school.id, school])),
    schoolByName: new Map(schools.map((school) => [normalizeSchoolName(school.name), school])),
    schoolHistory: history.get(applicantId),
  });
};

module.exports = { loadSchoolHistory, loadResolvedScholarSchool, normalizeSchoolName, resolveScholarSchool, schoolClassification };
