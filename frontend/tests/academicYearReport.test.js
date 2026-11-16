import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_SCHOOL_YEARS, academicYearDefaultLabel, academicYearReportQuery, academicYearScopeLabel, academicYearStageSummaries,
  createAcademicYearReportLoader, fourthYearPlanningView, uniqueReportScholars, validateAcademicYearReport,
} from '../src/utils/academicYearReport.js';
import { filterScholarReportRows, scholarReportColumns, summarizePayrollReport } from '../src/utils/reportScholarSearch.js';

const report = (schoolYear = '2027-2028') => ({
  scope: { schoolYear, primarySchoolYear: '2027-2028', defaultSchoolYear: '2027-2028', defaultSource: 'primary', allYears: schoolYear === ALL_SCHOOL_YEARS, periodIds: [10, 11], includesArchived: true },
  periods: [{ id: 10, schoolYear: '2027-2028', semester: '1st Semester', isActive: false }, { id: 11, schoolYear: '2027-2028', semester: '2nd Semester', isActive: true }],
  scholars: [], records: [],
  fourthYearPlanning: { mode: 'recorded-years', period: null, scholars: [] },
  intake: { applied: 3, scheduled: 2, examined: 1, passed: 1 },
  processing: { scholars: 5, requirementSets: 8, requirementsClearedSets: 6, certificationListed: 2, payrollListed: 4, certificationEntries: 3, payrollEntries: 7 },
});
const response = body => ({ ok: true, json: async () => body });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

test('default requests resolve the primary year while explicit all-years requests include every year', () => {
  assert.equal(academicYearReportQuery(), '');
  assert.equal(academicYearReportQuery('2026-2027'), '?schoolYear=2026-2027');
  assert.equal(academicYearReportQuery(ALL_SCHOOL_YEARS), '?schoolYear=all');
  assert.equal(academicYearReportQuery('unscoped value'), '?schoolYear=unscoped%20value');
  assert.match(academicYearScopeLabel(report().scope), /2027-2028 · 2 semester periods · Includes archived periods/);
  assert.equal(academicYearScopeLabel({ schoolYear: null }), 'No school year configured');
});

test('annual intake and processing retain distinct people and requirement/list entry units', () => {
  const [intake, processing] = academicYearStageSummaries(report());
  assert.equal(intake.title, 'Applicant intake');
  assert.deepEqual(intake.stages.map(([, count]) => count), [3, 2, 1, 1]);
  assert.match(processing.description, /continuing Scholars from earlier intakes/);
  const values = Object.fromEntries(processing.stages);
  assert.equal(values['Scholars with records'], 5);
  assert.equal(values['Requirement sets'], 8);
  assert.equal(values['Cleared requirement sets'], 6);
  assert.equal(values['Payroll-listed Scholars'], 4);
  assert.equal(values['Payroll entries'], 7);
});

test('automatic option labels the actual system default independently of the selected or newest configured year', () => {
  const explicitHistory = report('2025-2026');
  assert.equal(academicYearDefaultLabel(explicitHistory.scope, true), '2027-2028 (Primary school year)');
  const fallback = { schoolYear: '2025-2026', primarySchoolYear: null, defaultSchoolYear: '2026-2027', defaultSource: 'active' };
  assert.equal(academicYearDefaultLabel(fallback, true), '2026-2027 (Active school year)');
  assert.equal(academicYearDefaultLabel({ defaultSchoolYear: '2027-2028', defaultSource: 'configured' }, true), '2027-2028 (Latest configured school year)');
  assert.equal(academicYearDefaultLabel({ defaultSchoolYear: null }, true), 'System default school year unavailable');
  assert.equal(academicYearDefaultLabel(null), 'Loading primary school year…');
});

test('coverage deduplicates participants across semesters without dropping currently inactive accounts', () => {
  const source = [{ applicantId: 1, status: 'Inactive', yearLevel: null }, { applicantId: 2, status: 'Active' }, { applicantId: 1, status: 'Inactive', yearLevel: '4th Year' }];
  const unique = uniqueReportScholars(source);
  assert.equal(unique.length, 2);
  assert.equal(unique.find(row => row.applicantId === 1).status, 'Inactive');
  assert.equal(source.length, 3);
});

