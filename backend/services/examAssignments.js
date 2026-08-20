const normalizeMunicipality = (value) => String(value || '')
  .normalize('NFKC')
  .trim()
  .replace(/\s+/g, ' ')
  .toLowerCase();

const indexExamsByMunicipality = (exams, academicYear) => {
  const schedules = new Map();
  [...exams]
    .filter((exam) => exam.academic_year === academicYear)
    .sort((left, right) => new Date(right.updated_at || 0) - new Date(left.updated_at || 0))
    .forEach((exam) => {
      const key = normalizeMunicipality(exam.municipality);
      if (key && !schedules.has(key)) schedules.set(key, exam);
    });
  return schedules;
};

const buildExamSlotAssignments = ({ applicants, exams, academicYear }) => {
  const schedules = indexExamsByMunicipality(exams, academicYear);
  const assignments = [];
  const seen = new Set();

  applicants.forEach((applicant) => {
    const exam = schedules.get(normalizeMunicipality(applicant.municipality));
    if (!exam) return;
    const key = `${applicant.id}:${exam.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    assignments.push({
      applicant_id: applicant.id,
      exam_id: exam.id,
      appeared: false,
    });
  });

  return assignments;
};

const countScheduledApplicants = ({ applicants, exams, slots, academicYear, legacySchoolYear = null }) => {
  const schedules = indexExamsByMunicipality(exams, academicYear);
  const currentExamIds = new Set(
    exams.filter((exam) => exam.academic_year === academicYear).map((exam) => exam.id),
  );
  const activeApplicants = new Set(applicants
    .filter((applicant) => !applicant.school_year
      || applicant.school_year === academicYear
      || applicant.school_year === legacySchoolYear)
    .map((applicant) => applicant.id));
  const scheduledApplicants = new Set();

  applicants.forEach((applicant) => {
    if (activeApplicants.has(applicant.id)
      && schedules.has(normalizeMunicipality(applicant.municipality))) {
      scheduledApplicants.add(applicant.id);
    }
  });
  slots.forEach((slot) => {
    if (activeApplicants.has(slot.applicant_id) && currentExamIds.has(slot.exam_id)) {
      scheduledApplicants.add(slot.applicant_id);
    }
  });

  return scheduledApplicants.size;
};

const assignApplicantToMunicipalityExam = async (client, { applicantId, municipality, academicYear }) => {
  const normalizedMunicipality = String(municipality || '').trim();
  if (!normalizedMunicipality) return null;

  const exam = await client.exams.findFirst({
    where: {
      municipality: { equals: normalizedMunicipality, mode: 'insensitive' },
      academic_year: academicYear,
    },
    orderBy: { updated_at: 'desc' },
  });
  if (!exam) return null;

  return client.exam_slots.upsert({
    where: { applicant_id_exam_id: { applicant_id: applicantId, exam_id: exam.id } },
    create: { applicant_id: applicantId, exam_id: exam.id, appeared: false },
    update: {},
  });
};

const assignApplicantsToMunicipalityExams = async (
  client,
  { exams, academicYear, legacySchoolYear = null },
) => {
  if (!exams.length) return { matched: 0, created: 0 };

  const schoolYearFilters = [{ school_year: academicYear }, { school_year: null }, { school_year: '' }];
  if (legacySchoolYear && legacySchoolYear !== academicYear) {
    schoolYearFilters.push({ school_year: legacySchoolYear });
  }

  const applicants = await client.applicants.findMany({
    where: {
      deleted_at: null,
      OR: schoolYearFilters,
    },
    select: { id: true, municipality: true },
  });
  const assignments = buildExamSlotAssignments({ applicants, exams, academicYear });
  if (!assignments.length) return { matched: 0, created: 0 };

  const result = await client.exam_slots.createMany({
    data: assignments,
    skipDuplicates: true,
  });
  return { matched: assignments.length, created: result.count };
};

module.exports = {
  assignApplicantToMunicipalityExam,
  assignApplicantsToMunicipalityExams,
  buildExamSlotAssignments,
  countScheduledApplicants,
  indexExamsByMunicipality,
  normalizeMunicipality,
};
