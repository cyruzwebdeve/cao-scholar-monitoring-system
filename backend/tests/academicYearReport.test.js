const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveReportScope, buildAcademicYearReport, loadAcademicYearReport } = require('../services/academicYearReport');

const periods = [
  { id: 11, school_year: '2026-2027', semester: '1st Semester', is_active: false, is_primary: false },
  { id: 12, school_year: '2026-2027', semester: '2nd Semester', is_active: true, is_primary: true },
  { id: 13, school_year: '2026-2027', semester: 'Summer', is_active: false, is_primary: false },
  { id: 21, school_year: '2027-2028', semester: '1st Semester', is_active: true, is_primary: false },
  { id: 1, school_year: '2025-2026', semester: '1st Semester', is_active: false, is_primary: false },
];
const files = keys => Object.fromEntries(keys.map(key => [key, { fileName: `${key}.pdf`, status: 'Approved' }]));
const initialFiles = () => files(['tax_exemption', 'valid_id', 'report_card', 'registration_form']);
const continuingFiles = () => files(['grades', 'registration_form']);
const fixture = () => ({
  periods: structuredClone(periods), primaryPeriod: structuredClone(periods[1]),
  applicants: [
    { id: 1, first_name: 'Current', last_name: 'Intake', school_year: '2026-2027', school_id: 2, municipality: 'Daet', barangay: 'A' },
    { id: 2, first_name: 'Continuing', last_name: 'Scholar', school_year: '2025-2026', school_id: 2, municipality: 'Daet', barangay: 'A' },
    { id: 3, first_name: 'Untouched', last_name: 'Account', school_year: '2025-2026', school_id: 1, municipality: 'Daet', barangay: 'B' },
    { id: 4, first_name: 'Next', last_name: 'Intake', school_year: '2027-2028', school_id: 1 },
    { id: 5, first_name: 'Unknown', school_year: null },
  ],
  applications: [
    { applicant_id: 1, school_plan: { course: 'Current course', incomingYearLevel: '1st Year' }, initial_docs: { initialRequirementPeriodId: 11, requirementSets: {
      '11:initial': { academicPeriodId: 11, wave: 'initial', requirements: initialFiles() },
      '12:continuing': { academicPeriodId: 12, wave: 'continuing', requirements: continuingFiles() },
    } } },
    { applicant_id: 2, school_plan: { course: 'Current continuing course', incomingYearLevel: '1st Year' }, initial_docs: { initialRequirementPeriodId: 1, requirementSets: {
      '1:initial': { academicPeriodId: 1, wave: 'initial', requirements: initialFiles() },
      '12:continuing': { academicPeriodId: 12, wave: 'continuing', requirements: continuingFiles() },
    } } },
    { applicant_id: 3, school_plan: { incomingYearLevel: '4th Year' }, initial_docs: { initialRequirementPeriodId: 1, requirementSets: {
      '1:initial': { academicPeriodId: 1, wave: 'initial', requirements: initialFiles() },
    } } },
    { applicant_id: 4, school_plan: {}, initial_docs: {} },
    { applicant_id: 5, school_plan: {}, initial_docs: {} },
  ],
  scholarAccounts: [{ applicant_id: 1, is_active: false }, { applicant_id: 2, is_active: true }, { applicant_id: 3, is_active: true }],
  requirements: [
    { id: 1, applicant_id: 1, billing_period_id: 11, school_id: 1, year_level: '1st Year', updated_at: new Date('2027-11-01') },
    { id: 2, applicant_id: 1, billing_period_id: 12, school_id: 1, year_level: '2nd Year', updated_at: new Date('2027-05-01') },
    { id: 3, applicant_id: 2, billing_period_id: 12, school_id: 1, year_level: '4th Year' },
    { id: 4, applicant_id: 3, billing_period_id: 1, school_id: 1, year_level: '3rd Year' },
  ],
  schools: [{ id: 1, name: 'Recorded Public School', school_type: 'public' }, { id: 2, name: 'Current Private School', school_type: 'private' }],
  batches: [
    { id: 101, billing_period_id: 11, batch_number: 'PAY-0101', status: 'generated' },
    { id: 102, billing_period_id: 12, batch_number: 'PAY-0102', status: 'generated' },
    { id: 103, billing_period_id: 12, batch_number: 'BILL-0103', status: 'billed' },
    { id: 104, billing_period_id: 999, batch_number: 'LEGACY-LIST', status: 'released' },
    { id: 105, billing_period_id: 21, batch_number: 'PAY-0105', status: 'generated' },
    { id: 106, billing_period_id: 13, batch_number: 'DRAFT', status: 'draft' },
  ],
  claims: [
    { id: 1, applicant_id: 1, payroll_batch_id: 101, claim_amount: '5000.10', tuition_fee_assistance: '3000.10', allowance: '2000.00', claim_status: 'paid', claimed_date: 'private legacy value' },
    { id: 2, applicant_id: 1, payroll_batch_id: 102, claim_amount: '5000.20', tuition_fee_assistance: '3000.20', allowance: '2000.00' },
    { id: 3, applicant_id: 2, payroll_batch_id: 103, claim_amount: '9000.00' },
    { id: 4, applicant_id: 2, payroll_batch_id: 104, claim_amount: '1234.50' },
    { id: 5, applicant_id: 2, payroll_batch_id: 105, claim_amount: '100.00' },
  ],
  exams: [{ id: 1, academic_year: '2026-2027' }, { id: 2, academic_year: '2027-2028' }, { id: 3, academic_year: '2025-2026' }],
  slots: [{ applicant_id: 1, exam_id: 1 }, { applicant_id: 1, exam_id: 1 }, { applicant_id: 2, exam_id: 1 }, { applicant_id: 4, exam_id: 2 }],
  results: [{ applicant_id: 1, exam_id: 1, passed: true }, { applicant_id: 1, exam_id: 1, passed: true }, { applicant_id: 2, exam_id: 1, passed: true }, { applicant_id: 4, exam_id: 2, passed: true }],
  controlAccounts: [{ applicant_id: 1, control_number: 'SYNTHETIC-001' }, { applicant_id: 2, control_number: 'SYNTHETIC-002' }],
  actionGroups: [{ action: 'LOGIN', _count: { action: 1 } }], recentActivity: [{ id: 1n, action: 'LOGIN', description: 'Synthetic access' }],
});
const report = (data = fixture(), requestedYear) => buildAcademicYearReport({ ...data, scope: resolveReportScope(data.periods, data.primaryPeriod, requestedYear) });
const currentPlanningFixture = () => {
  const data = fixture();
  data.periods.forEach(period => { period.is_primary = false; });
  data.primaryPeriod = { id: 31, school_year: '2028-2029', semester: '1st Semester', is_active: true, is_primary: true };
  data.periods.push(data.primaryPeriod);
  data.applications[2].school_plan.incomingYearLevel = '3rd Year';
  for (let offset = 0; offset < 8; offset += 1) {
    const applicantId = 10 + offset;
    data.applicants.push({ id: applicantId, first_name: 'Synthetic', last_name: `Fourth ${offset}`, school_year: '2025-2026', school_id: 2 });
    data.scholarAccounts.push({ applicant_id: applicantId, is_active: offset !== 7 });
    data.applications.push({ applicant_id: applicantId, school_plan: { incomingYearLevel: '4th Year', course: 'Application course' }, initial_docs: {} });
  }
  return data;
};

