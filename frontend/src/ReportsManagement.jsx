import ReportScholarSearch from './components/ReportScholarSearch';
import ReportsTabs from './components/ReportsTabs';
import { filterScholarReportRows, scholarReportColumns, summarizePayrollReport } from './utils/reportScholarSearch';
import { ALL_SCHOOL_YEARS, academicYearDefaultLabel, academicYearScopeLabel, academicYearStageSummaries, createAcademicYearReportLoader, fourthYearPlanningView, overviewPopulationView } from './utils/academicYearReport';
import MetricDetailsCard from './components/MetricDetailsCard';
import ReportLocationFilters from './components/ReportLocationFilters';
import { getReportBarangayOptions, matchesReportLocation, getReportLocationLevel } from './utils/reportLocationFilters';
import './styles/report-location-filters.css';
import Notification from './components/Notification';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChartColumn,
  ChevronDown,
  ClipboardCheck,
  Download,
  GraduationCap,
  MapPin,
  RefreshCw,
  UsersRound,
} from 'lucide-react';
import { API_BASE, authHeaders } from './services/api';
import CsvExportModal from './components/CsvExportModal';
import { downloadReportWorkbook } from './utils/reportWorkbook';
import { ROUTINE_DATA_REFRESH_MS, subscribeToVisibleRefresh } from './utils/dataRefresh';
import municipalitiesData from '../../municipality.json';
import barangaysData from '../../brgy.json';

const normalizeLocation = (value) => String(value || '').trim().toLowerCase();

const municipalityByCode = new Map(
  municipalitiesData.map((municipality) => [municipality.code, municipality.name]),
);

const reportExportColumns = [
  ...scholarReportColumns,
  { key: 'coverageLocation', label: 'Location', group: 'Priority locations', value: (record) => record.location },
  { key: 'coverageMunicipality', label: 'Municipality', group: 'Priority locations', value: (record) => record.municipality },
  { key: 'coverageType', label: 'Type', group: 'Priority locations', value: (record) => record.type },
  { key: 'recordedScholars', label: 'Scholar count', group: 'Priority locations', value: (record) => record.count },
  { key: 'coverageStatus', label: 'Coverage Status', group: 'Priority locations', value: (record) => record.count === 0 ? 'No scholars' : record.count <= 2 ? 'Low coverage' : 'Covered' },
  { key: 'graduateControlNumber', label: 'Control Number', group: 'Fourth-year records', value: (record) => record.controlNumber },
  { key: 'graduateName', label: 'Current Name', group: 'Fourth-year records', value: (record) => record.name },
  { key: 'graduateSchool', label: 'Current School', group: 'Fourth-year records', value: (record) => record.school },
  { key: 'graduateCourse', label: 'Current Course', group: 'Fourth-year records', value: (record) => record.course },
  { key: 'graduateYearLevel', label: 'Year level', group: 'Fourth-year records', value: (record) => record.yearLevel || 'Not recorded' },
  { key: 'graduateMunicipality', label: 'Current Municipality', group: 'Fourth-year records', value: (record) => record.municipality },
];

function CoverageStatus({ count }) {
  const tone = count === 0 ? 'none' : count <= 2 ? 'low' : 'covered';
  return (
    <span className={`reports-coverage-status ${tone}`}>
      {count === 0 ? 'No scholars' : count <= 2 ? 'Low coverage' : 'Covered'}
    </span>
  );
}

export function AcademicYearStages({ report }) {
  const summaries = academicYearStageSummaries(report);
  return <section className="reports-lifecycle-grid" aria-label="Annual intake and Scholar processing">
    {summaries.map(summary => <article className="reports-surface reports-lifecycle-card" key={summary.title}>
      <header><div><h2>{summary.title}</h2><p>{academicYearScopeLabel(report.scope)}</p><p>{summary.description}</p></div><span><ClipboardCheck size={16} /> Annual records</span></header>
      <div className="reports-funnel">
        {summary.stages.map(([label, count]) => {
          const maximum = Math.max(1, ...summary.stages.map(([, value]) => value));
          return <div key={label}><span><strong>{label}</strong><em>{count}</em></span><i><b style={{ width: `${(count / maximum) * 100}%` }} /></i></div>;
        })}
      </div>
    </article>)}
  </section>;
}

