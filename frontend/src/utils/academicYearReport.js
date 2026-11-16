export const ALL_SCHOOL_YEARS = 'All School Years';

export const academicYearReportQuery = (schoolYear = '') => schoolYear
  ? `?schoolYear=${schoolYear === ALL_SCHOOL_YEARS ? 'all' : encodeURIComponent(schoolYear)}`
  : '';

export const academicYearScopeLabel = (scope) => {
  if (!scope?.schoolYear) return 'No school year configured';
  const periods = scope.periodIds?.length || 0;
  return `${scope.schoolYear} · ${periods} semester period${periods === 1 ? '' : 's'} · Includes archived periods`;
};

export const academicYearDefaultLabel = (scope, hasLoadedReport = false) => {
  const labels = { primary: 'Primary school year', active: 'Active school year', configured: 'Latest configured school year' };
  if (scope?.defaultSchoolYear) return `${scope.defaultSchoolYear} (${labels[scope.defaultSource] || 'System default school year'})`;
  return hasLoadedReport ? 'System default school year unavailable' : 'Loading primary school year…';
};

export const uniqueReportScholars = (scholars = []) => [...new Map(
  scholars.map(scholar => [scholar.applicantId, scholar]),
).values()];

export const academicYearStageSummaries = (report) => [
  { title: 'Applicant intake', description: 'Applicants from the selected intake years; each person is counted once per stage.', stages: [
    ['Applied', report.intake.applied], ['Scheduled', report.intake.scheduled],
    ['Examined', report.intake.examined], ['Passed', report.intake.passed],
  ] },
  { title: 'Scholar processing', description: 'Recorded activity in the selected years, including continuing Scholars from earlier intakes.', stages: [
    ['Scholars with records', report.processing.scholars],
    ['Requirement sets', report.processing.requirementSets],
    ['Cleared requirement sets', report.processing.requirementsClearedSets],
    ['Certification-listed Scholars', report.processing.certificationListed],
    ['Payroll-listed Scholars', report.processing.payrollListed],
    ['Certification entries', report.processing.certificationEntries],
    ['Payroll entries', report.processing.payrollEntries],
  ] },
];

export const validateAcademicYearReport = (body, schoolYear = '') => {
  if (!body?.scope || !Array.isArray(body.records) || !Array.isArray(body.scholars)
    || !Array.isArray(body.periods) || !body.intake || !body.processing) {
    throw new Error('The academic-year report is unavailable. Please refresh after the report update.');
  }
  if (schoolYear && body.scope.schoolYear !== schoolYear) {
    throw new Error('The report does not match the selected school year. Please retry.');
  }
  return body;
};

// Abort and revision checks both protect the selected year: a server or fetch
// facade that completes an aborted request cannot overwrite a newer snapshot.
export const createAcademicYearReportLoader = (fetcher = (...args) => fetch(...args)) => {
  let revision = 0;
  let controller;
  const cancel = () => { revision += 1; controller?.abort(); };
  const load = async ({ apiBase, schoolYear = '', headers, onStart, onLoaded, onError, onSettled }) => {
    cancel();
    const requestRevision = revision;
    controller = new AbortController();
    const signal = controller.signal;
    const current = () => requestRevision === revision && !signal.aborted;
    onStart?.();
    try {
      const response = await fetcher(`${apiBase}/reports/lifecycle${academicYearReportQuery(schoolYear)}`, {
        headers, cache: 'no-store', signal,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to load report data.');
      validateAcademicYearReport(body, schoolYear);
      if (current()) { onLoaded?.(body); return body; }
    } catch (error) {
      if (current()) onError?.(error.message || 'Unable to load report data.');
    } finally {
      if (current()) onSettled?.();
    }
    return null;
  };
  return { load, cancel };
};
