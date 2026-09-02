import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  BookOpenCheck,
  CircleDollarSign,
  Download,
  Eye,
  FileCheck2,
  Filter,
  GraduationCap,
  ReceiptText,
  Search,
  TriangleAlert,
  UsersRound,
  X,
} from 'lucide-react';
import { API_BASE, authHeaders } from './services/api';
import CsvExportModal from './components/CsvExportModal';
import { buildRecordRows, downloadCsv } from './utils/csvExport';

const formatScholarDate = (value) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const scholarExportColumns = [
  { key: 'name', label: 'Scholar Name', group: 'Scholar' },
  { key: 'controlNumber', label: 'Control Number', group: 'Scholar', value: (record) => record.controlNumber || record.scholarId },
  { key: 'email', label: 'Email', group: 'Scholar' },
  { key: 'municipality', label: 'Municipality', group: 'Education & location' },
  { key: 'school', label: 'School', group: 'Education & location' },
  { key: 'barangay', label: 'Barangay', group: 'Education & location' },
  { key: 'schoolYear', label: 'School Year', group: 'Education & location' },
  { key: 'status', label: 'Status', group: 'Record status' },
  { key: 'documentStatus', label: 'Documents', group: 'Record status' },
];

function ScholarBadge({ value, type }) {
  return <span className={`scholar-admin-badge ${type} ${value.toLowerCase().replace(/\s+/g, '-')}`}>{type === 'status' ? <BadgeCheck size={13} /> : <FileCheck2 size={13} />}{value}</span>;
}