test('current fourth-year planning shows all eight directory Scholars without adding annual activity or amounts', () => {
  const body = report();
  body.processing.scholars = 0;
  body.fourthYearPlanning = {
    mode: 'current-directory', period: { id: 11, schoolYear: '2027-2028', semester: '2nd Semester' },
    scholars: Array.from({ length: 8 }, (_, index) => ({ applicantId: index + 1, name: `Synthetic ${index + 1}`, yearLevel: '4th Year', status: index ? 'Active' : 'Inactive' })),
  };
  body.fourthYearPlanning.scholars.push({ ...body.fourthYearPlanning.scholars[0] });
  const original = structuredClone(body);
  const view = fourthYearPlanningView(validateAcademicYearReport(body));
  assert.equal(view.scholars.length, 8);
  assert.equal(view.scholars.find(row => row.applicantId === 1).status, 'Inactive');
  assert.equal(view.title, 'Fourth-year scholars');
  assert.equal(view.metricMeta, 'Current Scholar directory');
  assert.equal(view.yearLevelLabel, 'Current year level');
  assert.match(view.scopeLabel, /2027-2028 · 2nd Semester/);
  assert.match(view.description, /application year levels when no semester value is saved/);
  assert.match(view.description, /without recorded activity this year/);
  assert.match(view.description, /does not verify graduation/);
  assert.equal(body.processing.scholars, 0);
  assert.deepEqual(body.scholars, []);
  assert.deepEqual(body.records, []);
  assert.equal(summarizePayrollReport(body.records).payrollAmount, 0);
  assert.deepEqual(body, original);
});

test('historical and all-years fourth-year views use their saved projection and shared detail/export rows', () => {
  for (const schoolYear of ['2026-2027', ALL_SCHOOL_YEARS]) {
    const body = report(schoolYear);
    body.scholars = [{ applicantId: 9, name: 'Current profile only', yearLevel: '4th Year' }];
    body.fourthYearPlanning.scholars = [{ applicantId: 2, name: 'Saved fourth-year Scholar', yearLevel: 'Fourth Year' }];
    const view = fourthYearPlanningView(validateAcademicYearReport(body, schoolYear));
    assert.deepEqual(view.scholars.map(row => row.applicantId), [2]);
    assert.equal(view.title, 'Fourth-year records');
    assert.equal(view.currentDirectory, false);
    assert.equal(view.yearLevelLabel, 'Latest recorded year level');
    assert.match(view.description, /latest saved year level in the selected years/);
    assert.doesNotMatch(view.description, /application year levels/);
    // Metric details, the list and export consume this same row projection.
    assert.deepEqual(view.scholars.map(row => row.yearLevel), ['Fourth Year']);
  }
  const empty = fourthYearPlanningView(null);
  assert.deepEqual(empty.scholars, []);
  assert.equal(empty.scopeLabel, 'No school year configured');
});

test('missing or mismatched fourth-year planning contracts cannot silently display an empty list', () => {
  const missing = report(); delete missing.fourthYearPlanning;
  assert.throws(() => validateAcademicYearReport(missing), /fourth-year report is unavailable/);
  for (const planning of [
    { mode: 'unknown', period: null, scholars: [] },
    { mode: 'recorded-years', scholars: [] },
    { mode: 'recorded-years', period: null, scholars: null },
    { mode: 'current-directory', period: null, scholars: [] },
    { mode: 'current-directory', period: { id: 9, schoolYear: '2027-2028', semester: '1st Semester' }, scholars: [] },
    { mode: 'current-directory', period: { id: 11, schoolYear: '2026-2027', semester: '2nd Semester' }, scholars: [] },
    { mode: 'current-directory', period: { id: 11, schoolYear: '2027-2028', semester: '' }, scholars: [] },
  ]) {
    const body = report(); body.fourthYearPlanning = planning;
    assert.throws(() => validateAcademicYearReport(body), /fourth-year report is unavailable/);
  }
  const all = report(ALL_SCHOOL_YEARS);
  all.fourthYearPlanning = { mode: 'current-directory', period: { id: 11, schoolYear: ALL_SCHOOL_YEARS, semester: '2nd Semester' }, scholars: [] };
  assert.throws(() => validateAcademicYearReport(all), /fourth-year report is unavailable/);
});

