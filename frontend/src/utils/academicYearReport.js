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

export const fourthYearPlanningView = (report) => {
  const planning = report?.fourthYearPlanning;
  const currentDirectory = planning?.mode === 'current-directory';
  const scopeLabel = currentDirectory
    ? `Current Scholar directory · ${planning.period.schoolYear} · ${planning.period.semester}`
    : academicYearScopeLabel(report?.scope);
  return {
    scholars: uniqueReportScholars(planning?.scholars || []).sort((left, right) => left.name.localeCompare(right.name)),
    currentDirectory,
    scopeLabel,
    title: currentDirectory ? 'Fourth-year scholars' : 'Fourth-year records',
    yearLevelLabel: currentDirectory ? 'Current year level' : 'Latest recorded year level',
    metricMeta: currentDirectory ? 'Current Scholar directory' : 'Latest saved year level in scope',
    description: currentDirectory
      ? `${scopeLabel}. Uses saved semester year levels or application year levels when no semester value is saved, including Scholars without recorded activity this year. Names, school, course, locations and account status are current. This planning list does not verify graduation.`
      : `${scopeLabel}. Uses the latest saved year level in the selected years. Names, school, course, locations and account status are current. This planning list does not verify graduation.`,
    emptyDescription: currentDirectory
      ? 'No Scholar in the current directory has a fourth-year level for this semester.'
      : 'No latest recorded fourth-year level matches the selected years.',
  };
};

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
  const planning = body.fourthYearPlanning;
  if (!planning || !['current-directory', 'recorded-years'].includes(planning.mode) || !Array.isArray(planning.scholars)
    || (planning.mode === 'recorded-years' && planning.period !== null)
    || (planning.mode === 'current-directory' && (body.scope.allYears
      || !Number.isInteger(planning.period?.id) || planning.period.id <= 0
      || planning.period.schoolYear !== body.scope.schoolYear || !planning.period.semester
      || !body.scope.periodIds?.includes(planning.period.id)))) {
    throw new Error('The fourth-year report is unavailable. Please refresh after the report update.');
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
