import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Filter,
  ReceiptText,
  Search,
  ShieldAlert,
  TriangleAlert,
  UsersRound,
  X,
} from 'lucide-react';
import { API_BASE, authHeaders } from './services/api';
import CsvExportModal from './components/CsvExportModal';
import { buildRecordRows, downloadCsv } from './utils/csvExport';

const formatDate = (value) => {
  if (!value) return 'Not processed';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not processed' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatAmount = (value) => value === null || value === undefined
  ? 'Not assigned'
  : new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);

const billingExportColumns = [
  { key: 'name', label: 'Scholar Name', group: 'Scholar' },
  { key: 'controlNumber', label: 'Control Number', group: 'Scholar' },
  { key: 'email', label: 'Email', group: 'Scholar' },
  { key: 'status', label: 'Scholar Status', group: 'Scholar' },
  { key: 'billingStatus', label: 'Billed', group: 'Billing & payroll' },
  { key: 'payReference', label: 'Pay Reference', group: 'Billing & payroll' },
  { key: 'payrollStatus', label: 'Paid', group: 'Billing & payroll' },
  { key: 'claimAmount', label: 'Amount', group: 'Billing & payroll', value: (record) => formatAmount(record.claimAmount) },
  { key: 'schoolYearSemester', label: 'School Year / Semester', group: 'Academic' },
  { key: 'school', label: 'School', group: 'Academic' },
  { key: 'schoolType', label: 'School Type', group: 'Academic', value: (record) => record.schoolType || 'Public' },
  { key: 'dateProcessed', label: 'Date Processed', group: 'Processing', value: (record) => formatDate(record.dateProcessed) },
];

const matchesDateRange = (value, from, to) => {
  if (!from && !to) return true;
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  if (from && date < new Date(`${from}T00:00:00`)) return false;
  if (to && date > new Date(`${to}T23:59:59.999`)) return false;
  return true;
};