test('current fourth-year planning includes eight directory Scholars without annual activity or saved requirements', () => {
  const data = currentPlanningFixture(), result = report(data);
  assert.equal(result.fourthYearPlanning.mode, 'current-directory');
  assert.deepEqual(result.fourthYearPlanning.period, { id: 31, schoolYear: '2028-2029', semester: '1st Semester' });
  assert.deepEqual(result.fourthYearPlanning.scholars.map(scholar => scholar.applicantId), [10, 11, 12, 13, 14, 15, 16, 17]);
  assert.equal(result.fourthYearPlanning.scholars.find(scholar => scholar.applicantId === 17).status, 'Inactive');
  assert.equal(result.fourthYearPlanning.scholars.every(scholar => scholar.yearLevelPeriodId === null), true);
  assert.equal(result.processing.scholars, 0);
  assert.deepEqual(result.scholars, []); assert.deepEqual(result.records, []);
  assert.equal(result.processing.payrollEntries, 0); assert.equal(result.processing.certificationEntries, 0);
  assert.deepEqual(result.intake, { applied: 0, scheduled: 0, examined: 0, passed: 0 });
  assert.deepEqual(report(data, '2028-2029').fourthYearPlanning, result.fourthYearPlanning);
});

test('current fourth-year planning uses only the directory semester override and its school/course', () => {
  const data = currentPlanningFixture();
  data.periods.push({ id: 32, school_year: '2028-2029', semester: '2nd Semester', is_active: false, is_primary: false });
  data.applications.find(application => application.applicant_id === 11).school_plan.incomingYearLevel = '3rd Year';
  data.requirements.push(
    { id: 100, applicant_id: 10, billing_period_id: 31, year_level: '3rd Year' },
    { id: 101, applicant_id: 11, billing_period_id: 31, year_level: ' Fourth Year ', school_id: 1, course: 'Saved course' },
    { id: 102, applicant_id: 12, billing_period_id: 31, year_level: null },
    { id: 103, applicant_id: 13, billing_period_id: 21, year_level: 'Graduate' },
    { id: 104, applicant_id: 14, billing_period_id: 31, year_level: '3rd Year' },
    { id: 105, applicant_id: 14, billing_period_id: 32, year_level: '4th Year' },
  );
  const result = report(data), planning = result.fourthYearPlanning.scholars;
  assert.equal(planning.some(scholar => scholar.applicantId === 10 || scholar.applicantId === 14), false);
  assert.equal(planning.some(scholar => scholar.applicantId === 12), true); // Empty value falls back to application.
  assert.equal(planning.some(scholar => scholar.applicantId === 13), true); // Older semester is not the current directory override.
  const saved = planning.find(scholar => scholar.applicantId === 11);
  assert.equal(saved.yearLevelPeriodId, 31); assert.equal(saved.school, 'Recorded Public School'); assert.equal(saved.course, 'Saved course');
  assert.equal(result.scholars.find(scholar => scholar.applicantId === 14).yearLevel, '4th Year'); // Annual record ordering stays unchanged.
  assert.equal(result.scope.periodIds.includes(32), true); // Archived semester still belongs to the annual report.
});

