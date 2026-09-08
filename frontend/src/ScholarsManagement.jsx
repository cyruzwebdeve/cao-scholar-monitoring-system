import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  BookOpenCheck,
  CalendarRange,
  CircleDollarSign,
  Download,
  Eye,
  FileCheck2,
  Filter,
  GraduationCap,
  ReceiptText,
  Save,
  Search,
  TriangleAlert,
  UsersRound,
  X,
} from 'lucide-react';
import { API_BASE, authHeaders } from './services/api';
import CsvExportModal from './components/CsvExportModal';
import { DecisionModal, ReviewModal } from './DocumentReviewManagement';
import { buildRecordRows, downloadCsv } from './utils/csvExport';
import { saveProcessingHandoff } from './utils/processingHandoff';
import './styles/document-reviews.css';

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

export default function ScholarsManagement({ token, user, onSectionChange }) {
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
  const [academicPeriods, setAcademicPeriods] = useState([]);
  const [billingForm, setBillingForm] = useState({ schoolYear: '', semester: '', billingStatus: 'Not billed yet' });
  const [billingSaving, setBillingSaving] = useState(false);
  const [billingPeriodLoading, setBillingPeriodLoading] = useState(false);
  const [billingEditError, setBillingEditError] = useState('');
  const [documentReview, setDocumentReview] = useState(null);
  const [documentPreview, setDocumentPreview] = useState('');
  const [documentPreviewLoading, setDocumentPreviewLoading] = useState(false);
  const [documentPreviewError, setDocumentPreviewError] = useState('');
  const [documentDecision, setDocumentDecision] = useState('');
  const [documentDecisionError, setDocumentDecisionError] = useState('');
  const [documentSaving, setDocumentSaving] = useState(false);
  const [documentNotice, setDocumentNotice] = useState('');
  const pageSize = 10;
  const canEditBilling = user?.role === 'SuperAdmin'
    || !Array.isArray(user?.sectionAccess)
    || user.sectionAccess.includes('billing');
  const canReviewDocuments = ['SuperAdmin', 'BillingPayrollAdmin'].includes(user?.role)
    && (user?.role === 'SuperAdmin' || !Array.isArray(user?.sectionAccess) || user.sectionAccess.includes('documentReviews'));
  const canOpenSettings = user?.role === 'SuperAdmin'
    || !Array.isArray(user?.sectionAccess)
    || user.sectionAccess.includes('settings');

  const openNewCycleSetup = () => {
    setSelected(null);
    onSectionChange?.('Settings');
  };

  const loadScholars = useCallback(async ({ showLoader = false } = {}) => {
    if (showLoader) setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/scholars/management`, { headers: authHeaders(token) });
      if (!response.ok) throw new Error('Unable to load scholar records.');
      const payload = await response.json();
      const nextScholars = payload.scholars || [];
      setAcademicPeriods(payload.academicPeriods || []);
      setScholars(nextScholars);
      setSelected((current) => current
        ? current.academicPeriodId && current.academicPeriodId !== payload.activePeriod?.id
          ? current
          : nextScholars.find((scholar) => scholar.id === current.id) || current
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
    const closeOnEscape = (event) => { if (event.key === 'Escape' && !documentReview) setSelected(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [documentReview, selected]);

  useEffect(() => () => { if (documentPreview) URL.revokeObjectURL(documentPreview); }, [documentPreview]);

  const closeDocumentReview = useCallback(() => {
    if (documentPreview) URL.revokeObjectURL(documentPreview);
    setDocumentPreview('');
    setDocumentPreviewError('');
    setDocumentDecision('');
    setDocumentDecisionError('');
    setDocumentReview(null);
  }, [documentPreview]);

  const openDocumentReview = async (document) => {
    if (!canReviewDocuments || !document.submitted || !document.applicationId || !document.requirementKey) return;
    if (documentPreview) URL.revokeObjectURL(documentPreview);
    const review = {
      ...document,
      applicantId: selected.applicantId,
      scholarName: selected.name,
      email: selected.email,
      controlNumber: selected.controlNumber,
      municipality: selected.municipality,
      requirementLabel: document.label,
      status: String(document.status || 'pending').toLowerCase(),
      autoAcceptance: false,
    };
    setDocumentReview(review);
    setDocumentPreview('');
    setDocumentPreviewError('');
    setDocumentPreviewLoading(true);
    try {
      const response = await fetch(`${API_BASE}/document-reviews/${document.applicationId}/${document.requirementKey}/file`, { headers: authHeaders(token) });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || 'Unable to open the document.');
      }
      setDocumentPreview(URL.createObjectURL(await response.blob()));
    } catch (error) {
      setDocumentPreviewError(error.message || 'Unable to open the document.');
    } finally {
      setDocumentPreviewLoading(false);
    }
  };

  const saveDocumentDecision = async (notes) => {
    if (!documentReview || !documentDecision) return;
    setDocumentSaving(true);
    setDocumentDecisionError('');
    try {
      const response = await fetch(`${API_BASE}/document-reviews/${documentReview.applicationId}/${documentReview.requirementKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ decision: documentDecision, notes }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'Unable to save the review decision.');
      setDocumentNotice(body.message || 'Document review saved.');
      closeDocumentReview();
      await loadScholars();
    } catch (error) {
      setDocumentDecisionError(error.message || 'Unable to save the review decision.');
    } finally {
      setDocumentSaving(false);
    }
  };

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

  const formFromScholarPeriod = (record, period) => ({
    schoolYear: period?.schoolYear || record.billingSchoolYear || record.schoolYear || '',
    semester: period?.semester || record.billingSemester || record.semester || '',
    billingStatus: ['Pending', 'Not applicable'].includes(record.billingStatus) ? 'Not billed yet' : record.billingStatus || 'Not billed yet',
  });

  const openBillingTab = () => {
    const defaultPeriod = academicPeriods.find((period) => period.id === selected.academicPeriodId)
      || academicPeriods.find((period) => period.id === selected.billingAcademicPeriodId)
      || academicPeriods.find((period) => period.schoolYear === selected.billingSchoolYear && period.semester === selected.billingSemester)
      || academicPeriods.find((period) => period.isPrimary)
      || academicPeriods.find((period) => period.isActive)
      || academicPeriods[0];
    setBillingForm(formFromScholarPeriod(selected, defaultPeriod));
    setBillingEditError('');
    setDrawerTab('finance');
  };

  const activeBillingPeriods = academicPeriods.filter((period) => period.isActive);
  const billingSchoolYears = [...new Set(activeBillingPeriods.map((period) => period.schoolYear))];
  const billingSemesters = activeBillingPeriods
    .filter((period) => period.schoolYear === billingForm.schoolYear)
    .map((period) => period.semester);

  const selectBillingPeriod = async (period) => {
    if (!period || billingPeriodLoading) return;
    setBillingForm((current) => ({ ...current, schoolYear: period.schoolYear, semester: period.semester }));
    setBillingPeriodLoading(true);
    setBillingEditError('');
    try {
      const response = await fetch(`${API_BASE}/scholars/management?academicPeriodId=${encodeURIComponent(period.id)}`, { headers: authHeaders(token), cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'Unable to prepare the selected scholar session.');
      const periodScholar = (body.scholars || []).find((scholar) => scholar.id === selected.id);
      if (!periodScholar) throw new Error('The scholar is unavailable for the selected period.');
      setAcademicPeriods(body.academicPeriods || academicPeriods);
      setSelected(periodScholar);
      setBillingForm(formFromScholarPeriod(periodScholar, body.activePeriod || period));
    } catch (error) {
      setBillingEditError(error.message || 'Unable to prepare the selected scholar session.');
      const currentPeriod = academicPeriods.find((item) => item.id === selected.academicPeriodId);
      setBillingForm(formFromScholarPeriod(selected, currentPeriod));
    } finally {
      setBillingPeriodLoading(false);
    }
  };

  const saveBillingMetadata = async (event) => {
    event.preventDefault();
    if (!selected || billingSaving) return;
    setBillingSaving(true);
    setBillingEditError('');
    try {
      const selectedPeriod = academicPeriods.find((period) => (
        period.schoolYear === billingForm.schoolYear && period.semester === billingForm.semester
      ));
      if (!selectedPeriod) throw new Error('Select a configured school year and semester.');
      const response = await fetch(`${API_BASE}/scholars/${selected.applicantId}/billing-metadata`, {
        method: 'PUT',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ academicPeriodId: selectedPeriod.id, billingStatus: billingForm.billingStatus }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'Unable to update billing and payroll details.');
      const destinationMode = 'billing';
      const handoffSaved = saveProcessingHandoff({ periodId: selectedPeriod.id, applicantId: selected.applicantId, mode: destinationMode });
      if (onSectionChange && handoffSaved) {
        setSelected(null);
        onSectionChange(destinationMode === 'billing' ? 'Billing' : 'Payroll');
      } else {
        await selectBillingPeriod(selectedPeriod);
      }
    } catch (error) {
      setBillingEditError(error.message || 'Unable to update billing and payroll details.');
    } finally {
      setBillingSaving(false);
    }
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
            <div data-label="Action"><button type="button" className="scholars-view" aria-label={`View details for ${scholar.name}`} onClick={() => { setSelected(scholar); setDrawerTab('overview'); setDocumentNotice(''); }}><Eye size={13} />View details</button></div>
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
            <button type="button" role="tab" aria-selected={drawerTab === 'finance'} className={drawerTab === 'finance' ? 'active' : ''} onClick={openBillingTab}><CircleDollarSign size={15} />Billing &amp; Payroll</button>
          </nav>

          {drawerTab === 'overview' ? (
            <div className="scholars-drawer-tab-panel" role="tabpanel">
              <section className="scholars-detail-section"><h4>Scholar information</h4><dl><div><dt>Email address</dt><dd>{selected.email || 'Not provided'}</dd></div><div><dt>School year</dt><dd>{selected.schoolYear || '2026-2027'}</dd></div><div><dt>Issued</dt><dd>{formatScholarDate(selected.issuedAt)}</dd></div></dl></section>
              <section className="scholars-detail-section"><h4>Education and location</h4><dl><div><dt>School</dt><dd>{selected.school}</dd></div><div><dt>Course</dt><dd>{selected.course || 'Not specified'}</dd></div><div><dt>Year level</dt><dd>{selected.yearLevel || 'Not specified'}</dd></div><div><dt>Municipality</dt><dd>{selected.municipality}</dd></div><div><dt>Barangay</dt><dd>{selected.barangay}</dd></div></dl></section>
              <section className="scholars-detail-section"><h4>Document checklist</h4>{documentNotice && <p className="scholars-document-notice" role="status">{documentNotice}</p>}<div className="scholars-document-list">{selected.documents.map((document) => {
                const isReviewable = canReviewDocuments && document.submitted && document.fileName && document.applicationId && document.requirementKey;
                const content = <><span>{document.label}{isReviewable && <small><Eye size={12} />View and review</small>}</span><strong className={document.submitted ? document.status.toLowerCase() : 'not-submitted'}>{document.submitted ? document.status : 'Not submitted'}</strong></>;
                return isReviewable
                  ? <button type="button" key={document.label} className="scholars-document-row" onClick={() => openDocumentReview(document)} aria-label={`View and review ${document.label}`}>{content}</button>
                  : <div key={document.label}>{content}</div>;
              })}</div></section>
              {selected.notes && <section className="scholars-detail-section"><h4>Account notes</h4><p className="scholars-notes">{selected.notes}</p></section>}
            </div>
          ) : (
            <div className="scholars-drawer-tab-panel" role="tabpanel">
              <section className="scholars-detail-section scholars-finance-details">
                <form className="scholars-billing-edit-form" onSubmit={saveBillingMetadata}>
                  <div className="scholars-billing-fields">
                    <label><span>School year</span><select aria-label="School year" value={billingForm.schoolYear} disabled={!canEditBilling || billingPeriodLoading} onChange={(event) => { const schoolYear = event.target.value; const matchingPeriods = activeBillingPeriods.filter((period) => period.schoolYear === schoolYear); const nextPeriod = matchingPeriods.find((period) => period.semester === billingForm.semester) || matchingPeriods[0]; selectBillingPeriod(nextPeriod); }}><option value="">School Year</option>{billingSchoolYears.map((schoolYear) => <option key={schoolYear}>{schoolYear}</option>)}</select></label>
                    <label><span>Semester</span><select aria-label="Semester" value={billingForm.semester} disabled={!canEditBilling || billingPeriodLoading || !billingForm.schoolYear} onChange={(event) => selectBillingPeriod(activeBillingPeriods.find((period) => period.schoolYear === billingForm.schoolYear && period.semester === event.target.value))}><option value="">Semester</option>{billingSemesters.map((semester) => <option key={semester}>{semester}</option>)}</select></label>
                    <label><span>Billing reference</span><input aria-label="Billing reference" value={selected.billingReference || ''} placeholder="BILL REF NO." readOnly aria-readonly="true" /></label>
                    <label><span>Billing status</span><select aria-label="Billing status" disabled={!canEditBilling || selected.billed || selected.inPayroll} value={billingForm.billingStatus} onChange={(event) => setBillingForm((current) => ({ ...current, billingStatus: event.target.value }))}>{selected.billed && <option>Billed</option>}<option>Not billed yet</option><option>Ready for billing</option><option>On hold</option></select></label>
                  </div>
                  {billingEditError && <p role="alert">{billingEditError}</p>}
                  {canEditBilling && !selected.billed && !selected.inPayroll && <footer><button type="submit" disabled={billingSaving || billingPeriodLoading || !billingForm.schoolYear || !billingForm.semester}><Save size={12} />{billingSaving ? 'Preparing…' : 'Prepare & open Billing'}</button></footer>}
                </form>
              </section>
              <section className="scholars-finance-summary">
                <article className={selected.billed ? 'complete' : 'pending'}><i><ReceiptText size={19} /></i><div><span>Billing status</span><strong>{selected.billingStatus || (selected.billed ? 'Billed' : 'Not billed yet')}</strong><small>{selected.billed ? 'Included in a billing record' : 'Waiting for billing processing'}</small></div></article>
                <article className={selected.inPayroll ? 'complete' : 'pending'}><i><CircleDollarSign size={19} /></i><div><span>Payroll status</span><strong>{selected.payrollStatus || (selected.inPayroll ? 'Included in payroll list' : 'Not included yet')}</strong><small>{selected.inPayroll ? 'Included in the official payroll list' : selected.billed ? 'Ready for payroll-list preparation' : 'Billing must be completed first'}</small></div></article>
              </section>
              {(selected.billed || selected.inPayroll) && <section className="scholars-new-cycle-guidance"><CalendarRange size={18} /><div><strong>Need another processing cycle?</strong><span>The completed {selected.billingSchoolYearSemester || selected.schoolYearSemester} session remains locked. Select another active School Year and Semester above to prepare a fresh session with no reference.</span>{activeBillingPeriods.length <= 1 && (canOpenSettings ? <button type="button" onClick={openNewCycleSetup}>Set up the next academic period</button> : <small>Ask an administrator with Settings access to activate the next academic period.</small>)}</div></section>}
              {!!selected.financialHistory?.filter((record) => !record.isActivePeriod).length && <section className="scholars-detail-section"><h4>Previous period history</h4><div className="scholars-finance-history">{selected.financialHistory.filter((record) => !record.isActivePeriod).map((record) => <article key={`${record.academicPeriodId}-${record.dateProcessed}`}><div><strong>{record.schoolYear} · {record.semester}</strong><span>{record.billingStatus} · {record.payrollStatus}</span></div><div><strong>{record.payReference || 'No pay reference'}</strong><span>{record.dateProcessed ? formatScholarDate(record.dateProcessed) : 'Not processed'}</span></div></article>)}</div></section>}
              <div className="scholars-finance-note"><CircleDollarSign size={17} /><div><strong>Live processing status</strong><span>This information follows the scholar’s current Billing and Payroll records and refreshes automatically.</span></div></div>
            </div>
          )}
        </aside>
      </div>
    )}
    {documentReview && <ReviewModal review={documentReview} preview={documentPreview} previewLoading={documentPreviewLoading} previewError={documentPreviewError} onClose={closeDocumentReview} onDecision={setDocumentDecision} />}
    {documentReview && documentDecision && <DecisionModal review={documentReview} decision={documentDecision} saving={documentSaving} error={documentDecisionError} onClose={() => { if (!documentSaving) { setDocumentDecision(''); setDocumentDecisionError(''); } }} onConfirm={saveDocumentDecision} />}
  </>;
}
