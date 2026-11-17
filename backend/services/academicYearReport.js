const { findPrimaryActivePeriod } = require('./academicPeriod');
const { isCertificationBatch } = require('./payrollListScope');
const { INITIAL_KEYS, CONTINUING_KEYS, getInitialRequirements, getContinuingRequirements } = require('./requirementWaves');
const { initialAcademicRequirementKey } = require('./initialAcademicEvidence');
const { ONLINE_REQUIREMENTS } = require('./lifecycleIntegrity');
const { normalizeSchoolName, resolveScholarSchool } = require('./scholarSchool');

const ALL_SCHOOL_YEARS = 'All School Years';
const semesterOrder = { '1st Semester': 1, '2nd Semester': 2, Summer: 3 };
const fault = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const periodOrder = (left, right) => String(right.school_year).localeCompare(String(left.school_year))
  || (semesterOrder[right.semester] || 0) - (semesterOrder[left.semester] || 0)
  || Number(right.id) - Number(left.id);
const isFourthYear = value => /^(?:4th|fourth)\s*year$/i.test(String(value || '').trim());

const resolveReportScope = (availablePeriods, primaryPeriod, requestedYear) => {
  if (requestedYear != null && typeof requestedYear !== 'string') throw fault('Select a valid report school year.');
  const requested = String(requestedYear || '').trim();
  const allYears = requested === 'all' || requested === ALL_SCHOOL_YEARS;
  if (requested && !allYears) {
    const match = /^(\d{4})-(\d{4})$/.exec(requested);
    if (!match || Number(match[2]) !== Number(match[1]) + 1) throw fault('Select a consecutive YYYY-YYYY school year.');
    if (!availablePeriods.some(period => period.school_year === requested)) throw fault('That school year is not configured.', 404);
  }
  const ordered = [...availablePeriods].sort(periodOrder);
  const defaultSchoolYear = primaryPeriod?.school_year || ordered[0]?.school_year || null;
  const defaultSource = primaryPeriod ? primaryPeriod.is_primary ? 'primary' : 'active' : ordered.length ? 'configured' : null;
  const schoolYear = allYears ? ALL_SCHOOL_YEARS : requested || defaultSchoolYear;
  const selected = ordered.filter(period => allYears || period.school_year === schoolYear);
  return { schoolYear, allYears, primarySchoolYear: primaryPeriod?.is_primary ? primaryPeriod.school_year : null,
    defaultSchoolYear, defaultSource,
    periodIds: selected.map(period => period.id), semesters: [...new Set(selected.map(period => period.semester))], includesArchived: true };
};