export default function ScholarsManagement({ token }) {
  const [scholars, setScholars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [municipality, setMunicipality] = useState('All Municipalities');
  const [school, setSchool] = useState('All Schools');
  const [barangay, setBarangay] = useState('All Barangays');
  const [documentStatus, setDocumentStatus] = useState('All Documents');
  const [selected, setSelected] = useState(null);
  const [drawerTab, setDrawerTab] = useState('overview');
  const [page, setPage] = useState(1);
  const [exportOpen, setExportOpen] = useState(false);
  const pageSize = 10;

  const loadScholars = useCallback(async ({ showLoader = false } = {}) => {
    if (showLoader) setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/scholars/management`, { headers: authHeaders(token) });
      if (!response.ok) throw new Error('Unable to load scholar records.');
      const payload = await response.json();
      const nextScholars = payload.scholars || [];
      setScholars(nextScholars);
      setSelected((current) => current
        ? nextScholars.find((scholar) => scholar.id === current.id) || current
        : null);
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to load scholar records.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const initialLoad = window.setTimeout(loadScholars, 0);
    const timer = window.setInterval(loadScholars, 30000);
    return () => { window.clearTimeout(initialLoad); window.clearInterval(timer); };
  }, [loadScholars]);

  useEffect(() => {
    if (!selected) return undefined;
    const closeOnEscape = (event) => { if (event.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selected]);

  const municipalities = useMemo(() => [...new Set(scholars.map((item) => item.municipality).filter(Boolean))].sort(), [scholars]);
  const schools = useMemo(() => [...new Set(scholars
    .filter((item) => municipality === 'All Municipalities' || item.municipality === municipality)
    .map((item) => item.school)
    .filter(Boolean))].sort(), [scholars, municipality]);
  const barangays = useMemo(() => [...new Set(scholars
    .filter((item) => (municipality === 'All Municipalities' || item.municipality === municipality)
      && (school === 'All Schools' || item.school === school))
    .map((item) => item.barangay)
    .filter(Boolean))].sort(), [scholars, municipality, school]);

  const filtered = useMemo(() => scholars.filter((item) => {
    const searchValue = `${item.name} ${item.controlNumber || ''} ${item.email || ''}`.toLowerCase();
    return searchValue.includes(query.trim().toLowerCase())
      && (municipality === 'All Municipalities' || item.municipality === municipality)
      && (school === 'All Schools' || item.school === school)
      && (barangay === 'All Barangays' || item.barangay === barangay)
      && (documentStatus === 'All Documents' || item.documentStatus === documentStatus);
  }), [scholars, query, municipality, school, barangay, documentStatus]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const activeCount = scholars.filter(({ status }) => status === 'Active').length;
  const completeCount = scholars.filter(({ documentStatus: value }) => value === 'Complete').length;
  const reviewCount = scholars.filter(({ documentStatus: value }) => value === 'Review').length;
  const hasFilters = query || municipality !== 'All Municipalities' || school !== 'All Schools' || barangay !== 'All Barangays' || documentStatus !== 'All Documents';

  const clearFilters = () => {
    setQuery('');
    setMunicipality('All Municipalities');
    setSchool('All Schools');
    setBarangay('All Barangays');
    setDocumentStatus('All Documents');
    setPage(1);
  };

  const paginationItems = [];
  let previousVisiblePage = 0;
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const visible = pageNumber === 1 || pageNumber === pageCount || Math.abs(pageNumber - currentPage) <= 1;
    if (visible) {
      if (pageNumber - previousVisiblePage > 1) paginationItems.push(`ellipsis-${pageNumber}`);
      paginationItems.push(pageNumber);
      previousVisiblePage = pageNumber;
    }
  }

  const metrics = [
    { label: 'Total Scholars', value: scholars.length, detail: 'Registered scholar accounts', tone: 'green', Icon: UsersRound },
    { label: 'Active Scholars', value: activeCount, detail: 'Currently active accounts', tone: 'blue', Icon: GraduationCap },
    { label: 'Documents Complete', value: completeCount, detail: 'Requirements cleared', tone: 'green', Icon: FileCheck2 },
    { label: 'For Review', value: reviewCount, detail: 'Document sets requiring review', tone: 'orange', Icon: BookOpenCheck },
  ];

  return <>
    <div className="scholars-management">
      <header className="scholars-admin-heading"><div><span className="scholars-admin-eyebrow">SCHOLAR RECORDS</span><h2>Scholars Management</h2><p>Manage scholar accounts, review documents, and track status updates.</p></div><button type="button" className="scholars-export" onClick={() => setExportOpen(true)} disabled={!filtered.length}><Download size={15} />Export CSV</button></header>

      <div className="scholars-admin-metrics">{metrics.map(({ label, value, detail, tone, Icon }) => <article className={tone} key={label}><div><span>{label}</span><strong>{loading ? '—' : value}</strong><small>{detail}</small></div><i><Icon size={20} /></i></article>)}</div>

      {loadError && <div className="scholars-admin-alert"><TriangleAlert size={17} /><span>{loadError}</span><button type="button" onClick={() => loadScholars({ showLoader: true })}>Retry</button></div>}

      <section className="scholars-filter-panel">
        <div className="scholars-panel-heading"><div><span className="scholars-filter-icon"><Filter size={15} /></span><div><h3>Filter Scholars</h3><p>Refine the scholar directory by location, school, or document status.</p></div></div>{hasFilters && <button type="button" onClick={clearFilters}><X size={13} />Clear filters</button>}</div>
        <div className="scholars-filters">
          <label className="scholars-filter scholars-search"><span>Search scholars</span><div><Search size={15} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Name, email, or control number" /></div></label>
          <label className="scholars-filter"><span>Municipality</span><select value={municipality} onChange={(event) => { setMunicipality(event.target.value); setSchool('All Schools'); setBarangay('All Barangays'); setPage(1); }}><option>All Municipalities</option>{municipalities.map((option) => <option key={option}>{option}</option>)}</select></label>
          <label className="scholars-filter"><span>School</span><select value={school} onChange={(event) => { setSchool(event.target.value); setBarangay('All Barangays'); setPage(1); }}><option>All Schools</option>{schools.map((option) => <option key={option}>{option}</option>)}</select></label>
          <label className="scholars-filter"><span>Barangay</span><select value={barangay} onChange={(event) => { setBarangay(event.target.value); setPage(1); }}><option>All Barangays</option>{barangays.map((option) => <option key={option}>{option}</option>)}</select></label>
          <label className="scholars-filter"><span>Documents</span><select value={documentStatus} onChange={(event) => { setDocumentStatus(event.target.value); setPage(1); }}><option>All Documents</option><option>Complete</option><option>Review</option></select></label>
        </div>
      </section>

      <div className="scholars-record-count">Showing <strong>{filtered.length}</strong> of <strong>{scholars.length}</strong> scholars</div>
      <section className="scholars-table-card">
        <div className="scholars-table-head"><span>Scholar name</span><span>Control number</span><span>Municipality</span><span>School</span><span>Barangay</span><span>Status</span><span>Documents</span><span>Action</span></div>
        <div className="scholars-table-body">
          {loading && !scholars.length && <div className="scholars-state"><span className="scholars-spinner" />Loading scholar records...</div>}
          {!loading && !loadError && !paginated.length && <div className="scholars-state"><Search size={23} /><strong>No scholars found</strong><span>Adjust the current filters to see more scholar records.</span>{hasFilters && <button type="button" onClick={clearFilters}>Clear filters</button>}</div>}
          {paginated.map((scholar) => <article className="scholars-row" key={scholar.id}>
            <div data-label="Scholar"><span className="scholars-avatar">{scholar.initials}</span><span className="scholars-name"><strong>{scholar.name}</strong><small>{scholar.email}</small></span></div>
            <div data-label="Control number"><code>{scholar.controlNumber || scholar.scholarId}</code></div>
            <div data-label="Municipality"><span>{scholar.municipality}</span></div>
            <div data-label="School"><span className="scholars-school-name" title={scholar.school}>{scholar.school}</span></div>
            <div data-label="Barangay"><span>{scholar.barangay}</span></div>
            <div data-label="Status"><ScholarBadge value={scholar.status} type="status" /></div>
            <div data-label="Documents"><ScholarBadge value={scholar.documentStatus} type="documents" /></div>
            <div data-label="Action"><button type="button" className="scholars-view" aria-label={`View details for ${scholar.name}`} onClick={() => { setSelected(scholar); setDrawerTab('overview'); }}><Eye size={13} />View details</button></div>
          </article>)}
        </div>
        {!!filtered.length && <footer className="scholars-table-footer"><span>Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}</span><nav className="scholars-pagination" aria-label="Scholar pages"><button type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>‹</button>{paginationItems.map((item) => typeof item === 'number' ? <button type="button" key={item} aria-label={`Page ${item}`} className={item === currentPage ? 'active' : ''} aria-current={item === currentPage ? 'page' : undefined} onClick={() => setPage(item)}>{item}</button> : <span key={item}>…</span>)}<button type="button" aria-label="Next page" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>›</button></nav></footer>}
      </section>
    </div>
    {exportOpen && <CsvExportModal title="Export scholar records" description="Choose which scholar fields to include. The current directory filters will be preserved." columns={scholarExportColumns} rowCount={filtered.length} onClose={() => setExportOpen(false)} onExport={(columns) => downloadCsv({ filename: `scholars-${new Date().toISOString().slice(0, 10)}.csv`, rows: buildRecordRows(filtered, columns) })} />}

    {selected && (
      <div className="scholars-drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
        <aside className="scholars-drawer" role="dialog" aria-modal="true" aria-labelledby="scholar-detail-title">
          <button type="button" className="scholars-drawer-close" onClick={() => setSelected(null)} aria-label="Close scholar details"><X size={19} /></button>
          <div className="scholars-drawer-profile"><span className="scholars-drawer-avatar">{selected.initials}</span><div><span className="scholars-admin-eyebrow">SCHOLAR RECORD</span><h3 id="scholar-detail-title">{selected.name}</h3><p>{selected.scholarId}</p></div></div>
          <div className="scholars-drawer-badges"><ScholarBadge value={selected.status} type="status" /><ScholarBadge value={selected.documentStatus} type="documents" /></div>

          <nav className="scholars-drawer-tabs" role="tablist" aria-label="Scholar record sections">
            <button type="button" role="tab" aria-selected={drawerTab === 'overview'} className={drawerTab === 'overview' ? 'active' : ''} onClick={() => setDrawerTab('overview')}><GraduationCap size={15} />Overview</button>
            <button type="button" role="tab" aria-selected={drawerTab === 'finance'} className={drawerTab === 'finance' ? 'active' : ''} onClick={() => setDrawerTab('finance')}><CircleDollarSign size={15} />Billing &amp; Payroll</button>
          </nav>

          {drawerTab === 'overview' ? (
            <div className="scholars-drawer-tab-panel" role="tabpanel">
              <section className="scholars-detail-section"><h4>Scholar information</h4><dl><div><dt>Email address</dt><dd>{selected.email || 'Not provided'}</dd></div><div><dt>School year</dt><dd>{selected.schoolYear || '2026-2027'}</dd></div><div><dt>Issued</dt><dd>{formatScholarDate(selected.issuedAt)}</dd></div></dl></section>
              <section className="scholars-detail-section"><h4>Education and location</h4><dl><div><dt>School</dt><dd>{selected.school}</dd></div><div><dt>Course</dt><dd>{selected.course || 'Not specified'}</dd></div><div><dt>Year level</dt><dd>{selected.yearLevel || 'Not specified'}</dd></div><div><dt>Municipality</dt><dd>{selected.municipality}</dd></div><div><dt>Barangay</dt><dd>{selected.barangay}</dd></div></dl></section>
              <section className="scholars-detail-section"><h4>Document checklist</h4><div className="scholars-document-list">{selected.documents.map((document) => <div key={document.label}><span>{document.label}</span><strong className={document.submitted ? document.status.toLowerCase() : 'not-submitted'}>{document.submitted ? document.status : 'Not submitted'}</strong></div>)}</div></section>
              {selected.notes && <section className="scholars-detail-section"><h4>Account notes</h4><p className="scholars-notes">{selected.notes}</p></section>}
            </div>
          ) : (
            <div className="scholars-drawer-tab-panel" role="tabpanel">
              <section className="scholars-finance-summary">
                <article className={selected.processRoute !== 'billing' || selected.billed ? 'complete' : 'pending'}><i><ReceiptText size={19} /></i><div><span>Billing status</span><strong>{selected.billingStatus}</strong><small>{selected.processRoute === 'billing' ? (selected.billed ? 'Included in a billing record' : 'Waiting for billing processing') : 'Public-school scholars bypass Billing'}</small></div></article>
                <article className={selected.processRoute !== 'payroll' || selected.inPayroll ? 'complete' : 'pending'}><i><CircleDollarSign size={19} /></i><div><span>Payroll-list status</span><strong>{selected.payrollStatus}</strong><small>{selected.processRoute === 'payroll' ? (selected.inPayroll ? 'Included in the generated payroll list' : 'Waiting for payroll-list generation') : 'Private-school scholars do not continue to Payroll'}</small></div></article>
              </section>
              <section className="scholars-detail-section scholars-finance-details"><h4>Processing details</h4><dl><div><dt>School year / semester</dt><dd>{selected.schoolYearSemester || `${selected.schoolYear || '2026-2027'} · ${selected.semester || '1st Semester'}`}</dd></div><div><dt>School classification</dt><dd>{selected.schoolType}</dd></div><div><dt>Assigned route</dt><dd>{selected.processRoute === 'billing' ? 'Billing only' : 'Direct to Payroll'}</dd></div><div><dt>Date processed</dt><dd>{selected.dateProcessed ? formatScholarDate(selected.dateProcessed) : 'Not processed'}</dd></div><div><dt>Billing record</dt><dd>{selected.billingStatus}</dd></div><div><dt>Payroll list</dt><dd>{selected.payrollStatus}</dd></div><div><dt>Batch status</dt><dd>{selected.batchStatus || 'Not assigned'}</dd></div></dl></section>
              {!!selected.financialHistory?.filter((record) => !record.isActivePeriod).length && <section className="scholars-detail-section"><h4>Previous period history</h4><div className="scholars-finance-history">{selected.financialHistory.filter((record) => !record.isActivePeriod).map((record) => <article key={`${record.academicPeriodId}-${record.dateProcessed}`}><div><strong>{record.schoolYear} · {record.semester}</strong><span>{record.billingStatus} · {record.payrollStatus}</span></div><div><strong>{record.processRoute === 'billing' ? 'Billing record' : 'Payroll-list record'}</strong><span>{record.dateProcessed ? formatScholarDate(record.dateProcessed) : 'Not processed'}</span></div></article>)}</div></section>}
              <div className="scholars-finance-note"><CircleDollarSign size={17} /><div><strong>Live processing status</strong><span>This status follows the scholar’s school-classification route and refreshes automatically.</span></div></div>
            </div>
          )}
        </aside>
      </div>
    )}
  </>;
}