test('current fourth-year planning preserves directory truthiness, excludes unknown levels and deduplicates existing people', () => {
  const data = currentPlanningFixture();
  data.scholarAccounts.push({ ...data.scholarAccounts.find(scholar => scholar.applicant_id === 10) });
  data.requirements.push({ id: 100, applicant_id: 11, billing_period_id: 31, year_level: ' ' });
  data.applications.find(application => application.applicant_id === 12).school_plan.incomingYearLevel = null;
  data.applicants.find(applicant => applicant.id === 13).deleted_at = new Date('2028-01-01');
  data.applications.find(application => application.applicant_id === 14).school_plan.incomingYearLevel = 'Not fourth year';
  const planning = report(data).fourthYearPlanning.scholars;
  assert.equal(planning.filter(scholar => scholar.applicantId === 10).length, 1);
  assert.equal(planning.some(scholar => [11, 12, 13, 14].includes(scholar.applicantId)), false);
  for (const scholar of planning) for (const field of ['initial_docs', 'fileUrl', 'email', 'claim_amount', 'claimed_date', 'claim_status']) assert.equal(field in scholar, false, field);
});

test('current directory planning does not populate historical or all-year reports from application fallbacks', () => {
  const data = currentPlanningFixture();
  const historical = report(data, '2026-2027');
  assert.deepEqual(historical.fourthYearPlanning, { mode: 'recorded-years', period: null, scholars: historical.scholars.filter(scholar => scholar.yearLevel === '4th Year') });
  assert.equal(historical.fourthYearPlanning.scholars.some(scholar => scholar.applicantId >= 10), false);
  const all = report(data, 'all');
  assert.equal(all.fourthYearPlanning.mode, 'recorded-years'); assert.equal(all.fourthYearPlanning.period, null);
  assert.equal(all.fourthYearPlanning.scholars.some(scholar => scholar.applicantId >= 10), false);
  const baseline = fixture(); baseline.primaryPeriod = data.primaryPeriod; baseline.periods = data.periods;
  const before = report(baseline, '2026-2027');
  assert.deepEqual(historical.processing, before.processing);
  assert.deepEqual(historical.intake, before.intake);
  assert.deepEqual(historical.records, before.records);
});

