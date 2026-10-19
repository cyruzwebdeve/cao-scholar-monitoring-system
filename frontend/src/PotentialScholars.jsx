import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import Notification from './components/Notification';
import { API_BASE, authHeaders } from './services/api';
import { ROUTINE_DATA_REFRESH_MS, subscribeToVisibleRefresh } from './utils/dataRefresh';
import './styles/potential-scholars.css';

export function PotentialScholarDirectory({ applicants, query, verification, onQuery, onVerification, onReview, reviewDisabled = false, page = 1, onPage, selected = {}, onSelect }) {
  const filtered = useMemo(() => applicants.filter(row => `${row.name} ${row.controlNo} ${row.municipality} ${row.school}`.toLowerCase().includes(query.trim().toLowerCase())
    && (verification === 'all' || row.canAccept === (verification === 'ready'))), [applicants, query, verification]);
  const pages = Math.max(1, Math.ceil(filtered.length / 10)), currentPage = Math.min(page, pages);
  return <section className="potential-directory" aria-labelledby="potential-directory-heading">
    <div><h3 id="potential-directory-heading">Individually checked applicants</h3><p>{filtered.length} of {applicants.length} potential scholars</p></div>
    <div className="potential-filters">
      <label>Search potential scholars<span><Search size={16} aria-hidden="true" /><input value={query} onChange={event => onQuery(event.target.value)} placeholder="Name, control number, municipality or school" /></span></label>
      <label>Review status<select value={verification} onChange={event => onVerification(event.target.value)}><option value="all">All potential scholars</option><option value="ready">Ready for acceptance</option><option value="stale">Needs rechecking</option></select></label>
    </div>
    {!filtered.length ? <p className="potential-empty">{applicants.length ? 'No potential scholars match these filters.' : 'No applicants have been added to Potential Scholars. Open Results, check each applicant’s requirements, then select Add to Potential Scholars.'}</p> : <>
      <div className="potential-table-wrap"><table className="potential-table"><thead><tr>{onSelect && <th>Select</th>}<th>Applicant</th><th>School / municipality</th><th>Review status</th><th>Action</th></tr></thead><tbody>
        {filtered.slice((currentPage - 1) * 10, currentPage * 10).map(row => <tr key={row.id}>
          {onSelect && <td data-label="Select"><input type="checkbox" aria-label={`Select ${row.name}`} checked={selected[row.id] === row.reviewId && row.canAccept} disabled={reviewDisabled || !row.canAccept || (Object.keys(selected).length >= 50 && selected[row.id] !== row.reviewId)} onChange={event => onSelect(row, event.target.checked)} /></td>}
          <td data-label="Applicant"><strong>{row.name}</strong><small>{row.controlNo}</small><span className="potential-badge">Potential scholar</span></td>
          <td data-label="School / municipality">{row.school}<small>{row.municipality}</small></td>
          <td data-label="Review status">{row.canAccept ? 'Checked · ready for acceptance' : 'Needs rechecking'}{row.reviewIssue && <small>{row.reviewIssue}</small>}</td>
          <td data-label="Action">{onReview ? <button type="button" disabled={reviewDisabled} onClick={() => onReview(row.id)} aria-label={`Review ${row.name} in Results`}>{row.canAccept ? 'View checked record' : 'Recheck in Results'}</button> : <span>Staff with Examination access must review.</span>}</td>
        </tr>)}
      </tbody></table></div>
      <nav className="potential-pagination" aria-label="Potential scholar pages"><span>Page {currentPage} of {pages}</span><button type="button" disabled={currentPage === 1} onClick={() => onPage(currentPage - 1)}>Previous</button><button type="button" disabled={currentPage === pages} onClick={() => onPage(currentPage + 1)}>Next</button></nav>
    </>}
  </section>;
}