test('annual payroll cards, detail memberships and export rows preserve both semester amounts for one Scholar', () => {
  const base = { applicantId: 1, name: 'Synthetic Scholar', school: 'Current synthetic school', accountStatus: 'Inactive', listStatus: 'Payroll listed', schoolYear: '2027-2028', tuitionAmount: null, allowanceAmount: null, breakdownStatus: 'Not recorded' };
  const rows = [
    { ...base, id: '1:10:PAY-10', reference: 'PAY-10', semester: '1st Semester', payrollAmount: 5000, historical: true },
    { ...base, id: '1:11:PAY-11', reference: 'PAY-11', semester: '2nd Semester', payrollAmount: 5500, historical: false },
    { ...base, id: '1:9:PAY-9', reference: 'PAY-9', schoolYear: '2026-2027', payrollAmount: 4500, historical: true },
  ];
  const selected = filterScholarReportRows(rows, '', '2027-2028', 'payroll');
  const summary = summarizePayrollReport(selected);
  assert.equal(selected.length, 2);
  assert.equal(summary.scholars, 1);
  assert.equal(summary.entries, 2);
  assert.equal(summary.payrollAmount, 10500);
  const amountColumn = scholarReportColumns.find(column => column.key === 'scholar-payrollAmount');
  assert.deepEqual(selected.map(amountColumn.value), [5000, 5500]);
  assert.equal(summarizePayrollReport(filterScholarReportRows(rows, '', ALL_SCHOOL_YEARS, 'payroll')).payrollAmount, 15000);
});

test('responses with an older contract or mismatched year cannot become the selected report', () => {
  assert.throws(() => validateAcademicYearReport({ funnel: {} }), /academic-year report is unavailable/);
  assert.throws(() => validateAcademicYearReport(report('2026-2027'), '2027-2028'), /does not match/);
  assert.equal(validateAcademicYearReport(report(), '' ).scope.schoolYear, '2027-2028');
  assert.equal(validateAcademicYearReport(report(ALL_SCHOOL_YEARS), ALL_SCHOOL_YEARS).scope.allYears, true);
});

test('automatic primary refresh and explicit year selection use the same authenticated report endpoint', async () => {
  const calls = [], loaded = [];
  let primary = '2027-2028';
  const loader = createAcademicYearReportLoader(async (url, options) => { calls.push({ url, options }); return response(report(url.includes('schoolYear=') ? '2026-2027' : primary)); });
  const options = { apiBase: '/api', headers: { Authorization: 'Bearer synthetic' }, onLoaded: body => loaded.push(body.scope.schoolYear) };
  await loader.load(options);
  primary = '2028-2029';
  await loader.load(options);
  await loader.load({ ...options, schoolYear: '2026-2027' });
  assert.deepEqual(loaded, ['2027-2028', '2028-2029', '2026-2027']);
  assert.deepEqual(calls.map(call => call.url), ['/api/reports/lifecycle', '/api/reports/lifecycle', '/api/reports/lifecycle?schoolYear=2026-2027']);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer synthetic');
  assert.equal(calls[0].options.signal.aborted, true);
});

test('a late aborted response cannot overwrite the newer year or finish its loading state', async () => {
  const old = deferred(), next = deferred(), loaded = [], settled = [];
  let calls = 0;
  const loader = createAcademicYearReportLoader(() => (++calls === 1 ? old.promise : next.promise));
  const first = loader.load({ apiBase: '/api', schoolYear: '2026-2027', onLoaded: body => loaded.push(body.scope.schoolYear), onSettled: () => settled.push('old') });
  const second = loader.load({ apiBase: '/api', schoolYear: '2027-2028', onLoaded: body => loaded.push(body.scope.schoolYear), onSettled: () => settled.push('new') });
  next.resolve(response(report('2027-2028')));
  await second;
  old.resolve(response(report('2026-2027')));
  await first;
  assert.deepEqual(loaded, ['2027-2028']);
  assert.deepEqual(settled, ['new']);
});

test('cancellation prevents late failures and unmounted requests from changing report state', async () => {
  const pending = deferred(), errors = [], loaded = [], settled = [];
  const loader = createAcademicYearReportLoader(() => pending.promise);
  const work = loader.load({ apiBase: '/api', onError: value => errors.push(value), onLoaded: value => loaded.push(value), onSettled: () => settled.push(true) });
  loader.cancel();
  pending.reject(new Error('late network failure'));
  await work;
  assert.deepEqual(errors, []);
  assert.deepEqual(loaded, []);
  assert.deepEqual(settled, []);
});
