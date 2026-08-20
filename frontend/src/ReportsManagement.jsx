import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChartColumn,
  ChevronDown,
  ClipboardCheck,
  Download,
  GraduationCap,
  MapPin,
  RefreshCw,
  Search,
  TriangleAlert,
  UsersRound,
} from 'lucide-react';
import { API_BASE, authHeaders } from './services/api';
import CsvExportModal from './components/CsvExportModal';
import { downloadCsv } from './utils/csvExport';
import municipalitiesData from '../../municipality.json';
import barangaysData from '../../brgy.json';

const normalizeLocation = (value) => String(value || '').trim().toLowerCase();

const municipalityByCode = new Map(
  municipalitiesData.map((municipality) => [municipality.code, municipality.name]),
);

const isGraduating = (yearLevel) => /(?:graduating|4th\s*year|fourth\s*year)/i.test(String(yearLevel || ''));

const reportExportColumns = [
  { key: 'coverageLocation', label: 'Location', group: 'Priority locations', value: (record) => record.location },
  { key: 'coverageMunicipality', label: 'Municipality', group: 'Priority locations', value: (record) => record.municipality },
  { key: 'coverageType', label: 'Type', group: 'Priority locations', value: (record) => record.type },
  { key: 'activeScholars', label: 'Active Scholars', group: 'Priority locations', value: (record) => record.count },
  { key: 'coverageStatus', label: 'Coverage Status', group: 'Priority locations', value: (record) => record.count === 0 ? 'No scholars' : record.count <= 2 ? 'Low coverage' : 'Covered' },
  { key: 'graduateControlNumber', label: 'Control Number', group: 'Graduating scholars', value: (record) => record.controlNumber },
  { key: 'graduateName', label: 'Name', group: 'Graduating scholars', value: (record) => record.name },
  { key: 'graduateSchool', label: 'School', group: 'Graduating scholars', value: (record) => record.school },
  { key: 'graduateCourse', label: 'Course', group: 'Graduating scholars', value: (record) => record.course },
  { key: 'graduateYearLevel', label: 'Year Level', group: 'Graduating scholars', value: (record) => record.yearLevel },
  { key: 'graduateMunicipality', label: 'Municipality', group: 'Graduating scholars', value: (record) => record.municipality },
];

function CoverageStatus({ count }) {
  const tone = count === 0 ? 'none' : count <= 2 ? 'low' : 'covered';
  return (
    <span className={`reports-coverage-status ${tone}`}>
      {count === 0 ? 'No scholars' : count <= 2 ? 'Low coverage' : 'Covered'}
    </span>
  );
}