test('fourth-year planning falls back to saved-year records when no active directory period exists', () => {
  const data = currentPlanningFixture();
  data.primaryPeriod.is_active = false;
  const inactive = report(data, '2028-2029');
  assert.deepEqual(inactive.fourthYearPlanning, { mode: 'recorded-years', period: null, scholars: [] });
  data.primaryPeriod = null;
  assert.deepEqual(report(data).fourthYearPlanning, inactive.fourthYearPlanning);
  const activeFallback = currentPlanningFixture(); activeFallback.primaryPeriod.is_primary = false;
  assert.equal(report(activeFallback).fourthYearPlanning.scholars.length, 8);
  assert.equal(report(activeFallback).fourthYearPlanning.mode, 'current-directory');
});

test('default report uses primary school year with all semesters, including archived semesters', () => {
  const result = report();
  assert.equal(result.scope.schoolYear, '2026-2027');
  assert.equal(result.scope.defaultSchoolYear, '2026-2027');
  assert.equal(result.scope.defaultSource, 'primary');
  assert.deepEqual(result.scope.periodIds, [13, 12, 11]);
  assert.equal(result.scope.includesArchived, true);
  assert.equal(result.period.semester, 'All semesters');
  assert.equal(result.processing.scholars, 2);
  assert.equal(result.processing.payrollListed, 1);
  assert.equal(result.processing.payrollEntries, 2);
  assert.equal(result.records.filter(row => row.listStatus === 'Payroll listed').reduce((sum, row) => sum + Math.round(row.payrollAmount * 100), 0), 1000030);
  assert.equal(result.lists.payrollLists, 2); // The empty Summer draft is not a generated list.
});

test('intake and continuing processing use separate year membership and deduplicate people', () => {
  const result = report();
  assert.deepEqual(result.intake, { applied: 1, scheduled: 1, examined: 1, passed: 1 });
  assert.deepEqual(result.scholars.map(scholar => scholar.applicantId), [2, 1]);
  assert.equal(result.processing.certificationListed, 1);
  assert.equal(result.records.some(row => row.applicantId === 3), false); // Active account alone is not annual activity.
  assert.equal(result.scholars.find(scholar => scholar.applicantId === 1).status, 'Inactive'); // Current status is informational.
});

test('historical year has stable counts and saved amounts after primary change or deactivation', () => {
  const before = report(fixture(), '2026-2027');
  const changed = fixture(); changed.primaryPeriod = changed.periods[3];
  changed.periods.forEach(period => { period.is_primary = period.id === 21; if (period.school_year === '2026-2027') period.is_active = false; });
  const after = report(changed, '2026-2027');
  assert.deepEqual(after.processing, before.processing);
  assert.deepEqual(after.intake, before.intake);
  assert.deepEqual(after.records.map(row => [row.id, row.payrollAmount, row.tuitionAmount, row.allowanceAmount]), before.records.map(row => [row.id, row.payrollAmount, row.tuitionAmount, row.allowanceAmount]));
});

test('all years truly includes other configured years and clearly identified unscoped legacy list entries', () => {
  const result = report(fixture(), 'all');
  assert.equal(result.scope.schoolYear, 'All School Years');
  assert.equal(result.intake.applied, 5);
  assert.equal(result.processing.scholars, 3);
  assert.equal(result.processing.payrollEntries, 4);
  const legacy = result.records.find(row => row.reference === 'LEGACY-LIST');
  assert.equal(legacy.schoolYear, 'Legacy period');
  assert.equal(legacy.payrollAmount, 1234.5);
  assert.equal(report().records.some(row => row.reference === 'LEGACY-LIST'), false);
});

