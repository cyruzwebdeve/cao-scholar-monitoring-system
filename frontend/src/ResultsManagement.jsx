import PublishResultModal from './components/PublishResultModal';
import DocumentViewButton from './components/DocumentViewButton';
import Notification from './components/Notification';
import PasserLists from './PasserLists';
import InitialRequirementCapture from './InitialRequirementCapture';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpDown,
  BadgeCheck,
  CircleX,
  ClipboardCheck,
  Clock3,
  Download,
  Eye,
  RefreshCw,
  Search,
  Save,
  TriangleAlert,
  UserCheck,
  UsersRound,
  X,
} from 'lucide-react';
import { API_BASE, authHeaders } from './services/api';
import CsvExportModal from './components/CsvExportModal';
import { buildRecordRows, downloadCsv } from './utils/csvExport';
import { ROUTINE_DATA_REFRESH_MS, subscribeToVisibleRefresh } from './utils/dataRefresh';

const formatResultDate = (value) => {
  if (!value) return 'Not scheduled';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const resultExportColumns = [
  { key: 'name', label: 'Applicant', group: 'Applicant' },
  { key: 'control', label: 'Control Number', group: 'Applicant' },
  { key: 'email', label: 'Email', group: 'Applicant' },
  { key: 'municipality', label: 'Municipality', group: 'Location' },
  { key: 'barangay', label: 'Barangay', group: 'Location' },
  { key: 'date', label: 'Examination Date', group: 'Examination', value: (record) => formatResultDate(record.date) },
  { key: 'score', label: 'Score', group: 'Examination' },
  { key: 'passingScore', label: 'Passing Score', group: 'Examination' },
  { key: 'status', label: 'Status', group: 'Examination' },
  { key: 'academicYear', label: 'Academic Year', group: 'Examination' },
  { key: 'notes', label: 'Remarks', group: 'Examination' },
];

function StatusBadge({ status }) {
  return <span className={`rm-status ${status.toLowerCase().replace(/\s+/g, '-')}`}>{status}</span>;
}

export default function ResultsManagement({ token }) {
  const [applicants, setApplicants] = useState([]);
  const [deliveryMode, setDeliveryMode] = useState('');
  const [passingScore, setPassingScore] = useState('14');
  const [publishing, setPublishing] = useState(false);
  const [publishConfirmation, setPublishConfirmation] = useState(null);
  const [publishError, setPublishError] = useState('');
  const publishRequest = useRef(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All Statuses');
  const [municipality, setMunicipality] = useState('All Municipalities');
  const [barangay, setBarangay] = useState('All Barangays');
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState('results');
  const [intake, setIntake] = useState(null);
  const [intakeError, setIntakeError] = useState('');
  const [acceptingScholar, setAcceptingScholar] = useState(false);
  const [acceptError, setAcceptError] = useState('');
  const [reevaluationOpen, setReevaluationOpen] = useState(false);
  const [reevaluationScore, setReevaluationScore] = useState('');
  const [reevaluationRemarks, setReevaluationRemarks] = useState('');
  const [reevaluating, setReevaluating] = useState(false);
  const [reevaluationError, setReevaluationError] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [page, setPage] = useState(1);
  const [exportOpen, setExportOpen] = useState(false);
  const pageSize = 10;

  const loadResults = useCallback(async ({ showLoader = false } = {}) => {
    if (showLoader) setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/results/management`, { headers: authHeaders(token) });
      if (!response.ok) throw new Error('Unable to load examination results.');
      const payload = await response.json();
      const settingsResponse = await fetch(`${API_BASE}/examination-settings`, { headers: authHeaders(token) });
      if (!settingsResponse.ok) throw new Error('Unable to verify examination delivery mode.');
      const settingsBody = await settingsResponse.json();
      setDeliveryMode(settingsBody.examination?.deliveryMode || '');
      let localScheduleByMunicipality = new Map();
      try {
        const storedSchedules = JSON.parse(localStorage.getItem('examVenueData') || '[]');
        if (Array.isArray(storedSchedules)) {
          localScheduleByMunicipality = new Map(storedSchedules.map((exam) => [exam.municipality, exam]));
        }
      } catch {
        localScheduleByMunicipality = new Map();
      }
      setApplicants((payload.applicants || []).map((applicant) => ({
        ...applicant,
        control: applicant.controlNo,
        date: applicant.examDate || localScheduleByMunicipality.get(applicant.municipality)?.date || null,
        examEndDate: applicant.examEndDate || localScheduleByMunicipality.get(applicant.municipality)?.endDate || null,
        status: applicant.resultStatus || (applicant.status === 'Exam Completed' ? 'For review' : applicant.status),
        score: applicant.examScore,
        passingScore: applicant.passingScore,
        notes: applicant.reviewerNotes || '',
        reevaluatedAt: applicant.reviewerNotesUpdatedAt || null,
      })));
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to load examination results.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const initialLoad = window.setTimeout(loadResults, 0);
    const stopRefreshing = subscribeToVisibleRefresh(loadResults, { intervalMs: ROUTINE_DATA_REFRESH_MS });
    return () => { window.clearTimeout(initialLoad); stopRefreshing(); };
  }, [loadResults]);

  useEffect(() => {
    if (!selected) return undefined;
    const closeOnEscape = (event) => { if (event.key === 'Escape' && !publishConfirmation && !publishing && !reevaluating && !acceptingScholar) setSelected(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selected, publishConfirmation, publishing, reevaluating, acceptingScholar]);

  const municipalities = useMemo(() => [...new Set(applicants.map((item) => item.municipality).filter(Boolean))].sort(), [applicants]);
  const barangays = useMemo(() => [...new Set(applicants
    .filter((item) => municipality === 'All Municipalities' || item.municipality === municipality)
    .map((item) => item.barangay)
    .filter(Boolean))].sort(), [applicants, municipality]);
  const statuses = useMemo(() => [...new Set(applicants.map((item) => item.status).filter(Boolean))].sort(), [applicants]);

  const filtered = useMemo(() => applicants.filter((applicant) => {
    const searchValue = `${applicant.name} ${applicant.control} ${applicant.email || ''}`.toLowerCase();
    return searchValue.includes(query.trim().toLowerCase())
      && (status === 'All Statuses' || applicant.status === status)
      && (municipality === 'All Municipalities' || applicant.municipality === municipality)
      && (barangay === 'All Barangays' || applicant.barangay === barangay);
  }), [applicants, query, status, municipality, barangay]);

  const sorted = useMemo(() => [...filtered].sort((left, right) => {
    const getValue = (item) => {
      if (sortConfig.key === 'date') return item.date ? new Date(item.date).getTime() : 0;
      if (sortConfig.key === 'score') return item.score ?? -1;
      return String(item[sortConfig.key] || '').toLowerCase();
    };
    const leftValue = getValue(left);
    const rightValue = getValue(right);
    if (leftValue === rightValue) return 0;
    const comparison = leftValue > rightValue ? 1 : -1;
    return sortConfig.direction === 'asc' ? comparison : -comparison;
  }), [filtered, sortConfig]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paginated = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const hasFilters = query || status !== 'All Statuses' || municipality !== 'All Municipalities' || barangay !== 'All Barangays';
  const pendingCount = applicants.filter((item) => item.status === 'For review').length;
  const passedCount = applicants.filter((item) => item.status === 'Passed').length;
  const failedCount = applicants.filter((item) => item.status === 'Failed').length;
  const completedCount = passedCount + failedCount;
  const stats = [
    { label: 'Total Records', value: applicants.length, detail: 'Applicant examination records', tone: 'green', Icon: UsersRound },
    { label: 'For Review', value: pendingCount, detail: 'Awaiting result review', tone: 'orange', Icon: Clock3 },
    { label: 'Scored', value: completedCount, detail: 'Recorded examination scores', tone: 'blue', Icon: ClipboardCheck },
    { label: 'Passed', value: passedCount, detail: 'Met the passing score', tone: 'green', Icon: BadgeCheck },
    { label: 'Failed', value: failedCount, detail: 'Below the passing score', tone: 'red', Icon: CircleX },
  ];

  const clearFilters = () => {
    setQuery('');
    setStatus('All Statuses');
    setMunicipality('All Municipalities');
    setBarangay('All Barangays');
    setPage(1);
  };

  const changeSort = (key) => {
    setSortConfig((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));
    setPage(1);
  };

  const openResult = (applicant) => {
    setIntake(null); setIntakeError('');
    setSelected(applicant);
    setAcceptError('');
    setReevaluationOpen(false);
    setPassingScore(String(applicant.passingScore ?? 14));
    setReevaluationScore(String(applicant.score ?? ''));
    setReevaluationRemarks(applicant.notes || '');
    setReevaluationError('');
  };

  const loadIntake = useCallback(async () => {
    if (!selected || selected.isScholar || selected.status !== 'Passed') return;
    const response = await fetch(`${API_BASE}/passers/${selected.id}/intake`, { headers: authHeaders(token), cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || 'Unable to load initial verification.');
    return { ...body.intake, isPasser: true };
  }, [selected, token]);
  useEffect(() => {
    let active = true;
    loadIntake().then((value) => { if (active) { setIntake(value || null); setIntakeError(''); } }).catch((failure) => { if (active) { setIntake(null); setIntakeError(failure.message); } });
    return () => { active = false; };
  }, [loadIntake]);
  const refreshIntake = async () => { try { setIntake(await loadIntake()); setIntakeError(''); } catch (failure) { setIntake(null); setIntakeError(failure.message); } };

  const saveReevaluation = async () => {
    if (!selected || selected.isScholar) return;
    const isFirstResult = !selected.resultId;
    const score = Number(reevaluationScore);
    if (!reevaluationScore.trim() || !Number.isFinite(score) || score < 0 || score > 20) {
      setReevaluationError('Enter a score between 0 and 20.');
      return;
    }
    if (!reevaluationRemarks.trim()) {
      setReevaluationError('Add a remark explaining the score recording or correction.');
      return;
    }
    if (isFirstResult && (!passingScore.trim() || !Number.isFinite(Number(passingScore)) || Number(passingScore) < 1 || Number(passingScore) > 20)) {
      setReevaluationError('Enter a passing score between 1 and 20.');
      return;
    }
    setReevaluating(true);
    setReevaluationError('');
    try {
      const response = await fetch(`${API_BASE}/examinations/${selected.examId}/results/${selected.id}`, {
        method: isFirstResult ? 'POST' : 'PUT',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ score, passingScore: Number(passingScore), remarks: reevaluationRemarks.trim(), resultId: selected.resultId, updatedAt: selected.resultUpdatedAt }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to re-evaluate this result.');
      const updated = {
        ...selected,
        resultId: payload.result.id,
        resultUpdatedAt: payload.result.updatedAt,
        resultPublishedAt: payload.result.publishedAt,
        resultDeliveryMode: payload.result.deliveryMode,
        score: payload.result.score,
        passingScore: payload.result.passingScore,
        status: payload.result.status,
        notes: payload.result.remarks,
        reevaluatedAt: payload.result.updatedAt,
      };
      setSelected(updated);
      setApplicants((current) => current.map((applicant) => applicant.id === updated.id ? { ...applicant, ...updated } : applicant));
      setReevaluationOpen(false);
      await loadResults();
    } catch (error) {
      setReevaluationError(error.message || 'Unable to re-evaluate this result.');
    } finally {
      setReevaluating(false);
    }
  };

  const publishResult = async () => {
    const result = publishConfirmation;
    if (!result?.resultId || result.isScholar || result.resultPublishedAt || publishing || publishRequest.current) return;
    if (!selected || selected.id !== result.id || selected.resultId !== result.resultId || selected.resultUpdatedAt !== result.resultUpdatedAt) {
      setPublishError('This result changed. Cancel and reopen the confirmation before publishing.'); return;
    }
    publishRequest.current = true;
    setPublishing(true);
    setPublishError('');
    setAcceptError('');
    try {
      const response = await fetch(`${API_BASE}/examinations/${result.examId}/results/${result.id}/publish`, {
        method: 'POST', headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultId: result.resultId, updatedAt: result.resultUpdatedAt }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to publish the result.');
      setSelected((current) => ({ ...current, resultUpdatedAt: payload.result.updatedAt, resultPublishedAt: payload.result.publishedAt }));
      setPublishConfirmation(null);
      await loadResults();
    } catch (error) { setPublishError(error.message || 'Unable to publish the result.'); }
    finally { publishRequest.current = false; setPublishing(false); }
  };

  const acceptAsScholar = async () => {
    if (!selected || selected.status !== 'Passed' || selected.isScholar) return;
    setAcceptingScholar(true);
    setAcceptError('');
    try {
      const response = await fetch(`${API_BASE}/scholars/${selected.id}/accept`, {
        method: 'POST',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId: selected.examId, resultId: selected.resultId, applicationId: selected.applicationId, academicPeriodId: selected.academicPeriodId, updatedAt: selected.resultUpdatedAt }),
      });
      const payload = await response.json();
      if (!response.ok) {
        if (payload.eligibilityRecommendation) {
          setSelected((current) => ({ ...current, eligibilityRecommendation: payload.eligibilityRecommendation }));
        }
        throw new Error(payload.message || 'Unable to accept applicant as a scholar.');
      }
      const updated = { ...selected, isScholar: true, scholarId: payload.scholar?.scholar_id || selected.scholarId };
      setSelected(updated);
      setApplicants((current) => current.map((applicant) => applicant.id === updated.id ? { ...applicant, isScholar: true, scholarId: updated.scholarId } : applicant));
    } catch (error) {
      setAcceptError(error.message || 'Unable to accept applicant as a scholar.');
    } finally {
      setAcceptingScholar(false);
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

  const tableColumns = [
    ['Applicant', 'name'], ['Control no.', 'control'], ['Examination date', 'date'],
    ['Score', 'score'], ['Status', 'status'],
  ];

  return <>
    <div className="results-management">
      <header className="rm-heading">
        <div><span className="rm-eyebrow">EXAMINATION OUTCOMES</span><h2>Results Management</h2><p>Review examination outcomes and track applicant qualification status.</p></div>
        <div className="rm-heading-actions"><span className="rm-live"><i />Refreshes automatically</span><button type="button" className="rm-export" onClick={() => setExportOpen(true)} disabled={!sorted.length}><Download size={15} />Export CSV</button></div>
      </header>

      <nav className="examination-workspace-tabs" aria-label="Results sections"><button type="button" className={view === 'results' ? 'active' : ''} aria-pressed={view === 'results'} onClick={() => setView('results')}>Examination results</button><button type="button" className={view === 'passers' ? 'active' : ''} aria-pressed={view === 'passers'} onClick={() => setView('passers')}>Passer Lists</button></nav>
      {view === 'passers' && <PasserLists applicants={applicants} token={token} onPosted={async () => { setSelected(null); await loadResults(); }} />}
      {view === 'results' && <>
      <div className="rm-stats">{stats.map(({ label, value, detail, tone, Icon }) => <article key={label} className={tone}><div><span>{label}</span><strong>{loading || (loadError && !applicants.length) ? '—' : value}</strong><small>{detail}</small></div><i className="rm-stat-icon"><Icon size={20} /></i></article>)}</div>

      {loadError && <div className="rm-alert error"><TriangleAlert size={17} /><span>{loadError}</span><button type="button" onClick={() => loadResults({ showLoader: true })}>Retry</button></div>}
      {!!pendingCount && <div className="rm-alert"><Clock3 size={17} /><span><b>{pendingCount} {pendingCount === 1 ? 'result is' : 'results are'} awaiting review.</b> Open each record to verify the examination details.</span></div>}

      <section className="rm-records-panel">
        <div className="rm-panel-heading"><div><h3>Result directory</h3><p>{filtered.length} of {applicants.length} records</p></div>{hasFilters && <button type="button" className="rm-clear" onClick={clearFilters}><X size={13} />Clear filters</button>}</div>
        <div className="rm-filters">
          <label className="rm-filter rm-search"><span>Search results</span><div><Search size={15} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Name, email, or control number" /></div></label>
          <label className="rm-filter"><span>Status</span><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option>All Statuses</option>{statuses.map((option) => <option key={option}>{option}</option>)}</select></label>
          <label className="rm-filter"><span>Municipality</span><select value={municipality} onChange={(event) => { setMunicipality(event.target.value); setBarangay('All Barangays'); setPage(1); }}><option>All Municipalities</option>{municipalities.map((option) => <option key={option}>{option}</option>)}</select></label>
          <label className="rm-filter"><span>Barangay</span><select value={barangay} onChange={(event) => { setBarangay(event.target.value); setPage(1); }}><option>All Barangays</option>{barangays.map((option) => <option key={option}>{option}</option>)}</select></label>
        </div>

        <div className="rm-table-card">
          <div className="rm-table-head">{tableColumns.map(([label, key]) => <button type="button" key={key} className={sortConfig.key === key ? 'active' : ''} onClick={() => changeSort(key)}>{label}<ArrowUpDown size={12} /></button>)}<span>Action</span></div>
          <div className="rm-table-body">
            {loading && !applicants.length && <div className="rm-state"><span className="rm-spinner" />Loading examination results...</div>}
            {!loading && !loadError && !paginated.length && <div className="rm-state"><Search size={23} /><strong>No results found</strong><span>Adjust the current filters to see more records.</span>{hasFilters && <button type="button" onClick={clearFilters}>Clear filters</button>}</div>}
            {paginated.map((applicant) => <article className="rm-row" key={applicant.id}>
              <div data-label="Applicant"><span className="rm-avatar">{applicant.initials || applicant.name?.slice(0, 2).toUpperCase()}</span><span className="rm-applicant-copy"><b>{applicant.name}</b><small>{applicant.municipality} · {applicant.barangay}</small></span></div>
              <div data-label="Control no."><code>{applicant.control}</code></div>
              <div data-label="Examination date"><span>{formatResultDate(applicant.date)}</span></div>
              <div data-label="Score"><strong className="rm-table-score">{applicant.score ?? '—'}{applicant.passingScore ? <small> / {applicant.passingScore}</small> : null}</strong></div>
              <div data-label="Status"><StatusBadge status={applicant.status} /></div>
              <div data-label="Action"><button type="button" className="rm-view" aria-label={`View result for ${applicant.name}`} onClick={() => openResult(applicant)}><Eye size={13} />View result</button></div>
            </article>)}
          </div>
          {!!sorted.length && <footer className="rm-table-footer"><span>Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, sorted.length)} of {sorted.length}</span><nav className="rm-pagination" aria-label="Result pages"><button type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>‹</button>{paginationItems.map((item) => typeof item === 'number' ? <button type="button" key={item} aria-label={`Page ${item}`} aria-current={item === currentPage ? 'page' : undefined} className={item === currentPage ? 'active' : ''} onClick={() => setPage(item)}>{item}</button> : <span key={item}>…</span>)}<button type="button" aria-label="Next page" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>›</button></nav></footer>}
        </div>
      </section>
      </>}
    </div>
    {exportOpen && <CsvExportModal title="Export examination results" description="Choose the applicant, location, and examination fields to include. Current filters and sorting will be preserved." columns={resultExportColumns} rowCount={sorted.length} onClose={() => setExportOpen(false)} onExport={(columns) => downloadCsv({ filename: `examination-results-${new Date().toISOString().slice(0, 10)}.csv`, rows: buildRecordRows(sorted, columns) })} />}

    {selected && (
      <div className="rm-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !publishing && !reevaluating && !acceptingScholar) setSelected(null); }}>
        <aside className="rm-drawer" role="dialog" aria-modal="true" aria-labelledby="rm-result-title">
          <button type="button" className="rm-close" disabled={publishing || reevaluating || acceptingScholar} onClick={() => setSelected(null)} aria-label="Close result details"><X size={19} /></button>
          <div className="rm-drawer-profile">
            <span className="rm-drawer-avatar">{selected.initials || selected.name?.slice(0, 2).toUpperCase()}</span>
            <div><span className="rm-eyebrow">EXAMINATION RESULT</span><h3 id="rm-result-title">{selected.name}</h3><p>{selected.control}</p></div>
          </div>
          <StatusBadge status={selected.status} />
          <Notification tone={selected.resultPublishedAt ? 'success' : 'info'} title="Examination result">{selected.resultPublishedAt ? 'Official result published to the applicant' : selected.resultId ? 'Score saved — result under CAO review' : 'No examination result recorded'}</Notification>
          <div className="rm-score-summary"><div><span>Recorded score</span><b>{selected.score ?? '—'}</b></div><div><span>Passing score</span><strong>{selected.passingScore ?? 'Not set'}</strong></div></div>
          <section className="rm-detail-section"><h4>Examination details</h4><dl><div><dt>Examination</dt><dd>{selected.examTitle || 'PGCEAP Qualifying Examination'}</dd></div><div><dt>Date</dt><dd>{formatResultDate(selected.date)}</dd></div><div><dt>Academic year</dt><dd>{selected.academicYear || '2026-2027'}</dd></div><div><dt>Venue</dt><dd>{selected.examVenue || selected.municipality || 'Not specified'}</dd></div></dl></section>
          <section className="rm-detail-section"><h4>Applicant location</h4><dl><div><dt>Municipality</dt><dd>{selected.municipality || 'Not specified'}</dd></div><div><dt>Barangay</dt><dd>{selected.barangay || 'Not specified'}</dd></div></dl></section>

          {!selected.isScholar && selected.status === 'Passed' && <section className="rm-detail-section"><h4>Initial verification before Scholar acceptance</h4>{intakeError && <Notification tone="error" title="Unable to load initial verification">{intakeError}</Notification>}{intake ? <><Notification tone={intake.initialVerified ? 'success' : 'info'} title="Initial requirement verification">{intake.initialVerified ? 'Required initial documents approved. Ready for Scholar acceptance.' : 'Admin must upload and verify all required initial documents. Barangay Indigency is optional.'}</Notification><InitialRequirementCapture key={`${selected.id}:${intake.academicPeriodId}`} scholar={intake} token={token} onSaved={refreshIntake} /><ul className="passer-intake-checklist">{intake.initialDocuments.map((document) => <li key={document.requirementKey}><span>{document.label}</span><div className="initial-document-actions"><strong>{document.status}</strong>{document.submitted && <DocumentViewButton token={token} label={document.label} endpoint={`/document-reviews/${document.applicationId}/${document.requirementKey}/file?academicPeriodId=${document.academicPeriodId}&submissionWave=initial`} />}</div></li>)}</ul></> : !intakeError && <Notification tone="progress" title="Checking initial verification">Loading the posted passer and initial requirements.</Notification>}</section>}

          {reevaluationOpen && (
            <section className="rm-reevaluation-panel">
              <div className="rm-reevaluation-heading"><div><span>RESULT REVIEW</span><h4>{!selected.resultId ? 'Record paper score' : 'Correct examination score'}</h4></div><button type="button" onClick={() => { setReevaluationOpen(false); setReevaluationError(''); }}>Cancel</button></div>
              <div className="rm-reevaluation-scores">
                <label><span>Score out of 20</span><input type="number" min="0" max="20" step="0.01" value={reevaluationScore} onChange={(event) => { setReevaluationScore(event.target.value); setReevaluationError(''); }} /></label>
                {!selected.resultId ? <label><span>Passing score</span><input type="number" min="1" max="20" step="0.01" value={passingScore} onChange={(event) => setPassingScore(event.target.value)} /></label> : <div><span>Passing score</span><strong>{selected.passingScore ?? 14}</strong></div>}
              </div>
              <label className="rm-reevaluation-remarks"><span>Review remarks <b>*</b></span><textarea rows="3" maxLength="2000" value={reevaluationRemarks} onChange={(event) => { setReevaluationRemarks(event.target.value); setReevaluationError(''); }} placeholder="Record the paper-checking note or explain the score correction." /></label>
              {reevaluationScore !== '' && <div className="rm-reevaluation-preview"><span>Updated outcome</span><StatusBadge status={Number(reevaluationScore) >= Number(selected.passingScore ?? passingScore) ? 'Passed' : 'Failed'} /></div>}
              {reevaluationError && <Notification tone="error" title="Unable to save examination score">{reevaluationError}</Notification>}
              <button type="button" className="rm-save-reevaluation" disabled={reevaluating} onClick={saveReevaluation}><Save size={15} />{reevaluating ? 'Saving score…' : 'Save score for review'}</button>
            </section>
          )}

          <footer className="rm-scholar-action">
            {!reevaluationOpen && <button type="button" className="rm-reevaluate-trigger" disabled={selected.isScholar || publishing || ((!selected.resultId) && (deliveryMode !== 'paper' || selected.attendanceStatus !== 'Present' || !selected.examId))} onClick={() => { setReevaluationOpen(true); setReevaluationScore(String(selected.score ?? '')); setReevaluationRemarks(''); setReevaluationError(''); }}><RefreshCw size={16} />{selected.isScholar ? 'Result locked after acceptance' : !selected.resultId ? deliveryMode === 'online' ? 'Online score computed on submission' : selected.attendanceStatus !== 'Present' ? 'Confirm Present attendance before recording' : 'Record paper score' : 'Correct score'}</button>}
            {selected.resultId && !selected.resultPublishedAt && !selected.isScholar && !reevaluationOpen && <button type="button" className="rm-save-reevaluation" disabled={publishing || reevaluating} onClick={() => { setPublishError(''); setPublishConfirmation({ ...selected }); }}>{publishing ? 'Publishing…' : 'Publish reviewed result'}</button>}
            {reevaluationOpen && <p>Saving keeps the result under review. Correcting a published score hides the outcome until CAO republishes it.</p>}
            {acceptError && <Notification tone="error" title="Result processing needs attention">{acceptError}</Notification>}
            <button type="button" className={selected.isScholar ? 'accepted' : ''} disabled={selected.status !== 'Passed' || selected.isScholar || (selected.resultId && !selected.resultPublishedAt) || publishing || acceptingScholar || (!selected.isScholar && !intake?.initialVerified)} onClick={acceptAsScholar}><UserCheck size={16} />{acceptingScholar ? 'Recording decision…' : selected.isScholar ? 'Accepted as Scholar' : selected.status !== 'Passed' ? 'Latest exam result is not passing' : selected.resultId && !selected.resultPublishedAt ? 'Publish result before acceptance' : !intake?.initialVerified ? 'Verify initial documents before acceptance' : 'Accept as Scholar'}</button>
            <small>{selected.isScholar ? `Scholar account active${selected.scholarId ? ` · ${selected.scholarId}` : ''}.` : selected.status === 'Passed' ? 'A versioned recommendation snapshot and the staff decision will be recorded.' : 'Only applicants whose latest examination result is passing can be accepted.'}</small>
          </footer>
        </aside>
      </div>
    )}
    {publishConfirmation && <PublishResultModal result={publishConfirmation} busy={publishing} error={publishError} onCancel={() => { if (!publishing && !publishRequest.current) { setPublishConfirmation(null); setPublishError(''); } }} onConfirm={publishResult} />}
  </>;
}