export default function ReportsManagement({ token }) {
  const [scholars, setScholars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [schoolYear, setSchoolYear] = useState('All School Years');
  const [locationLevel, setLocationLevel] = useState('municipality');
  const [coverageFilter, setCoverageFilter] = useState('attention');
  const [expandedMunicipality, setExpandedMunicipality] = useState(null);
  const [lifecycleReport, setLifecycleReport] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);

  const loadReports = useCallback(async ({ showLoader = false } = {}) => {
    if (showLoader) setLoading(true);
    try {
      const lifecycleQuery = schoolYear === 'All School Years' ? '' : `?schoolYear=${encodeURIComponent(schoolYear)}`;
      const [scholarResponse, lifecycleResponse] = await Promise.all([
        fetch(`${API_BASE}/scholars/management`, { headers: authHeaders(token), cache: 'no-store' }),
        fetch(`${API_BASE}/reports/lifecycle${lifecycleQuery}`, { headers: authHeaders(token), cache: 'no-store' }),
      ]);
      const [scholarBody, lifecycleBody] = await Promise.all([scholarResponse.json(), lifecycleResponse.json()]);
      if (!scholarResponse.ok) throw new Error(scholarBody.message || 'Unable to load report data.');
      setScholars(scholarBody.scholars || []);
      if (!lifecycleResponse.ok) throw new Error(lifecycleBody.message || 'Unable to load lifecycle audit data.');
      setLifecycleReport(lifecycleBody);
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to load report data.');
    } finally {
      setLoading(false);
    }
  }, [schoolYear, token]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => loadReports({ showLoader: true }), 0);
    const refreshTimer = window.setInterval(loadReports, 30000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(refreshTimer);
    };
  }, [loadReports]);

  const schoolYears = useMemo(() => [...new Set([
    ...scholars.map((scholar) => scholar.schoolYear),
    ...(lifecycleReport?.periods || []).map((period) => period.schoolYear),
  ].filter(Boolean))].sort().reverse(), [lifecycleReport, scholars]);

  const activeScholars = useMemo(() => scholars.filter((scholar) => (
    scholar.status === 'Active'
      && (schoolYear === 'All School Years' || scholar.schoolYear === schoolYear)
  )), [scholars, schoolYear]);

  const coverageRows = useMemo(() => {
    const counts = new Map();
    activeScholars.forEach((scholar) => {
      const municipality = normalizeLocation(scholar.municipality);
      const barangay = normalizeLocation(scholar.barangay);
      if (municipality) counts.set(`municipality:${municipality}`, (counts.get(`municipality:${municipality}`) || 0) + 1);
      if (municipality && barangay) counts.set(`barangay:${municipality}:${barangay}`, (counts.get(`barangay:${municipality}:${barangay}`) || 0) + 1);
    });

    if (locationLevel === 'municipality') {
      return municipalitiesData.map((municipality) => ({
        id: municipality.code,
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
        location: barangay.name,
        municipality,
        type: 'Barangay',
        count: counts.get(`barangay:${normalizeLocation(municipality)}:${normalizeLocation(barangay.name)}`) || 0,
      };
    });
  }, [activeScholars, locationLevel]);

  const barangayCoverageByMunicipality = useMemo(() => {
    const counts = new Map();
    activeScholars.forEach((scholar) => {
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
  }, [activeScholars]);

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
      return matchesQuery && matchesCoverage;
    })
    .sort((left, right) => left.count - right.count || left.location.localeCompare(right.location)), [barangayCoverageByMunicipality, coverageFilter, coverageRows, locationLevel, query]);

  const graduatingScholars = useMemo(() => activeScholars
    .filter((scholar) => isGraduating(scholar.yearLevel))
    .sort((left, right) => left.name.localeCompare(right.name)), [activeScholars]);

  const municipalityCounts = useMemo(() => {
    const counts = new Map();
    activeScholars.forEach((scholar) => {
      const key = normalizeLocation(scholar.municipality);
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    });
    return municipalitiesData.map((municipality) => counts.get(normalizeLocation(municipality.name)) || 0);
  }, [activeScholars]);

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
    activeScholars.forEach((scholar) => {
      const label = String(scholar.yearLevel || 'Not specified').trim() || 'Not specified';
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    const preferredOrder = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Graduate', 'Not specified'];
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
  }, [activeScholars]);

  const barangayAttentionCount = useMemo(() => {
    const counts = new Map();
    activeScholars.forEach((scholar) => {
      const key = `${normalizeLocation(scholar.municipality)}:${normalizeLocation(scholar.barangay)}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return barangaysData.filter((barangay) => {
      const municipality = municipalityByCode.get(barangay.municipalityCode) || '';
      return (counts.get(`${normalizeLocation(municipality)}:${normalizeLocation(barangay.name)}`) || 0) <= 2;
    }).length;
  }, [activeScholars]);

  const exportReport = (selectedColumns) => {
    const coverageColumns = selectedColumns.filter(({ group }) => group === 'Priority locations');
    const graduateColumns = selectedColumns.filter(({ group }) => group === 'Graduating scholars');
    const rows = [['Scholar Coverage Report'], ['School Year', schoolYear]];
    if (coverageColumns.length) {
      rows.push([], ['Priority Locations'], coverageColumns.map(({ label }) => label));
      rows.push(...filteredCoverage.map((record) => coverageColumns.map(({ value }) => value(record))));
    }
    if (graduateColumns.length) {
      rows.push([], ['Graduating Scholars'], graduateColumns.map(({ label }) => label));
      rows.push(...graduatingScholars.map((record) => graduateColumns.map(({ value }) => value(record))));
    }
    downloadCsv({ filename: `pgceap-priority-report-${schoolYear.replace(/\s+/g, '-').toLowerCase()}.csv`, rows });
  };

  return (
    <div className="reports-management">
      <header className="reports-heading">
        <div>
          <p className="reports-eyebrow">DECISION SUPPORT</p>
          <h1>Reports and Insights</h1>
          <span>Identify underserved locations and scholars approaching graduation.</span>
        </div>
        <div className="reports-heading-actions">
          <label><span>School year</span><select value={schoolYear} onChange={(event) => { setSchoolYear(event.target.value); setExpandedMunicipality(null); }}><option>All School Years</option>{schoolYears.map((year) => <option key={year}>{year}</option>)}</select></label>
          <button type="button" onClick={() => setExportOpen(true)} disabled={loading}><Download size={16} /> Export CSV</button>
        </div>
      </header>

      <section className="reports-metrics" aria-label="Report summary">
        <article className="green"><div><span>Active Scholars</span><strong>{activeScholars.length}</strong><small>Included in this report</small></div><i><UsersRound size={22} /></i></article>
        <article className="red"><div><span>Municipalities with None</span><strong>{municipalityCounts.filter((count) => count === 0).length}</strong><small>Need immediate coverage</small></div><i><MapPin size={22} /></i></article>
        <article className="orange"><div><span>Barangays with Low / None</span><strong>{barangayAttentionCount}</strong><small>Two scholars or fewer</small></div><i><ChartColumn size={22} /></i></article>
        <article className="blue"><div><span>Graduating Scholars</span><strong>{graduatingScholars.length}</strong><small>For admin notification</small></div><i><GraduationCap size={22} /></i></article>
      </section>

      {loadError && (
        <div className="reports-error" role="status">
          <TriangleAlert size={17} />
          <span>{loadError}</span>
          <button type="button" onClick={() => loadReports({ showLoader: true })}><RefreshCw size={14} /> Retry</button>
        </div>
      )}

      {lifecycleReport && (
        <section className="reports-lifecycle-grid" aria-label="Scholar lifecycle audit">
          <article className="reports-surface reports-lifecycle-card">
            <header><div><h2>Scholar lifecycle</h2><p>{lifecycleReport.period.schoolYear} · {lifecycleReport.period.semester}</p></div><span><ClipboardCheck size={16} /> Auditable flow</span></header>
            <div className="reports-funnel">
              {[
                ['Applied', lifecycleReport.funnel.applied],
                ['Scheduled', lifecycleReport.funnel.scheduled],
                ['Examined', lifecycleReport.funnel.examined],
                ['Passed', lifecycleReport.funnel.passed],
                ['Scholars', lifecycleReport.funnel.scholars],
                ['Requirements cleared', lifecycleReport.funnel.requirementsCleared],
                ['Billed', lifecycleReport.funnel.billed],
                ['Paid', lifecycleReport.funnel.paid],
              ].map(([label, count], index, stages) => {
                const maximum = Math.max(1, ...stages.map(([, value]) => value));
                return <div key={label}><span><strong>{label}</strong><em>{count}</em></span><i><b style={{ width: `${(count / maximum) * 100}%` }} /></i></div>;
              })}
            </div>
          </article>
        </section>
      )}

      <section className="reports-analytics-grid" aria-label="Scholar analytics">
        <article className="reports-surface reports-chart-card reports-municipality-chart">
          <header><div><h2>Scholar distribution</h2><p>Top municipalities by active scholar count.</p></div><span>Municipality</span></header>
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
          <header><div><h2>Scholars by year level</h2><p>Current academic composition.</p></div></header>
          <div className="reports-year-bars">
            {yearLevelDistribution.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <div><i style={{ width: `${activeScholars.length ? (item.count / activeScholars.length) * 100 : 0}%` }} /></div>
                <strong>{item.count}</strong>
              </div>
            ))}
            {!loading && !yearLevelDistribution.length && <div className="reports-mini-empty">No year-level data available.</div>}
          </div>
        </article>
      </section>

      <section className="reports-content-grid">
        <article className="reports-surface reports-coverage-panel">
          <header><div><h2>Priority locations</h2><p>Barangays and municipalities needing scholarship outreach.</p></div><span>{filteredCoverage.length} locations</span></header>
          <div className="reports-table-tools">
            <label className="reports-search"><div><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search municipality or barangay" /></div></label>
            <select aria-label="Location level" value={locationLevel} onChange={(event) => { setLocationLevel(event.target.value); setExpandedMunicipality(null); }}><option value="municipality">Municipalities</option><option value="barangay">Barangays</option></select>
            <select aria-label="Coverage priority" value={coverageFilter} onChange={(event) => { setCoverageFilter(event.target.value); setExpandedMunicipality(null); }}><option value="attention">Low or no scholars</option><option value="none">No scholars only</option><option value="low">Low coverage only</option></select>
          </div>
          <div className="reports-table-wrap">
            <table>
              <thead><tr><th>Location</th><th>{locationLevel === 'municipality' ? 'Barangay coverage' : 'Municipality'}</th><th>Active scholars</th><th>Priority</th></tr></thead>
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

        <article className="reports-surface reports-graduating-panel">
          <header><div><h2>Graduating scholars</h2><p>Active fourth-year scholars for admin notification.</p></div><span>{graduatingScholars.length}</span></header>
          <div className="reports-graduate-list">
            {graduatingScholars.map((scholar) => (
              <div className="reports-graduate-row" key={scholar.applicantId}>
                <i>{scholar.initials || 'SC'}</i>
                <div><strong>{scholar.name}</strong><span>{scholar.school}</span><small>{scholar.course || 'Course not specified'} · {scholar.municipality}</small></div>
                <em>{scholar.yearLevel}</em>
              </div>
            ))}
            {!loading && !graduatingScholars.length && <div className="reports-empty compact"><GraduationCap size={24} /><strong>No graduating scholars found</strong><span>No active fourth-year scholars match this school year.</span></div>}
          </div>
        </article>
      </section>
      {exportOpen && <CsvExportModal title="Export reports and insights" description="Choose columns from the priority-location and graduating-scholar report sections." columns={reportExportColumns} rowCount={filteredCoverage.length + graduatingScholars.length} getRowCount={(columns) => (columns.some(({ group }) => group === 'Priority locations') ? filteredCoverage.length : 0) + (columns.some(({ group }) => group === 'Graduating scholars') ? graduatingScholars.length : 0)} onClose={() => setExportOpen(false)} onExport={exportReport} />}
    </div>
  );
}