export default function ReportsManagement({ token }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [hasLoadedReport, setHasLoadedReport] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [query, setQuery] = useState('');
  const [scholarQuery, setScholarQuery] = useState('');
  const [scholarPage, setScholarPage] = useState(1);
  const [reportListType, setReportListType] = useState('all');
  const [schoolYear, setSchoolYear] = useState('');
  const [reportLoader] = useState(createAcademicYearReportLoader);
  const [municipalityFilter, setMunicipalityFilter] = useState('');
  const [barangayFilter, setBarangayFilter] = useState('');
  const locationLevel = getReportLocationLevel(municipalityFilter);
  const barangayOptions = useMemo(() => getReportBarangayOptions(barangaysData, municipalityFilter), [municipalityFilter]);
  const [coverageFilter, setCoverageFilter] = useState('attention');
  const [expandedMunicipality, setExpandedMunicipality] = useState(null);
  const [lifecycleReport, setLifecycleReport] = useState(null);
  const [loadedRequestKey, setLoadedRequestKey] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  const requestKey = JSON.stringify([schoolYear, token]);
  const loadReports = useCallback(() => reportLoader.load({
    apiBase: API_BASE, schoolYear, headers: authHeaders(token),
    onStart: () => { setLoading(true); setLoadError(''); },
    onLoaded: (body) => {
      setLifecycleReport(body);
      setLoadedRequestKey(requestKey);
      setHasLoadedReport(true);
    },
    onError: setLoadError,
    onSettled: () => setLoading(false),
  }), [reportLoader, requestKey, schoolYear, token]);

  useEffect(() => {
    const initialLoad = window.setTimeout(loadReports, 0);
    const stopRefreshing = subscribeToVisibleRefresh(loadReports, { intervalMs: ROUTINE_DATA_REFRESH_MS });
    return () => {
      window.clearTimeout(initialLoad);
      stopRefreshing();
      reportLoader.cancel();
    };
  }, [loadReports, reportLoader]);

  const reportIsCurrent = loadedRequestKey === requestKey;
  const reportReady = reportIsCurrent && !loading && !loadError;
  const effectiveSchoolYear = schoolYear || lifecycleReport?.scope.schoolYear || '';
  const scopeLabel = academicYearScopeLabel(lifecycleReport?.scope);
  const scholarReportRows = useMemo(() => reportIsCurrent ? lifecycleReport?.records || [] : [], [lifecycleReport, reportIsCurrent]);
  const filteredScholarRows = useMemo(() => filterScholarReportRows(scholarReportRows, scholarQuery, effectiveSchoolYear, reportListType), [scholarReportRows, scholarQuery, effectiveSchoolYear, reportListType]);

  const schoolYears = useMemo(() => [...new Set([
    ...scholarReportRows.map(row => row.schoolYear),
    ...(lifecycleReport?.periods || []).map((period) => period.schoolYear),
  ].filter(year => year && year !== 'Legacy period'))].sort().reverse(), [lifecycleReport, scholarReportRows]);

  const overviewView = useMemo(() => overviewPopulationView(reportIsCurrent ? lifecycleReport : null), [lifecycleReport, reportIsCurrent]);
  const populationScholars = overviewView.scholars;
  const automaticYearLabel = academicYearDefaultLabel(lifecycleReport?.scope, hasLoadedReport);
  const coverageDescription = `${overviewView.description} Directory/location filters are not applied to these summary totals.`;

  const coverageRows = useMemo(() => {
    const counts = new Map();
    populationScholars.forEach((scholar) => {
      const municipality = normalizeLocation(scholar.municipality);
      const barangay = normalizeLocation(scholar.barangay);
      if (municipality) counts.set(`municipality:${municipality}`, (counts.get(`municipality:${municipality}`) || 0) + 1);
      if (municipality && barangay) counts.set(`barangay:${municipality}:${barangay}`, (counts.get(`barangay:${municipality}:${barangay}`) || 0) + 1);
    });

    if (locationLevel === 'municipality') {
      return municipalitiesData.map((municipality) => ({
        id: municipality.code,
        municipalityCode: municipality.code,
        location: municipality.name,
        municipality: municipality.name,
        type: 'Municipality',
        count: counts.get(`municipality:${normalizeLocation(municipality.name)}`) || 0,
      }));
    }

    return barangaysData.map((barangay) => {
      const municipality = municipalityByCode.get(barangay.municipalityCode) || 'Not specified';
      return {
        id: barangay.code,
        municipalityCode: barangay.municipalityCode,
        location: barangay.name,
        municipality,
        type: 'Barangay',
        count: counts.get(`barangay:${normalizeLocation(municipality)}:${normalizeLocation(barangay.name)}`) || 0,
      };
    });
  }, [populationScholars, locationLevel]);

  const barangayCoverageByMunicipality = useMemo(() => {
    const counts = new Map();
    populationScholars.forEach((scholar) => {
      const municipality = normalizeLocation(scholar.municipality);
      const barangay = normalizeLocation(scholar.barangay);
      if (municipality && barangay) {
        const key = `${municipality}:${barangay}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    });
    const grouped = new Map();
    barangaysData.forEach((barangay) => {
      const municipality = municipalityByCode.get(barangay.municipalityCode) || 'Not specified';
      const key = normalizeLocation(municipality);
      const rows = grouped.get(key) || [];
      rows.push({
        id: barangay.code,
        name: barangay.name,
        count: counts.get(`${key}:${normalizeLocation(barangay.name)}`) || 0,
      });
      grouped.set(key, rows);
    });
    grouped.forEach((rows) => rows.sort((left, right) => right.count - left.count || left.name.localeCompare(right.name)));
    return grouped;
  }, [populationScholars]);

  const filteredCoverage = useMemo(() => coverageRows
    .filter((row) => {
      const normalizedQuery = query.trim().toLowerCase();
      const relatedBarangays = locationLevel === 'municipality'
        ? barangayCoverageByMunicipality.get(normalizeLocation(row.municipality)) || []
        : [];
      const matchesQuery = !normalizedQuery
        || `${row.location} ${row.municipality}`.toLowerCase().includes(normalizedQuery)
        || relatedBarangays.some((barangay) => barangay.name.toLowerCase().includes(normalizedQuery));
      const matchesCoverage = coverageFilter === 'none'
        ? row.count === 0
        : coverageFilter === 'low'
          ? row.count > 0 && row.count <= 2
          : row.count <= 2;
      return matchesQuery && matchesCoverage && matchesReportLocation(row, municipalityFilter, barangayFilter);
    })
    .sort((left, right) => left.count - right.count || left.location.localeCompare(right.location)), [barangayCoverageByMunicipality, coverageFilter, coverageRows, locationLevel, query, municipalityFilter, barangayFilter]);

  const fourthYearView = useMemo(() => fourthYearPlanningView(reportIsCurrent ? lifecycleReport : null), [lifecycleReport, reportIsCurrent]);
  const fourthYearScholars = fourthYearView.scholars;

  const municipalityCounts = useMemo(() => {
    const counts = new Map();
    populationScholars.forEach((scholar) => {
      const key = normalizeLocation(scholar.municipality);
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    });
    return municipalitiesData.map((municipality) => counts.get(normalizeLocation(municipality.name)) || 0);
  }, [populationScholars]);

  const municipalityDistribution = useMemo(() => municipalitiesData.map((municipality, index) => ({
    name: municipality.name,
    count: municipalityCounts[index] || 0,
  })).sort((left, right) => right.count - left.count || left.name.localeCompare(right.name)), [municipalityCounts]);

  const municipalityCoverage = useMemo(() => ({
    none: municipalityCounts.filter((count) => count === 0).length,
    low: municipalityCounts.filter((count) => count > 0 && count <= 2).length,
    covered: municipalityCounts.filter((count) => count > 2).length,
  }), [municipalityCounts]);

  const yearLevelDistribution = useMemo(() => {
    const counts = new Map();
    populationScholars.forEach((scholar) => {
      const label = String(scholar.yearLevel || overviewView.missingYearLevelLabel).trim() || overviewView.missingYearLevelLabel;
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    const preferredOrder = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Graduate', overviewView.missingYearLevelLabel];
    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => {
        const leftIndex = preferredOrder.indexOf(left.label);
        const rightIndex = preferredOrder.indexOf(right.label);
        if (leftIndex === -1 && rightIndex === -1) return left.label.localeCompare(right.label);
        if (leftIndex === -1) return 1;
        if (rightIndex === -1) return -1;
        return leftIndex - rightIndex;
      });
  }, [populationScholars, overviewView.missingYearLevelLabel]);

  const barangayAttentionCount = useMemo(() => {
    const counts = new Map();
    populationScholars.forEach((scholar) => {
      const key = `${normalizeLocation(scholar.municipality)}:${normalizeLocation(scholar.barangay)}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return barangaysData.filter((barangay) => {
      const municipality = municipalityByCode.get(barangay.municipalityCode) || '';
      return (counts.get(`${normalizeLocation(municipality)}:${normalizeLocation(barangay.name)}`) || 0) <= 2;
    }).length;
  }, [populationScholars]);

  const exportReport = async (selectedColumns) => {
    if (exporting || !reportReady || !lifecycleReport?.scope.schoolYear) return;
    setExporting(true);
    setExportError('');
    try {
      const coverageColumns = selectedColumns.filter(({ group }) => group === 'Priority locations');
      const scholarColumns = selectedColumns.filter(({ group }) => group === 'Scholar records');
      const graduateColumns = selectedColumns.filter(({ group }) => group === 'Fourth-year records');
      const rows = [['Scholar Academic Year Report'], ['School Year', effectiveSchoolYear], ['Period Scope', scopeLabel],
        ['Coverage Scope', overviewView.description], ['Overview Scholar Count', populationScholars.length],
        ['Profile Scope', 'Names, school, course, account status and locations are current.']];
      const headerRows = [];
      const addTable = (columns, records) => {
        headerRows.push(rows.length + 1);
        rows.push(columns.map(({ label }) => label));
        rows.push(...records.map(record => columns.map(({ value }) => value(record))));
      };
      if (scholarColumns.length) {
        const payrollSummary = summarizePayrollReport(filteredScholarRows);
        rows.push([], ['Scholar Records'], ['Scholar Search', scholarQuery], ['List Status Filter', reportListType]);
        if (scholarColumns.some(column => ['scholar-payrollAmount', 'scholar-tuitionAmount', 'scholar-allowanceAmount'].includes(column.key))) {
          rows.push(['Payroll List Amount (PHP)', payrollSummary.payrollAmount], ['Recorded Tuition Assistance (PHP)', payrollSummary.tuitionAmount], ['Recorded Allowance (PHP)', payrollSummary.allowanceAmount], ['Payroll Entries Without Amount', payrollSummary.missingAmounts], ['Payroll Entries Without Breakdown', payrollSummary.missingBreakdowns]);
        }
        addTable(scholarColumns, filteredScholarRows);
      }
      if (coverageColumns.length) {
        rows.push([], ['Priority Locations']);
        addTable(coverageColumns, filteredCoverage);
      }
      if (graduateColumns.length) {
        rows.push([], [fourthYearView.title], ['Fourth-year Scope', fourthYearView.description]);
        addTable(graduateColumns, fourthYearScholars);
      }
      await downloadReportWorkbook({ filename: `${scholarColumns.length && !coverageColumns.length && !graduateColumns.length ? 'pgceap-scholar-records' : 'pgceap-priority-report'}-${effectiveSchoolYear.replace(/\s+/g, '-').toLowerCase()}.xlsx`, rows, headerRows });
    } catch {
      setExportError('Unable to export the Excel workbook. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="reports-management">
      {reportReady && lifecycleReport?.scope.schoolYear && <ReportsTabs activeTab={activeTab} onChange={setActiveTab} />}
      <header className="reports-heading">
        <div>
          <p className="reports-eyebrow">DECISION SUPPORT</p>
          <h1>Reports and Insights</h1>
          <span>Search scholar records, review payroll list amounts and explore scholarship coverage.</span>
        </div>
        <div className="reports-heading-actions">
          <label><span>School year</span><select aria-label="Report school year" value={schoolYear} disabled={exporting} onChange={(event) => { reportLoader.cancel(); setLoading(true); setLoadError(''); setSchoolYear(event.target.value); setScholarPage(1); setExpandedMunicipality(null); setExportOpen(false); }}><option value="">{automaticYearLabel}</option><option value={ALL_SCHOOL_YEARS}>All School Years</option>{schoolYears.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
          <button type="button" onClick={() => setExportOpen(true)} disabled={exporting || !reportReady || !lifecycleReport?.scope.schoolYear}><Download size={16} /> {exporting ? 'Exporting…' : 'Export XLSX'}</button>
        </div>
      </header>

      {exportError && <Notification tone="error" title="Export failed">{exportError}</Notification>}
      {loadError && (
        <Notification tone="error" title="Unable to load reports" action={<button type="button" onClick={loadReports}><RefreshCw size={14} /> Retry</button>}>{loadError}</Notification>
      )}

      {loading && <Notification tone="progress" title="Loading academic-year report">Please wait while the selected year's records are loaded.</Notification>}
      {reportReady && !lifecycleReport?.scope.schoolYear && <Notification tone="info" title="No academic year configured">Create an academic period in Settings to start a school-year report.</Notification>}
      {reportReady && lifecycleReport?.scope.schoolYear && <>
      <p className="reports-tab-scope">{scopeLabel}</p>
      <div className="reports-tab-panel" role="tabpanel" id="reports-panel-overview" aria-labelledby="reports-tab-overview" hidden={activeTab !== 'overview'} tabIndex={0}>
      <div className="report-coverage-heading"><h2>Coverage and program overview</h2><p>{overviewView.description} Directory, location and list-status filters do not change overview totals.</p></div>
      <section className="reports-metrics" aria-label="Report summary">
        <MetricDetailsCard title={overviewView.title} rows={populationScholars.map(scholar => ({ ...scholar, yearLevel: String(scholar.yearLevel || '').trim() || overviewView.missingYearLevelLabel }))} columns={[{ key: 'name', label: 'Current Name' }, { key: 'controlNumber', label: 'Control no.' }, { key: 'municipality', label: 'Current Municipality' }, { key: 'status', label: 'Current account status' }, { key: 'yearLevel', label: overviewView.yearLevelLabel }]} description={coverageDescription} className="green"><div><span>{overviewView.title}</span><strong>{populationScholars.length}</strong><small>{overviewView.metricMeta}</small></div><i><UsersRound size={22} /></i></MetricDetailsCard>
        <MetricDetailsCard title='Municipalities with None' rows={municipalityDistribution.filter(row => row.count === 0).map(row => ({ location: row.name, count: row.count }))} description={coverageDescription} columns={[{ key: 'location', label: 'Current Location' }, { key: 'count', label: 'Scholar count' }]} className="red"><div><span>Municipalities with None</span><strong>{municipalityCounts.filter((count) => count === 0).length}</strong><small>{overviewView.currentDirectory ? 'No Scholars in the current directory' : 'No recorded-year scholars'}</small></div><i><MapPin size={22} /></i></MetricDetailsCard>
        <MetricDetailsCard title='Barangays with Low / None' rows={[...barangayCoverageByMunicipality.entries()].flatMap(([municipality, rows]) => rows.filter(row => row.count <= 2).map(row => ({ location: row.name, municipality: municipalitiesData.find(item => normalizeLocation(item.name) === municipality)?.name || municipality, count: row.count })))} description={coverageDescription} columns={[{ key: 'location', label: 'Current Location' }, { key: 'municipality', label: 'Current Municipality' }, { key: 'count', label: 'Scholar count' }]} className="orange"><div><span>Barangays with Low / None</span><strong>{barangayAttentionCount}</strong><small>{overviewView.currentDirectory ? 'Two Scholars or fewer' : 'Two recorded-year scholars or fewer'}</small></div><i><ChartColumn size={22} /></i></MetricDetailsCard>
        <MetricDetailsCard title={fourthYearView.title} rows={fourthYearScholars} columns={[{ key: 'name', label: 'Current Name' }, { key: 'controlNumber', label: 'Control no.' }, { key: 'municipality', label: 'Current Municipality' }, { key: 'yearLevel', label: fourthYearView.yearLevelLabel }]} description={fourthYearView.description} className="blue"><div><span>{fourthYearView.title}</span><strong>{fourthYearScholars.length}</strong><small>{fourthYearView.metricMeta}</small></div><i><GraduationCap size={22} /></i></MetricDetailsCard>
      </section>
      <section className="reports-analytics-grid" aria-label="Scholar analytics">
        <article className="reports-surface reports-chart-card reports-municipality-chart">
          <header><div><h2>Scholar distribution</h2><p>{overviewView.distributionDescription}</p></div><span>Municipality</span></header>
          <div className="reports-horizontal-chart">
            {municipalityDistribution.slice(0, 6).map((item) => {
              const maximum = municipalityDistribution[0]?.count || 1;
              return (
                <div className="reports-bar-row" key={item.name}>
                  <span title={item.name}>{item.name}</span>
                  <div><i style={{ width: `${item.count ? Math.max((item.count / maximum) * 100, 7) : 0}%` }} /></div>
                  <strong>{item.count}</strong>
                </div>
              );
            })}
          </div>
        </article>

        <article className="reports-surface reports-chart-card reports-donut-card">
          <header><div><h2>Municipality coverage</h2><p>Coverage based on the two-scholar threshold.</p></div></header>
          <div className="reports-donut-content">
            <div
              className="reports-donut"
              style={{
                background: `conic-gradient(#db5b52 0 ${(municipalityCoverage.none / municipalityCounts.length) * 100}%, #e7a244 ${(municipalityCoverage.none / municipalityCounts.length) * 100}% ${((municipalityCoverage.none + municipalityCoverage.low) / municipalityCounts.length) * 100}%, #2c9c5d ${((municipalityCoverage.none + municipalityCoverage.low) / municipalityCounts.length) * 100}% 100%)`,
              }}
              role="img"
              aria-label={`${municipalityCoverage.none} municipalities with no scholars, ${municipalityCoverage.low} with low coverage, and ${municipalityCoverage.covered} covered`}
            >
              <div><strong>{municipalityCounts.length}</strong><span>municipalities</span></div>
            </div>
            <div className="reports-chart-legend">
              <div><i className="none" /><span>No scholars</span><strong>{municipalityCoverage.none}</strong></div>
              <div><i className="low" /><span>Low coverage</span><strong>{municipalityCoverage.low}</strong></div>
              <div><i className="covered" /><span>Covered</span><strong>{municipalityCoverage.covered}</strong></div>
            </div>
          </div>
        </article>

        <article className="reports-surface reports-chart-card reports-year-chart">
          <header><div><h2>Scholars by {overviewView.currentDirectory ? 'year level' : 'recorded year level'}</h2><p>{overviewView.yearLevelDescription}</p></div></header>
          <div className="reports-year-bars">
            {yearLevelDistribution.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <div><i style={{ width: `${populationScholars.length ? (item.count / populationScholars.length) * 100 : 0}%` }} /></div>
                <strong>{item.count}</strong>
              </div>
            ))}
            {!loading && !yearLevelDistribution.length && <div className="reports-mini-empty">No year-level data available.</div>}
          </div>
        </article>
      </section>
      </div>

      <div className="reports-tab-panel" role="tabpanel" id="reports-panel-lifecycle" aria-labelledby="reports-tab-lifecycle" hidden={activeTab !== 'lifecycle'} tabIndex={0}>
        <AcademicYearStages report={lifecycleReport} />
      </div>

      <div className="reports-tab-panel" role="tabpanel" id="reports-panel-coverage" aria-labelledby="reports-tab-coverage" hidden={activeTab !== 'coverage'} tabIndex={0}>
        <article className="reports-surface reports-coverage-panel">
          <header><div><h2>Priority locations</h2><p>Barangays and municipalities needing scholarship outreach.</p></div><span>{filteredCoverage.length} locations</span></header>
          <ReportLocationFilters municipalities={municipalitiesData} barangays={barangayOptions} municipality={municipalityFilter} barangay={barangayFilter}
            query={query} coverage={coverageFilter}
            onMunicipalityChange={(value) => { setMunicipalityFilter(value); setBarangayFilter(''); setExpandedMunicipality(null); }}
            onBarangayChange={(value) => { setBarangayFilter(value); setExpandedMunicipality(null); }}
            onQueryChange={setQuery} onCoverageChange={(value) => { setCoverageFilter(value); setExpandedMunicipality(null); }} />
          <div className="reports-table-wrap">
            <table>
              <thead><tr><th>Current Location</th><th>{locationLevel === 'municipality' ? 'Barangay coverage' : 'Municipality'}</th><th>Scholar count</th><th>Priority</th></tr></thead>
              <tbody>
                {filteredCoverage.map((row) => {
                  const municipalityKey = normalizeLocation(row.municipality);
                  const barangays = barangayCoverageByMunicipality.get(municipalityKey) || [];
                  const isExpandable = locationLevel === 'municipality';
                  const isExpanded = isExpandable && expandedMunicipality === row.id;
                  const barangaysNeedingCoverage = barangays.filter((barangay) => barangay.count <= 2).length;
                  const barangaysWithScholars = barangays.filter((barangay) => barangay.count > 0).length;
                  return (
                    <Fragment key={row.id}>
                      <tr
                        className={isExpandable ? `reports-location-row clickable${isExpanded ? ' expanded' : ''}` : 'reports-location-row'}
                        onClick={isExpandable ? () => setExpandedMunicipality(isExpanded ? null : row.id) : undefined}
                        onKeyDown={isExpandable ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setExpandedMunicipality(isExpanded ? null : row.id);
                          }
                        } : undefined}
                        tabIndex={isExpandable ? 0 : undefined}
                        aria-expanded={isExpandable ? isExpanded : undefined}
                      >
                        <td><div className="reports-location-name"><span><strong>{row.location}</strong><small>{row.type}{isExpandable ? ' · Click to view barangays' : ''}</small></span>{isExpandable && <ChevronDown size={15} />}</div></td>
                        <td>{isExpandable ? <span className="reports-barangay-summary"><strong>{barangaysNeedingCoverage}</strong> of {barangays.length} need coverage</span> : row.municipality}</td>
                        <td>{row.count}</td>
                        <td><CoverageStatus count={row.count} /></td>
                      </tr>
                      {isExpanded && (
                        <tr className="reports-barangay-expanded-row">
                          <td colSpan="4">
                            <div className="reports-barangay-dropdown">
                              <header><div><strong>Barangay coverage in {row.location}</strong><span>Populated barangays are shown first, followed by barangays with no scholars.</span></div><em>{barangaysWithScholars} with scholars · {barangays.length - barangaysWithScholars} without</em></header>
                              <div className="reports-barangay-list">
                                {barangays.map((barangay) => (
                                  <div className={barangay.count > 0 ? 'has-scholars' : ''} key={barangay.id}><span><MapPin size={13} />{barangay.name}</span><strong>{barangay.count} {barangay.count === 1 ? 'scholar' : 'scholars'}</strong><CoverageStatus count={barangay.count} /></div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {!loading && !filteredCoverage.length && <div className="reports-empty"><MapPin size={24} /><strong>No matching priority locations</strong><span>Adjust the coverage filters to see more locations.</span></div>}
            {loading && <div className="reports-empty"><RefreshCw className="reports-spin" size={24} /><strong>Loading coverage report</strong></div>}
          </div>
        </article>
      </div>

      <div className="reports-tab-panel" role="tabpanel" id="reports-panel-fourth-year" aria-labelledby="reports-tab-fourth-year" hidden={activeTab !== 'fourth-year'} tabIndex={0}>
        <article className="reports-surface reports-graduating-panel">
          <header><div><h2>{fourthYearView.title}</h2><p>{fourthYearView.description}</p></div><span>{fourthYearScholars.length}</span></header>
          <div className="reports-graduate-list">
            {fourthYearScholars.map((scholar) => (
              <div className="reports-graduate-row" key={scholar.applicantId}>
                <i>{scholar.initials || 'SC'}</i>
                <div><strong>{scholar.name}</strong><span>{scholar.school}</span><small>{scholar.course || 'Course not specified'} · {scholar.municipality}</small></div>
                <em>{scholar.yearLevel}</em>
              </div>
            ))}
            {!fourthYearScholars.length && <div className="reports-empty compact"><GraduationCap size={24} /><strong>No fourth-year {fourthYearView.currentDirectory ? 'scholars' : 'records'} found</strong><span>{fourthYearView.emptyDescription}</span></div>}
          </div>
        </article>
      </div>

      <div className="reports-tab-panel" role="tabpanel" id="reports-panel-scholars" aria-labelledby="reports-tab-scholars" hidden={activeTab !== 'scholars'} tabIndex={0}>
        <ReportScholarSearch rows={filteredScholarRows} total={filterScholarReportRows(scholarReportRows, '', effectiveSchoolYear, reportListType).length} query={scholarQuery} listType={reportListType} onListType={value => { setReportListType(value); setScholarPage(1); }} onQuery={value => { setScholarQuery(value); setScholarPage(1); }} page={scholarPage} onPage={setScholarPage} onExport={() => exportReport(scholarReportColumns)} disabled={exporting} />
      </div>
      </>}
      {exportOpen && reportReady && <CsvExportModal formatLabel="EXCEL EXPORT" exportLabel="Export XLSX" title="Export reports and insights" description={`Choose columns from scholar records, priority locations and fourth-year planning. Scholar records use the selected academic years, search and list-status filters. ${overviewView.currentDirectory ? 'Coverage includes all Scholars in the current directory, including those without activity this year.' : 'Coverage counts Scholars with recorded activity in the selected academic years.'} ${fourthYearView.currentDirectory ? 'Fourth-year planning matches the current Scholar directory, including application year levels when no semester value is saved.' : 'Fourth-year planning uses the latest saved year levels in the selected years.'} All matching pages are exported.`} columns={reportExportColumns} rowCount={filteredScholarRows.length + filteredCoverage.length + fourthYearScholars.length} getRowCount={(columns) => (columns.some(({ group }) => group === 'Scholar records') ? filteredScholarRows.length : 0) + (columns.some(({ group }) => group === 'Priority locations') ? filteredCoverage.length : 0) + (columns.some(({ group }) => group === 'Fourth-year records') ? fourthYearScholars.length : 0)} onClose={() => setExportOpen(false)} onExport={exportReport} />}
    </div>
  );
}