export default function BillingPayrollManagement({ token, mode = 'billing', userRole }) {
  const isPayroll = mode === 'payroll';
  const canUseBillingOverride = !isPayroll && ['SuperAdmin', 'BillingPayrollAdmin'].includes(userRole);
  const defaultBilledFilter = isPayroll ? 'All Billing Statuses' : 'Not billed yet';
  const defaultPaidFilter = isPayroll ? 'Not paid yet' : 'All Payroll Statuses';
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [, setPage] = useState(1);
  const [queuedIds, setQueuedIds] = useState([]);
  const [sourceSelection, setSourceSelection] = useState([]);
  const [queueSelection, setQueueSelection] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [operationNotice, setOperationNotice] = useState(null);
  const [billingOverrides, setBillingOverrides] = useState({});
  const [overrideCandidate, setOverrideCandidate] = useState(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideError, setOverrideError] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [scholarStatus, setScholarStatus] = useState('All Scholar Statuses');
  const [billed, setBilled] = useState(defaultBilledFilter);
  const [payReference, setPayReference] = useState('All Pay References');
  const [paid, setPaid] = useState(defaultPaidFilter);
  const [schoolYearSem, setSchoolYearSem] = useState('All School Years / Semesters');
  const [school, setSchool] = useState('All Schools');
  const [schoolType, setSchoolType] = useState('All School Types');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadRecords = useCallback(async ({ showLoader = false } = {}) => {
    if (showLoader) setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/scholars/management`, { headers: authHeaders(token), cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to load billing and payroll records.');
      const currentRecords = (body.scholars || []).map((record) => ({ ...record, isArchivedPeriod: false }));
      const archivedRecords = (body.scholars || []).flatMap((record) => (record.financialHistory || [])
        .filter((history) => !history.isActivePeriod)
        .map((history) => ({
          ...record,
          ...history,
          id: `${record.id}-period-${history.academicPeriodId || history.dateProcessed || 'legacy'}`,
          billed: true,
          paid: history.payrollStatus === 'Paid',
          schoolYearSemester: `${history.schoolYear} · ${history.semester}`,
          isArchivedPeriod: true,
        })));
      setRecords([...currentRecords, ...archivedRecords]);
      setLoadError('');
    } catch (error) {
      setLoadError(error instanceof TypeError ? 'Unable to reach the server. Retrying automatically…' : error.message || 'Unable to load records.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => loadRecords({ showLoader: true }), 0);
    const timer = window.setInterval(loadRecords, 30000);
    const refresh = () => loadRecords();
    window.addEventListener('focus', refresh);
    return () => { window.clearTimeout(initialLoad); window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [loadRecords]);

  useEffect(() => {
    if (!overrideCandidate) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOverrideCandidate(null);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [overrideCandidate]);

  const scholarStatuses = useMemo(() => [...new Set(records.map(({ status }) => status).filter(Boolean))].sort(), [records]);
  const payReferences = useMemo(() => [...new Set(records.map((item) => item.payReference).filter(Boolean))].sort(), [records]);
  const schoolYearSemesters = useMemo(() => [...new Set(records.map((item) => item.schoolYearSemester).filter(Boolean))].sort(), [records]);
  const schools = useMemo(() => [...new Set(records.map((item) => item.school).filter(Boolean))].sort(), [records]);
  const schoolTypes = useMemo(() => [...new Set(records.map((item) => item.schoolType || 'Public'))].sort(), [records]);

  const filtered = useMemo(() => records.filter((record) => {
    const search = `${record.name} ${record.email || ''}`.toLowerCase();
    const normalizedSchoolType = record.schoolType || 'Public';
    const matchesReference = payReference === 'All Pay References'
      || (payReference === 'No pay reference' ? !record.payReference : record.payReference === payReference);
    return search.includes(query.trim().toLowerCase())
      && (scholarStatus === 'All Scholar Statuses' || record.status === scholarStatus)
      && (billed === 'All Billing Statuses' || (billed === 'Billed' ? record.billed : !record.billed))
      && matchesReference
      && (paid === 'All Payroll Statuses' || (paid === 'Paid' ? record.paid : !record.paid))
      && normalizedSchoolType === (isPayroll ? 'Public' : 'Private')
      && (schoolYearSem === 'All School Years / Semesters' || record.schoolYearSemester === schoolYearSem)
      && (school === 'All Schools' || record.school === school)
      && (schoolType === 'All School Types' || normalizedSchoolType === schoolType)
      && matchesDateRange(record.dateProcessed, dateFrom, dateTo);
  }), [records, query, scholarStatus, billed, payReference, paid, schoolYearSem, school, schoolType, dateFrom, dateTo, isPayroll]);

  const hasFilters = Boolean(query || dateFrom || dateTo
    || scholarStatus !== 'All Scholar Statuses'
    || billed !== defaultBilledFilter
    || payReference !== 'All Pay References'
    || paid !== defaultPaidFilter
    || schoolYearSem !== 'All School Years / Semesters'
    || school !== 'All Schools'
    || schoolType !== 'All School Types');

  const clearFilters = () => {
    setQuery(''); setScholarStatus('All Scholar Statuses'); setBilled(defaultBilledFilter);
    setPayReference('All Pay References'); setPaid(defaultPaidFilter);
    setSchoolYearSem('All School Years / Semesters'); setSchool('All Schools');
    setSchoolType('All School Types'); setDateFrom(''); setDateTo(''); setPage(1);
  };

  const currentRecords = useMemo(() => records.filter((record) => !record.isArchivedPeriod), [records]);
  const visibleRecords = filtered;
  const queuedRecords = useMemo(() => records.filter((record) => !record.isArchivedPeriod && queuedIds.includes(record.applicantId)
    && record.processRoute === (isPayroll ? 'payroll' : 'billing')
    && (isPayroll ? !record.inPayroll : !record.billed)), [records, queuedIds, isPayroll]);
  const sourceRecords = useMemo(() => visibleRecords.filter((record) => !queuedIds.includes(record.applicantId)), [visibleRecords, queuedIds]);
  const movableSourceRecords = useMemo(() => sourceRecords.filter((record) => (
    !record.isArchivedPeriod
    && record.processRoute === (isPayroll ? 'payroll' : 'billing')
    && record.processEligible
    && (isPayroll ? !record.inPayroll : !record.billed)
  )), [sourceRecords, isPayroll]);
  const selectedMovableIds = sourceSelection.filter((id) => movableSourceRecords.some((record) => record.applicantId === id));
  const queuedTotalAmount = queuedRecords.reduce((sum, record) => sum + Number(record.claimAmount || 0), 0);
  const routedRecords = currentRecords.filter((item) => item.schoolType === (isPayroll ? 'Public' : 'Private'));
  const billedCount = routedRecords.filter((item) => item.billed).length;
  const paidCount = routedRecords.filter((item) => item.paid).length;
  const referencedCount = records.filter((item) => item.schoolType === 'Public' && item.payReference).length;
  const metrics = isPayroll
    ? [
        { label: 'Total Scholars', value: routedRecords.length, detail: 'Accepted scholar accounts', tone: 'green', Icon: UsersRound },
        { label: 'For Payroll', value: routedRecords.filter((item) => !item.inPayroll).length, detail: 'Public scholars awaiting payroll', tone: 'orange', Icon: Banknote },
        { label: 'In Payroll', value: routedRecords.filter((item) => item.inPayroll).length, detail: 'Included in payroll records', tone: 'blue', Icon: Banknote },
        { label: 'Pay References', value: referencedCount, detail: 'Archived payment references', tone: 'violet', Icon: ReceiptText },
      ]
    : [
        { label: 'Total Scholars', value: routedRecords.length, detail: 'Accepted scholar accounts', tone: 'green', Icon: UsersRound },
        { label: 'Not Billed Yet', value: routedRecords.length - billedCount, detail: 'Automatically awaiting billing', tone: 'orange', Icon: ReceiptText },
        { label: 'Billed', value: billedCount, detail: 'Included in billing records', tone: 'blue', Icon: ReceiptText },
        { label: 'Paid', value: paidCount, detail: 'Completed through payroll', tone: 'violet', Icon: Banknote },
      ];

  const toggleSelection = (setter, id) => setter((current) => current.includes(id)
    ? current.filter((item) => item !== id)
    : [...current, id]);

  const queueSelected = () => {
    setQueuedIds((current) => [...new Set([...current, ...selectedMovableIds])]);
    setSourceSelection([]);
    setOperationNotice(null);
  };

  const queueAll = () => {
    setQueuedIds((current) => [...new Set([...current, ...movableSourceRecords.map(({ applicantId }) => applicantId)])]);
    setSourceSelection([]);
    setOperationNotice(null);
  };

  const openBillingOverride = (record) => {
    setOverrideCandidate(record);
    setOverrideReason('');
    setOverrideError('');
  };

  const closeBillingOverride = () => {
    setOverrideCandidate(null);
    setOverrideReason('');
    setOverrideError('');
  };

  const confirmBillingOverride = () => {
    if (!overrideCandidate) return;
    const reason = overrideReason.trim().replace(/\s+/g, ' ');
    if (reason.length < 10) {
      setOverrideError('Enter a clear reason with at least 10 characters.');
      return;
    }
    setQueuedIds((current) => [...new Set([...current, overrideCandidate.applicantId])]);
    setBillingOverrides((current) => ({ ...current, [overrideCandidate.applicantId]: reason }));
    setSourceSelection((current) => current.filter((id) => id !== overrideCandidate.applicantId));
    setOperationNotice({ tone: 'success', text: `${overrideCandidate.name} was added to For Billing with an eligibility override.` });
    closeBillingOverride();
  };

  const removeSelectedFromQueue = () => {
    setQueuedIds((current) => current.filter((id) => !queueSelection.includes(id)));
    setBillingOverrides((current) => Object.fromEntries(Object.entries(current)
      .filter(([applicantId]) => !queueSelection.includes(Number(applicantId)))));
    setQueueSelection([]);
    setOperationNotice(null);
  };

  const clearQueue = () => {
    setQueuedIds([]);
    setBillingOverrides({});
    setQueueSelection([]);
    setOperationNotice(null);
  };

  const processQueue = async () => {
    if (!queuedRecords.length || processing) return;
    setProcessing(true);
    setOperationNotice(null);
    try {
      const response = await fetch(`${API_BASE}/${isPayroll ? 'payroll' : 'billing'}/process`, {
        method: 'POST',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicantIds: queuedRecords.map(({ applicantId }) => applicantId),
          ...(!isPayroll ? {
            billingOverrides: queuedRecords
              .filter(({ applicantId }) => billingOverrides[applicantId])
              .map(({ applicantId }) => ({ applicantId, reason: billingOverrides[applicantId] })),
          } : {}),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || `Unable to process ${mode} records.`);
      setQueuedIds([]);
      setBillingOverrides({});
      setSourceSelection([]);
      setQueueSelection([]);
      setOperationNotice({ tone: 'success', text: body.message });
      await loadRecords();
    } catch (error) {
      setOperationNotice({ tone: 'error', text: error.message || `Unable to process ${mode} records.` });
    } finally {
      setProcessing(false);
    }
  };

  return <>
    <div className="billing-management">
      <header className="billing-heading">
        <div><span>{isPayroll ? 'PAYROLL OPERATIONS' : 'BILLING OPERATIONS'}</span><h2>{isPayroll ? 'Payroll Management' : 'Billing Management'}</h2><p>{isPayroll ? 'Track public-school scholars assigned directly to Payroll.' : 'Prepare billing records for private-school scholars.'}</p></div>
      </header>

      <section className="billing-metrics">{metrics.map(({ label, value, detail, tone, Icon }) => <article className={tone} key={label}><div><span>{label}</span><strong>{loading ? '—' : Math.max(0, value)}</strong><small>{detail}</small></div><i><Icon size={20} /></i></article>)}</section>

      {loadError && <div className="billing-alert"><TriangleAlert size={17} /><span>{loadError}</span><button type="button" onClick={() => loadRecords({ showLoader: true })}>Retry</button></div>}

      <section className="billing-filter-panel">
        <div className="billing-filter-heading"><div><i><Filter size={15} /></i><span><strong>Quick filters</strong><small>Filter scholar billing and payroll records using operational fields.</small></span></div>{hasFilters && <button type="button" onClick={clearFilters}><X size={13} />Clear filters</button>}</div>
        <div className="billing-filters billing-filter-groups">
          <section className="billing-filter-group">
            <header><strong>Scholar</strong></header>
            <div className="billing-filter-group-fields">
              <label className="billing-search"><span>Search</span><div><Search size={15} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Scholar name or email" /></div></label>
              <label><span>Status of scholar</span><select value={scholarStatus} onChange={(event) => { setScholarStatus(event.target.value); setPage(1); }}><option>All Scholar Statuses</option>{scholarStatuses.map((option) => <option key={option}>{option}</option>)}</select></label>
              <label><span>School</span><select value={school} onChange={(event) => { setSchool(event.target.value); setPage(1); }}><option>All Schools</option>{schools.map((option) => <option key={option}>{option}</option>)}</select></label>
            </div>
          </section>

          <section className="billing-filter-group">
            <header><strong>Billing & payroll</strong></header>
            <div className="billing-filter-group-fields">
              <label><span>Billed?</span><select value={billed} onChange={(event) => { setBilled(event.target.value); setPage(1); }}><option>All Billing Statuses</option><option>Billed</option><option>Not billed yet</option></select></label>
              <label><span>Paid?</span><select value={paid} onChange={(event) => { setPaid(event.target.value); setPage(1); }}><option>All Payroll Statuses</option><option>Paid</option><option>Not paid yet</option></select></label>
              <label><span>Pay reference</span><select value={payReference} onChange={(event) => {
                const nextReference = event.target.value;
                setPayReference(nextReference);
                if (!['All Pay References', 'No pay reference'].includes(nextReference)) {
                  setBilled('Billed');
                  setPaid('Paid');
                }
                setPage(1);
              }}><option>All Pay References</option><option>No pay reference</option>{payReferences.map((option) => <option key={option}>{option}</option>)}</select></label>
            </div>
          </section>

          <section className="billing-filter-group">
            <header><strong>Academic & date</strong></header>
            <div className="billing-filter-group-fields">
              <label><span>School year / sem</span><select value={schoolYearSem} onChange={(event) => { setSchoolYearSem(event.target.value); setPage(1); }}><option>All School Years / Semesters</option>{schoolYearSemesters.map((option) => <option key={option}>{option}</option>)}</select></label>
              <label><span>School type</span><select value={schoolType} onChange={(event) => { setSchoolType(event.target.value); setPage(1); }}><option>All School Types</option>{schoolTypes.map((option) => <option key={option}>{option}</option>)}</select></label>
              <div className="billing-filter-date-range">
                <label><span>Processed from</span><div className="billing-date"><CalendarRange size={14} /><input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} /></div></label>
                <label><span>Processed to</span><div className="billing-date"><CalendarRange size={14} /><input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} /></div></label>
              </div>
            </div>
          </section>
        </div>
      </section>

      {operationNotice && <div className={`billing-operation-notice ${operationNotice.tone}`} role="status">{operationNotice.tone === 'error' && <TriangleAlert size={16} />}<span>{operationNotice.text}</span><button type="button" onClick={() => setOperationNotice(null)} aria-label="Dismiss notification"><X size={14} /></button></div>}

      <section className="billing-transfer-board">
        <article className="billing-transfer-panel billing-source-panel">
          <header className="billing-transfer-header">
            <div><strong>List of Scholars</strong><small>{sourceRecords.length} filtered record{sourceRecords.length === 1 ? '' : 's'}</small></div>
            <span><button type="button" onClick={() => setSourceSelection(movableSourceRecords.map(({ applicantId }) => applicantId))} disabled={!movableSourceRecords.length}>Select movable</button><button type="button" onClick={() => setSourceSelection([])} disabled={!sourceSelection.length}>Clear</button></span>
          </header>
          <div className="billing-queue-table billing-source-table">
            <div className="billing-queue-table-head"><span>Control no.</span><span>Name</span><span>Status</span></div>
            <div className="billing-queue-table-body">
              {loading && !records.length && <div className="billing-queue-empty"><span className="scholars-spinner" />Loading scholars…</div>}
              {!loading && !sourceRecords.length && <div className="billing-queue-empty"><Search size={20} /><strong>No scholar records</strong><span>{hasFilters ? 'No records match the selected filters.' : 'Scholar records will appear here automatically.'}</span></div>}
              {sourceRecords.map((record) => {
                const canMove = !record.isArchivedPeriod && record.processEligible && (isPayroll ? !record.inPayroll : !record.billed);
                const canOverride = canUseBillingOverride && !record.isArchivedPeriod && !record.billed
                  && record.status === 'Active' && !record.processEligible;
                const isSelected = canMove && sourceSelection.includes(record.applicantId);
                const statusLabel = isPayroll
                  ? record.inPayroll ? 'In payroll' : record.processEligible ? 'Ready for payroll' : 'Requirements incomplete'
                  : record.billed ? 'Billed' : record.processEligible ? 'Ready to bill' : canOverride ? 'Override available' : 'Requirements incomplete';
                const unavailableReason = record.billingEligibilityReasons?.[0]?.message;
                return <div className={`billing-queue-row ${isSelected ? 'selected' : ''} ${canMove || canOverride ? '' : 'archived'} ${canOverride ? 'override-available' : ''}`} key={record.id}>
                  <code>{record.controlNumber || '—'}</code>
                  <button type="button" className="billing-queue-name" aria-pressed={isSelected} disabled={!canMove && !canOverride} title={canMove ? `Select ${record.name}` : canOverride ? `Override billing eligibility for ${record.name}` : unavailableReason || `${record.name} cannot be moved again.`} onClick={() => canMove ? toggleSelection(setSourceSelection, record.applicantId) : openBillingOverride(record)}><strong>{record.name}</strong><small>{isSelected ? 'Selected' : canOverride ? 'Click to authorize override' : record.email}</small></button>
                  <span className={`billing-queue-ready ${canOverride ? 'override' : canMove ? '' : 'archived'}`}>{statusLabel}</span>
                </div>;
              })}
            </div>
          </div>
          <footer><span>Selected: <strong>{selectedMovableIds.length}</strong></span><span>Movable: <strong>{movableSourceRecords.length}</strong></span></footer>
        </article>

        <nav className="billing-transfer-controls" aria-label="Move scholars between lists">
          <button type="button" className="primary" onClick={queueSelected} disabled={!selectedMovableIds.length} aria-label={`Move selected scholars to ${isPayroll ? 'payroll' : 'billing'}`}><ChevronRight size={17} /></button>
          <button type="button" onClick={queueAll} disabled={!movableSourceRecords.length} aria-label={`Move all eligible scholars to ${isPayroll ? 'payroll' : 'billing'}`}><ChevronsRight size={17} /></button>
          <button type="button" onClick={removeSelectedFromQueue} disabled={!queueSelection.length} aria-label="Return selected scholars to the source list"><ChevronLeft size={17} /></button>
          <button type="button" onClick={clearQueue} disabled={!queuedRecords.length} aria-label="Return all scholars to the source list"><ChevronsLeft size={17} /></button>
        </nav>

        <article className="billing-transfer-panel billing-target-panel">
          <header className="billing-transfer-header">
            <div><strong>For {isPayroll ? 'Payroll' : 'Billing'}</strong><small>Review the current processing queue.</small></div>
            <button type="button" className="billing-queue-export" onClick={() => setExportOpen(true)} disabled={!queuedRecords.length}><Download size={14} />Export CSV</button>
          </header>
          <div className="billing-queue-table billing-target-table">
            <div className="billing-queue-table-head"><span>Control no.</span><span>Name</span><span>School year</span><span>Sem</span></div>
            <div className="billing-queue-table-body">
              {!queuedRecords.length && <div className="billing-queue-empty"><ReceiptText size={20} /><strong>No scholars queued</strong><span>Use the transfer controls to add scholars.</span></div>}
              {queuedRecords.map((record) => <div className={`billing-queue-row ${queueSelection.includes(record.applicantId) ? 'selected' : ''} ${billingOverrides[record.applicantId] ? 'overridden' : ''}`} key={record.id}>
                <code>{record.controlNumber || '—'}</code>
                <button type="button" className="billing-queue-name" aria-pressed={queueSelection.includes(record.applicantId)} title={billingOverrides[record.applicantId] || undefined} onClick={() => toggleSelection(setQueueSelection, record.applicantId)}><strong>{record.name}</strong><small>{queueSelection.includes(record.applicantId) ? 'Selected' : billingOverrides[record.applicantId] ? 'Eligibility override' : record.school}</small></button>
                <span>{record.schoolYear}</span>
                <span>{record.semester}</span>
              </div>)}
            </div>
          </div>
          <footer className="billing-target-footer"><div><span>List count: <strong>{queuedRecords.length}</strong></span><span>{isPayroll ? 'List amount' : 'Billable amount'}: <strong>{formatAmount(queuedTotalAmount)}</strong></span></div><button type="button" onClick={processQueue} disabled={!queuedRecords.length || processing}>{processing ? 'Processing…' : isPayroll ? 'Generate payroll list' : 'Process billing'}</button></footer>
        </article>
      </section>
      {exportOpen && <CsvExportModal title={`Export ${isPayroll ? 'payroll' : 'billing'} queue`} description="Choose which scholar, academic, and processing fields to include in this CSV file." columns={billingExportColumns} rowCount={queuedRecords.length} onClose={() => setExportOpen(false)} onExport={(columns) => downloadCsv({ filename: `${mode}-records-${new Date().toISOString().slice(0, 10)}.csv`, rows: buildRecordRows(queuedRecords, columns) })} />}
      {overrideCandidate && <div className="billing-override-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeBillingOverride()}>
        <section className="billing-override-modal" role="dialog" aria-modal="true" aria-labelledby="billing-override-title" aria-describedby="billing-override-description">
          <header>
            <i><ShieldAlert size={21} /></i>
            <div><span>BILLING OVERRIDE</span><h2 id="billing-override-title">Add scholar to For Billing</h2><p id="billing-override-description">Authorize an exception to the normal requirement-readiness checks.</p></div>
            <button type="button" onClick={closeBillingOverride} aria-label="Close billing override"><X size={18} /></button>
          </header>
          <div className="billing-override-content">
            <div className="billing-override-scholar"><span>{overrideCandidate.initials}</span><div><strong>{overrideCandidate.name}</strong><small>{overrideCandidate.controlNumber} · {overrideCandidate.schoolYearSemester}</small></div></div>
            <section className="billing-override-blockers">
              <strong>Readiness checks being overridden</strong>
              <ul>{(overrideCandidate.billingEligibilityReasons || []).map((item, index) => <li key={`${item.code}-${item.requirement || index}`}>{item.message}</li>)}</ul>
            </section>
            <label className="billing-override-reason"><span>Reason for override <em>Required</em></span><textarea value={overrideReason} maxLength={500} autoFocus onChange={(event) => { setOverrideReason(event.target.value); setOverrideError(''); }} placeholder="Explain why this scholar must be billed before completing the normal readiness checks." /> <small>{overrideReason.length}/500 characters</small></label>
            {overrideError && <p className="billing-override-error" role="alert">{overrideError}</p>}
            <p className="billing-override-audit"><ShieldAlert size={15} />When billing is processed, this reason will be stored with the claim and the action will appear in Activity Logs.</p>
          </div>
          <footer><button type="button" className="secondary" onClick={closeBillingOverride}>Cancel</button><button type="button" className="primary" onClick={confirmBillingOverride} disabled={overrideReason.trim().length < 10}>Authorize override</button></footer>
        </section>
      </div>}
    </div>

  </>;
}