test('readiness counts real recorded waves independently of current status, opening state and school transfer', () => {
  const data = fixture();
  data.applications[0].initial_docs.requirementWaves = { 12: { continuingOpenedAt: null } };
  const result = report(data);
  assert.equal(result.processing.requirementSets, 3); // Two waves for one Scholar, one continuing wave for another.
  assert.equal(result.processing.requirementsClearedSets, 3);
  assert.equal(result.scholars.find(scholar => scholar.applicantId === 1).school, 'Current Private School');
  const incomplete = fixture();
  incomplete.applications[0].initial_docs.requirementSets['12:continuing'].requirements = files(['report_card', 'registration_form']);
  assert.equal(report(incomplete).processing.requirementsClearedSets, 2); // Continuing requires college grades.
  incomplete.requirements[2].school_id = 2;
  assert.equal(report(incomplete).processing.requirementsClearedSets, 1); // Recorded Private continuing requires tuition receipt.
  incomplete.requirements[0].school_id = null;
  assert.equal(report(incomplete).processing.requirementsClearedSets, 0); // Missing recorded classification is unknown.
});

test('year level comes from latest chronological saved semester, never original application or another year', () => {
  const result = report();
  assert.equal(result.scholars.find(scholar => scholar.applicantId === 1).yearLevel, '2nd Year');
  const data = fixture(); data.requirements[1].year_level = null; data.requirements[0].year_level = null;
  assert.equal(report(data).scholars.find(scholar => scholar.applicantId === 1).yearLevel, null);
  assert.equal(report(fixture(), '2027-2028').scholars.find(scholar => scholar.applicantId === 2).yearLevel, null);
});

test('duplicate saved memberships, proposed grants and invalid breakdowns cannot inflate monetary report', () => {
  const data = fixture(); data.claims.push({ ...data.claims[0] });
  data.requirements[0].billing_amount = 999999; data.requirements[0].list_amount_override = 999999;
  data.claims[1].allowance = '1.00';
  const result = report(data);
  assert.equal(result.processing.payrollEntries, 2);
  const row = result.records.find(item => item.reference === 'PAY-0102');
  assert.equal(row.payrollAmount, 5000.2);
  assert.equal(row.breakdownStatus, 'Not recorded');
  assert.equal(row.allowanceAmount, null);
  for (const item of result.records) for (const key of ['claimed_date', 'claim_status', 'initial_docs', 'fileUrl', 'claim_amount']) assert.equal(key in item, false, key);
});

test('empty and absent configured years remain honest and invalid scopes fail clearly', () => {
  const data = fixture(); data.periods.push({ id: 31, school_year: '2028-2029', semester: '1st Semester', is_active: false });
  const empty = report(data, '2028-2029');
  assert.deepEqual(empty.intake, { applied: 0, scheduled: 0, examined: 0, passed: 0 });
  assert.equal(empty.processing.scholars, 0); assert.deepEqual(empty.records, []);
  assert.throws(() => report(data, '2024-2025'), error => error.statusCode === 404);
  for (const value of ['bad', '2026-2028', ['2026-2027'], {}]) assert.throws(() => report(data, value), error => error.statusCode === 400);
  const noPeriods = report({ ...fixture(), periods: [], primaryPeriod: null });
  assert.equal(noPeriods.scope.schoolYear, null); assert.equal(noPeriods.intake.applied, 0); assert.deepEqual(noPeriods.records, []);
  assert.equal(noPeriods.scope.defaultSchoolYear, null); assert.equal(noPeriods.scope.defaultSource, null);
  assert.equal(report({ ...fixture(), primaryPeriod: null }).scope.schoolYear, '2027-2028');
  const configuredFallback = resolveReportScope(periods, null, '2025-2026');
  assert.equal(configuredFallback.schoolYear, '2025-2026');
  assert.equal(configuredFallback.defaultSchoolYear, '2027-2028');
  assert.equal(configuredFallback.defaultSource, 'configured');
  const activeFallback = resolveReportScope(periods, { ...periods[1], is_primary: false });
  assert.equal(activeFallback.schoolYear, '2026-2027');
  assert.equal(activeFallback.primarySchoolYear, null); // A fallback is never presented as a real primary.
  assert.equal(activeFallback.defaultSchoolYear, '2026-2027');
  assert.equal(activeFallback.defaultSource, 'active');
  const explicitWithFallback = resolveReportScope(periods, { ...periods[1], is_primary: false }, '2027-2028');
  assert.equal(explicitWithFallback.schoolYear, '2027-2028');
  assert.equal(explicitWithFallback.defaultSchoolYear, '2026-2027');
  assert.equal(explicitWithFallback.defaultSource, 'active');
});