export default function PotentialScholars({ token, onReview, canAccept = false }) {
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [query, setQuery] = useState(''), [verification, setVerification] = useState('all'), [page, setPage] = useState(1), [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState({}), [confirmation, setConfirmation] = useState(null), [accepting, setAccepting] = useState(false), [decisionError, setDecisionError] = useState(''), [success, setSuccess] = useState('');
  const requestActive = useRef(false), dialog = useRef(null);
  useEffect(() => {
    if (confirmation) { dialog.current?.showModal(); }
  }, [confirmation]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`${API_BASE}/applicants/complete-requirements`, { headers: authHeaders(token), cache: 'no-store' });
        if (!response.ok) throw new Error('Potential Scholars could not be refreshed. Please retry.');
        const payload = await response.json();
        if (!Array.isArray(payload.applicants)) throw new Error('The applicant response was unreadable. Please retry.');
        if (active) {
          setData(payload); setError('');
          setSelected(current => Object.fromEntries(Object.entries(current).filter(([id, reviewId]) => payload.applicants.some(row => row.id === Number(id) && row.reviewId === reviewId && row.canAccept))));
        }
      } catch (failure) { if (active) setError(failure.message || 'Unable to load potential scholars. Please retry.'); }
      finally { if (active) setLoading(false); }
    };
    load();
    const stop = subscribeToVisibleRefresh(load, { intervalMs: ROUTINE_DATA_REFRESH_MS });
    return () => { active = false; stop(); };
  }, [token, retry]);
  const selectedRows = (data?.applicants || []).filter(row => row.canAccept && selected[row.id] === row.reviewId);
  const acceptSelected = async () => {
    if (requestActive.current || !confirmation || !canAccept || error) return;
    requestActive.current = true; setAccepting(true); setDecisionError('');
    try {
      const response = await fetch(`${API_BASE}/potential-scholars/accept-batch`, { method: 'POST', headers: { ...authHeaders(token), 'Content-Type': 'application/json' }, body: JSON.stringify({ academicPeriodId: confirmation.periodId, selected: confirmation.rows.map(row => ({ applicantId: row.id, reviewId: row.reviewId })) }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Batch acceptance could not be confirmed. Refresh before retrying.');
      setSuccess(body.message || 'Selected applicants accepted as Scholars.'); setSelected({}); setConfirmation(null); setRetry(value => value + 1);
    } catch (failure) { setDecisionError(failure.message || 'Acceptance could not be confirmed. Refresh before retrying.'); }
    finally { requestActive.current = false; setAccepting(false); }
  };
  return <div className="potential-scholars">
    <header><h2>Potential Scholars</h2><p>{data?.period ? `${data.period.schoolYear} · ${data.period.semester}` : 'Primary academic period'}</p></header>
    <Notification title="Results → Check requirements → Add to Potential Scholars">Only applicants explicitly added after individual checking appear here. Select specific checked applicants for final acceptance together. Changed records require rechecking; adding alone does not grant scholarship status.</Notification>
    {success && <Notification tone="success" title="Scholar acceptance recorded">{success}</Notification>}
    {error && <Notification tone="error" title="Unable to refresh potential scholars" action={<button type="button" onClick={() => { setLoading(true); setRetry(value => value + 1); }}>Retry</button>}>{error}{data && ' Previously loaded records are shown; review and acceptance are disabled until refresh succeeds.'}</Notification>}
    {loading && !data && <Notification tone="progress" title="Loading Potential Scholars">Loading applicants explicitly added after checking.</Notification>}
    {data && !data.period && !error && <Notification title="No primary academic period">Set a primary academic period before reviewing potential scholars.</Notification>}
    {canAccept && data?.period && <div className="potential-selection"><span>{selectedRows.length} selected across all pages and filters (maximum 50)</span><button type="button" disabled={!selectedRows.length || accepting} onClick={() => setSelected({})}>Clear selection</button><button type="button" disabled={!selectedRows.length || Boolean(error) || accepting} onClick={() => { setDecisionError(''); setConfirmation({ periodId: data.period.id, rows: selectedRows }); }}>Accept selected as Scholars</button></div>}
    {!canAccept && data?.period && <Notification title="Final acceptance requires an authorized administrator">Provincial Admin or Billing/Payroll Admin with Applicants and Examination access can accept selected candidates. Examination-assigned staff can check and add candidates in Results.</Notification>}
    {data?.period && <PotentialScholarDirectory applicants={data.applicants} query={query} verification={verification} onQuery={value => { setQuery(value); setPage(1); }} onVerification={value => { setVerification(value); setPage(1); }} onReview={onReview} reviewDisabled={Boolean(error) || accepting} page={page} onPage={setPage} selected={selected} onSelect={canAccept ? (row, checked) => setSelected(current => { const next = { ...current }; if (checked && Object.keys(current).length < 50) next[row.id] = row.reviewId; else if (!checked) delete next[row.id]; return next; }) : undefined} />}
    {confirmation && <dialog ref={dialog} className="potential-confirm-dialog" aria-labelledby="potential-confirm-title" onCancel={event => { if (accepting) event.preventDefault(); else setConfirmation(null); }}>
      <h3 id="potential-confirm-title">Accept {confirmation.rows.length} selected applicants as Scholars?</h3><p>Only the applicants listed below will be accepted. Their checked requirements and eligibility are revalidated together. If any record changed, the entire batch is left unaccepted.</p>
      <ul>{confirmation.rows.map(row => <li key={row.id}><strong>{row.name}</strong> · {row.controlNo}</li>)}</ul>
      {decisionError && <Notification tone="error" title="Batch acceptance needs attention">{decisionError}</Notification>}
      <div className="potential-confirm-actions">{decisionError && <button type="button" disabled={accepting} onClick={() => { setConfirmation(null); setRetry(value => value + 1); }}>Refresh selection</button>}<button type="button" disabled={accepting} onClick={() => setConfirmation(null)}>Back to selection</button><button type="button" disabled={accepting || Boolean(error)} onClick={acceptSelected}>{accepting ? 'Accepting selected...' : 'Confirm acceptance'}</button></div>
    </dialog>}
  </div>;
}