// Values come only from saved list membership. Legacy release and receipt
// verification fields are neither queried nor projected by this report.
const moneyCents = value => {
  if (value == null || value === '') return null;
  const text = String(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const number = Number(text), cents = Math.round(number * 100);
  return Number.isFinite(number) && number >= 0 && number <= 99999999.99 && Number.isSafeInteger(cents) && number === cents / 100 ? cents : null;
};
const approved = file => Boolean(file?.fileName && ['approved', 'complete', 'completed'].includes(String(file.status || '').trim().toLowerCase()));
const recordedSets = docs => Object.entries(docs?.requirementSets || {}).map(([key, set]) => ({
  ...set, academicPeriodId: Number(set?.academicPeriodId || key.split(':')[0]), wave: set?.wave || key.split(':')[1],
})).filter(set => ['initial', 'continuing'].includes(set.wave)
  && (Object.keys(set.requirements || {}).length || set.history?.length));

const setCleared = (set, docs, schoolType, entryYearLevel, period) => {
  const type = String(schoolType || '').trim().toLowerCase();
  if (!['public', 'private'].includes(type)) return false;
  if (set.wave === 'continuing') {
    // Clearance may reuse matching initial evidence, but participation still
    // comes exclusively from the physically recorded sets collected below.
    const files = period ? getContinuingRequirements(docs, period, set.academicPeriodId).requirements : set.requirements;
    return CONTINUING_KEYS.filter(key => type === 'private' || key !== 'tuition_receipt').every(key => approved(files?.[key]));
  }
  // Explicit later initial updates can reference the original initial set;
  // unrecorded later periods never acquire an invented requirement set.
  const originalPeriodId = Number(docs?.initialRequirementPeriodId) || set.academicPeriodId;
  const files = getInitialRequirements(docs, set.academicPeriodId, originalPeriodId).requirements;
  return INITIAL_KEYS.filter(key => !['indigency', 'grades', 'report_card'].includes(key)
    && (type === 'private' || key !== 'tuition_receipt')).every(key => approved(files[key]))
    && approved(files[initialAcademicRequirementKey(entryYearLevel)]);
};
const legacyRequirementSet = requirement => {
  const files = Object.fromEntries(ONLINE_REQUIREMENTS.filter(definition => requirement[definition.fileField])
    .map(definition => [definition.key, { fileName: 'Recorded document', status: requirement[definition.statusField] }]));
  return Object.keys(files).length ? { academicPeriodId: requirement.billing_period_id, wave: 'initial', requirements: files } : null;
};

const buildAcademicYearReport = ({ scope, periods, primaryPeriod, applicants, applications, scholarAccounts,
  requirements, schools, batches, claims, exams, slots, results, controlAccounts, actionGroups = [], recentActivity = [] }) => {
  const periodById = new Map(periods.map(period => [period.id, period]));
  const selectedPeriods = new Set(scope.periodIds);
  const applicantById = new Map(applicants.filter(applicant => !applicant.deleted_at).map(applicant => [applicant.id, applicant]));
  const scholarById = new Map(scholarAccounts.filter(scholar => applicantById.has(scholar.applicant_id)).map(scholar => [scholar.applicant_id, scholar]));
  const accountById = new Map(controlAccounts.map(account => [account.applicant_id, account]));
  const applicationById = new Map();
  applications.forEach(application => { if (!applicationById.has(application.applicant_id)) applicationById.set(application.applicant_id, application); });
  const schoolById = new Map(schools.map(school => [school.id, school]));
  const schoolByName = new Map(schools.map(school => [normalizeSchoolName(school.name), school]));
  const eligibleIntake = new Set(applicants.filter(applicant => applicantById.has(applicant.id)
    && (scope.allYears || scope.schoolYear && applicant.school_year === scope.schoolYear)).map(applicant => applicant.id));
  const selectedExamIds = new Set(exams.filter(exam => scope.allYears || exam.academic_year === scope.schoolYear).map(exam => exam.id));
  const intakeResult = results.filter(result => selectedExamIds.has(result.exam_id) && eligibleIntake.has(result.applicant_id));
  const intake = {
    applied: new Set(applications.filter(application => eligibleIntake.has(application.applicant_id)).map(application => application.applicant_id)).size,
    scheduled: new Set(slots.filter(slot => selectedExamIds.has(slot.exam_id) && eligibleIntake.has(slot.applicant_id)).map(slot => slot.applicant_id)).size,
    examined: new Set(intakeResult.map(result => result.applicant_id)).size,
    passed: new Set(intakeResult.filter(result => result.passed).map(result => result.applicant_id)).size,
  };

  const participation = new Map();
  const noteParticipation = (applicantId, periodId) => {
    if (!scholarById.has(applicantId)) return;
    if (!selectedPeriods.has(periodId) && !scope.allYears) return;
    if (!participation.has(applicantId)) participation.set(applicantId, new Set());
    participation.get(applicantId).add(periodById.has(periodId) ? periodId : null);
  };
  const selectedRequirements = requirements.filter(requirement => selectedPeriods.has(requirement.billing_period_id) && scholarById.has(requirement.applicant_id));
  selectedRequirements.forEach(requirement => noteParticipation(requirement.applicant_id, requirement.billing_period_id));
  const requirementByKey = new Map(selectedRequirements.map(requirement => [`${requirement.applicant_id}:${requirement.billing_period_id}`, requirement]));
  const setsByKey = new Map();
  applications.forEach(application => {
    if (!scholarById.has(application.applicant_id)) return;
    recordedSets(application.initial_docs).filter(set => selectedPeriods.has(set.academicPeriodId)).forEach(set => {
      noteParticipation(application.applicant_id, set.academicPeriodId);
      const key = `${application.applicant_id}:${set.academicPeriodId}:${set.wave}`;
      // Submissions arrive newest first. Newer same-period decisions win, while
      // a later application cannot erase distinct older recorded semester sets.
      if (!setsByKey.has(key)) setsByKey.set(key, { applicantId: application.applicant_id, set, application });
    });
  });
  selectedRequirements.forEach(requirement => {
    const application = applicationById.get(requirement.applicant_id);
    if (['initial', 'continuing'].some(wave => setsByKey.has(`${requirement.applicant_id}:${requirement.billing_period_id}:${wave}`))) return;
    const set = legacyRequirementSet(requirement);
    if (set) setsByKey.set(`${requirement.applicant_id}:${requirement.billing_period_id}:initial`, { applicantId: requirement.applicant_id, set, application, legacy: true });
  });

  const currentProfile = applicantId => {
    const applicant = applicantById.get(applicantId), application = applicationById.get(applicantId);
    const school = resolveScholarSchool({ applicant, application, schoolById, schoolByName });
    return { applicantId, name: [applicant.first_name, applicant.middle_name, applicant.last_name].filter(Boolean).join(' ') || 'Not specified',
      controlNumber: accountById.get(applicantId)?.control_number || '', school: school?.name || application?.school_plan?.school || 'Not specified',
      course: application?.school_plan?.course || '', municipality: applicant.municipality || '', barangay: applicant.barangay || '',
      status: scholarById.get(applicantId).is_active ? 'Active' : 'Inactive' };
  };
  let requirementsClearedSets = 0;
  setsByKey.forEach(({ applicantId, set, application, legacy }) => {
    const requirement = requirementByKey.get(`${applicantId}:${set.academicPeriodId}`);
    // A current school transfer cannot silently change the requirements for a
    // recorded older semester. Missing period classification remains unknown.
    const school = schoolById.get(Number(requirement?.school_id));
    if (setCleared(set, legacy ? { requirements: set.requirements } : application?.initial_docs,
      school?.school_type, application?.school_plan?.incomingYearLevel, periodById.get(set.academicPeriodId))) requirementsClearedSets += 1;
  });

  // Retain legacy batch/claim storage strictly as saved list membership. A
  // legacy payment status does not add, remove, or verify a listed amount.
  const selectedBatches = batches.filter(batch => selectedPeriods.has(batch.billing_period_id) || scope.allYears);
  const batchById = new Map(selectedBatches.map(batch => [batch.id, batch]));
  const membershipKeys = new Set(), listedPeriodKeys = new Set(), listedBatchIds = new Set(), records = [];
  let certificationEntries = 0, payrollEntries = 0;
  const certificationPeople = new Set(), payrollPeople = new Set();
  claims.forEach(claim => {
    const batch = batchById.get(claim.payroll_batch_id);
    if (!batch || !scholarById.has(claim.applicant_id)) return;
    const membershipKey = `${batch.id}:${claim.applicant_id}`;
    if (membershipKeys.has(membershipKey)) return;
    membershipKeys.add(membershipKey); listedBatchIds.add(batch.id);
    noteParticipation(claim.applicant_id, batch.billing_period_id);
    listedPeriodKeys.add(`${claim.applicant_id}:${batch.billing_period_id}`);
    const period = periodById.get(batch.billing_period_id), certification = isCertificationBatch(batch);
    const profile = currentProfile(claim.applicant_id);
    const amount = certification ? null : moneyCents(claim.claim_amount), tuition = certification ? null : moneyCents(claim.tuition_fee_assistance);
    const allowance = certification ? null : moneyCents(claim.allowance);
    const breakdownRecorded = amount != null && tuition != null && allowance != null && tuition + allowance === amount;
    records.push({ ...profile, accountStatus: profile.status, id: `list:${membershipKey}`, academicPeriodId: period?.id || null,
      schoolYear: period?.school_year || 'Legacy period', semester: period?.semester || 'Not specified',
      listStatus: certification ? 'Certification listed' : 'Payroll listed', reference: batch.batch_number || '',
      historical: batch.billing_period_id !== primaryPeriod?.id,
      payrollAmount: amount == null ? null : amount / 100, tuitionAmount: breakdownRecorded ? tuition / 100 : null,
      allowanceAmount: breakdownRecorded ? allowance / 100 : null, breakdownStatus: certification ? 'Not applicable' : breakdownRecorded ? 'Recorded' : 'Not recorded' });
    if (certification) { certificationEntries += 1; certificationPeople.add(claim.applicant_id); }
    else { payrollEntries += 1; payrollPeople.add(claim.applicant_id); }
  });
  participation.forEach((periodIds, applicantId) => {
    periodIds.forEach(periodId => {
      if (periodId == null || listedPeriodKeys.has(`${applicantId}:${periodId}`)) return;
      const period = periodById.get(periodId), profile = currentProfile(applicantId);
      records.push({ ...profile, accountStatus: profile.status, id: `record:${applicantId}:${periodId}`, academicPeriodId: periodId,
        schoolYear: period.school_year, semester: period.semester, listStatus: 'Not listed', reference: '',
        historical: periodId !== primaryPeriod?.id, payrollAmount: null, tuitionAmount: null, allowanceAmount: null, breakdownStatus: 'Not applicable' });
    });
  });
  const reportScholars = [...participation.keys()].map(applicantId => {
    const savedRequirements = selectedRequirements.filter(requirement => requirement.applicant_id === applicantId)
      .sort((left, right) => periodOrder(periodById.get(left.billing_period_id), periodById.get(right.billing_period_id))
        || new Date(right.updated_at || 0) - new Date(left.updated_at || 0) || right.id - left.id);
    const yearLevelRecord = savedRequirements.find(requirement => requirement.year_level);
    const latestPeriod = [...participation.get(applicantId)].filter(id => periodById.has(id)).map(id => periodById.get(id)).sort(periodOrder)[0];
    return { ...currentProfile(applicantId), yearLevel: yearLevelRecord?.year_level || null,
      yearLevelPeriodId: yearLevelRecord?.billing_period_id || null,
      academicPeriodId: latestPeriod?.id || null, schoolYear: latestPeriod?.school_year || 'Legacy period', semester: latestPeriod?.semester || 'Not specified' };
  }).sort((left, right) => left.name.localeCompare(right.name) || left.applicantId - right.applicantId);
  // Current overview and fourth-year planning follow the Scholar directory even
  // before semester activity is recorded. Keep annual processing counts separate.
  const currentDirectory = Boolean(primaryPeriod?.is_active && !scope.allYears
    && scope.schoolYear === primaryPeriod.school_year && selectedPeriods.has(primaryPeriod.id));
  let planningScholars = reportScholars;
  if (currentDirectory) {
    const currentRequirements = new Map();
    selectedRequirements.filter(requirement => requirement.billing_period_id === primaryPeriod.id)
      .sort((left, right) => new Date(right.updated_at || 0) - new Date(left.updated_at || 0) || right.id - left.id)
      .forEach(requirement => { if (!currentRequirements.has(requirement.applicant_id)) currentRequirements.set(requirement.applicant_id, requirement); });
    planningScholars = [...scholarById.keys()].map(applicantId => {
      const requirement = currentRequirements.get(applicantId), application = applicationById.get(applicantId);
      const school = resolveScholarSchool({ applicant: applicantById.get(applicantId), requirement, application, schoolById, schoolByName });
      return { ...currentProfile(applicantId),
        school: school?.name || application?.school_plan?.school || 'Not specified',
        course: requirement?.course || application?.school_plan?.course || '',
        yearLevel: requirement?.year_level || application?.school_plan?.incomingYearLevel || null,
        yearLevelPeriodId: requirement?.year_level ? primaryPeriod.id : null,
        academicPeriodId: primaryPeriod.id, schoolYear: primaryPeriod.school_year, semester: primaryPeriod.semester };
    });
  }
  const overviewPopulation = {
    mode: currentDirectory ? 'current-directory' : 'recorded-years',
    period: currentDirectory ? { id: primaryPeriod.id, schoolYear: primaryPeriod.school_year, semester: primaryPeriod.semester } : null,
    scholars: [...planningScholars]
      .sort((left, right) => left.name.localeCompare(right.name) || left.applicantId - right.applicantId),
  };
  const fourthYearPlanning = {
    mode: overviewPopulation.mode,
    period: overviewPopulation.period,
    scholars: overviewPopulation.scholars.filter(scholar => isFourthYear(scholar.yearLevel)),
  };
  records.sort((left, right) => left.name.localeCompare(right.name) || right.schoolYear.localeCompare(left.schoolYear)
    || (semesterOrder[right.semester] || 0) - (semesterOrder[left.semester] || 0) || left.id.localeCompare(right.id));
  const processing = { scholars: reportScholars.length, requirementSets: setsByKey.size, requirementsClearedSets,
    certificationListed: certificationPeople.size, payrollListed: payrollPeople.size, certificationEntries, payrollEntries };
  const listsWithRecords = selectedBatches.filter(batch => listedBatchIds.has(batch.id));
  const certificationLists = listsWithRecords.filter(isCertificationBatch).length;
  return { scope, periods: periods.map(period => ({ id: period.id, schoolYear: period.school_year, semester: period.semester,
    isActive: period.is_active, isPrimary: Boolean(period.is_primary) })), intake, processing, scholars: reportScholars, records, overviewPopulation, fourthYearPlanning,
    // Compatibility fields now describe an annual scope. New consumers use
    // intake/processing rather than treating them as one continuous funnel.
    period: { id: null, schoolYear: scope.schoolYear, semester: 'All semesters', isActive: scope.periodIds.some(id => periodById.get(id)?.is_active) },
    funnel: { ...intake, scholars: processing.scholars, requirementsCleared: requirementsClearedSets,
      certificationListed: processing.certificationListed, payrollListed: processing.payrollListed },
    lists: { certificationLists, payrollLists: listsWithRecords.length - certificationLists, certificationEntries, payrollEntries },
    audit: { actionCounts: actionGroups.map(group => ({ action: group.action, count: group._count.action })),
      recent: recentActivity.map(log => ({ ...log, id: log.id.toString() })) } };
};

const loadAcademicYearReport = async (client, requestedYear) => {
  const [periods, primaryPeriod] = await Promise.all([
    client.academic_periods.findMany({ orderBy: [{ school_year: 'desc' }, { id: 'desc' }] }), findPrimaryActivePeriod(client),
  ]);
  const scope = resolveReportScope(periods, primaryPeriod, requestedYear);
  const [applicants, scholarAccounts, requirements, schools, batches, exams, actionGroups, recentActivity] = await Promise.all([
    client.applicants.findMany({ where: { deleted_at: null }, select: { id: true, first_name: true, middle_name: true, last_name: true, school_year: true, school_id: true, municipality: true, barangay: true } }),
    client.scholar_accounts.findMany({ select: { applicant_id: true, is_active: true } }),
    client.scholar_requirements.findMany({ where: { billing_period_id: { in: scope.periodIds } }, orderBy: [{ updated_at: 'desc' }, { id: 'desc' }] }),
    client.schools.findMany({ select: { id: true, name: true, school_type: true } }),
    client.payroll_batches.findMany({ where: scope.allYears ? {} : { billing_period_id: { in: scope.periodIds } }, select: { id: true, billing_period_id: true, batch_number: true, status: true } }),
    client.exams.findMany({ where: scope.allYears ? {} : { academic_year: scope.schoolYear || '' }, select: { id: true, academic_year: true } }),
    client.activity_logs.groupBy({ by: ['action'], _count: { action: true }, orderBy: { _count: { action: 'desc' } }, take: 10 }),
    client.activity_logs.findMany({ orderBy: { created_at: 'desc' }, take: 8, select: { id: true, action: true, actor_type: true, description: true, created_at: true } }),
  ]);
  const applicantIds = new Set(applicants.map(applicant => applicant.id));
  const scholarIds = scholarAccounts.map(scholar => scholar.applicant_id).filter(id => applicantIds.has(id));
  const intakeIds = applicants.filter(applicant => scope.allYears || scope.schoolYear && applicant.school_year === scope.schoolYear).map(applicant => applicant.id);
  const relevantIds = [...new Set([...intakeIds, ...scholarIds])];
  const batchIds = batches.map(batch => batch.id), examIds = exams.map(exam => exam.id);
  const [applications, claims, slots, results, controlAccounts] = await Promise.all([
    relevantIds.length ? client.application_submissions.findMany({ where: { applicant_id: { in: relevantIds } }, orderBy: [{ submitted_at: 'desc' }, { id: 'desc' }], select: { applicant_id: true, initial_docs: true, school_plan: true } }) : [],
    batchIds.length ? client.payroll_claims.findMany({ where: { payroll_batch_id: { in: batchIds }, applicant_id: { in: scholarIds } }, select: { id: true, payroll_batch_id: true, applicant_id: true, claim_amount: true, tuition_fee_assistance: true, allowance: true } }) : [],
    examIds.length && intakeIds.length ? client.exam_slots.findMany({ where: { exam_id: { in: examIds }, applicant_id: { in: intakeIds } }, select: { applicant_id: true, exam_id: true } }) : [],
    examIds.length && intakeIds.length ? client.results.findMany({ where: { exam_id: { in: examIds }, applicant_id: { in: intakeIds } }, select: { applicant_id: true, exam_id: true, passed: true } }) : [],
    scholarIds.length ? client.control_accounts.findMany({ where: { applicant_id: { in: scholarIds } }, select: { applicant_id: true, control_number: true } }) : [],
  ]);
  return buildAcademicYearReport({ scope, periods, primaryPeriod, applicants, applications, scholarAccounts, requirements, schools, batches, claims, exams, slots, results, controlAccounts, actionGroups, recentActivity });
};

module.exports = { ALL_SCHOOL_YEARS, resolveReportScope, buildAcademicYearReport, loadAcademicYearReport };