const matches = (row, where = {}) => Object.entries(where).every(([key, expected]) => {
  if (expected && typeof expected === 'object' && Array.isArray(expected.in)) return expected.in.includes(row[key]);
  return row[key] === expected;
});
const facade = data => {
  const calls = [];
  const model = (name, rows) => ({ findMany: async (query = {}) => {
    calls.push({ name, query }); return rows.filter(row => matches(row, query.where));
  } });
  const client = {
    academic_periods: { ...model('academic_periods', data.periods), findFirst: async query => data.periods.find(period => matches(period, query.where)) || null },
    applicants: model('applicants', data.applicants.map(applicant => ({ ...applicant, deleted_at: null }))),
    scholar_accounts: model('scholar_accounts', data.scholarAccounts), scholar_requirements: model('scholar_requirements', data.requirements),
    schools: model('schools', data.schools), payroll_batches: model('payroll_batches', data.batches), exams: model('exams', data.exams),
    application_submissions: model('application_submissions', data.applications), payroll_claims: model('payroll_claims', data.claims),
    exam_slots: model('exam_slots', data.slots), results: model('results', data.results), control_accounts: model('control_accounts', data.controlAccounts),
    activity_logs: { ...model('activity_logs', data.recentActivity), groupBy: async () => data.actionGroups },
  };
  return { client, calls };
};

test('current planning loader includes directory application levels without broadening annual requirements or writing records', async () => {
  const { client, calls } = facade(currentPlanningFixture());
  const result = await loadAcademicYearReport(client, '2028-2029');
  assert.equal(result.fourthYearPlanning.scholars.length, 8);
  assert.deepEqual(calls.find(call => call.name === 'scholar_requirements').query.where.billing_period_id.in, [31]);
  assert.equal(calls.filter(call => call.name === 'scholar_requirements').length, 1);
  assert.equal(result.processing.scholars, 0); assert.deepEqual(result.records, []);
  assert.equal(calls.find(call => call.name === 'applicants').query.select.email, undefined);
});

test('loader reads all selected semester IDs, keeps prior intake participants and queries only supported membership fields', async () => {
  const { client, calls } = facade(fixture());
  const result = await loadAcademicYearReport(client);
  assert.equal(result.processing.payrollEntries, 2); assert.equal(result.processing.scholars, 2);
  assert.deepEqual(calls.find(call => call.name === 'scholar_requirements').query.where.billing_period_id.in, [13, 12, 11]);
  assert.deepEqual(calls.find(call => call.name === 'payroll_claims').query.select, { id: true, payroll_batch_id: true, applicant_id: true, claim_amount: true, tuition_fee_assistance: true, allowance: true });
  assert.equal(result.audit.recent[0].id, '1');
  const all = await loadAcademicYearReport(client, 'all');
  assert.equal(all.processing.payrollEntries, 4);
});

test('unscoped legacy document approvals do not get attributed to the current primary year', () => {
  const data = fixture(); data.applications[2].initial_docs = { requirements: initialFiles() };
  data.requirements = data.requirements.filter(requirement => requirement.applicant_id !== 3);
  assert.equal(report(data).scholars.some(scholar => scholar.applicantId === 3), false);
  assert.equal(report(data).processing.requirementSets, 3);
});

test('later applications retain distinct older period documents, while latest same-period review wins', () => {
  const data = fixture();
  data.applications.unshift({ applicant_id: 1, school_plan: { course: 'Later current course', incomingYearLevel: '2nd Year' }, initial_docs: { requirementSets: {
    '21:continuing': { academicPeriodId: 21, wave: 'continuing', requirements: continuingFiles() },
  } } });
  const retained = report(data, '2026-2027');
  assert.equal(retained.processing.requirementSets, 3);
  assert.equal(retained.processing.requirementsClearedSets, 3); // Original first-year report card remains valid.
  assert.equal(retained.scholars.find(scholar => scholar.applicantId === 1).course, 'Later current course');
  data.applications.unshift({ applicant_id: 1, school_plan: {}, initial_docs: { requirementSets: {
    '12:continuing': { academicPeriodId: 12, wave: 'continuing', requirements: { ...continuingFiles(), grades: { fileName: 'new.pdf', status: 'Pending' } } },
  } } });
  assert.equal(report(data, '2026-2027').processing.requirementsClearedSets, 2);
});
