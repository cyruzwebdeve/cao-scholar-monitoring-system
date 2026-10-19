import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import Notification from './components/Notification';
import { API_BASE, authHeaders } from './services/api';
import { ROUTINE_DATA_REFRESH_MS, subscribeToVisibleRefresh } from './utils/dataRefresh';
import './styles/potential-scholars.css';

export function PotentialScholarDirectory({ applicants, query, verification, onQuery, onVerification, onReview, reviewDisabled = false, page = 1, onPage }) {
  const filtered = useMemo(() => applicants.filter(row => `${row.name} ${row.controlNo} ${row.municipality} ${row.school}`.toLowerCase().includes(query.trim().toLowerCase())
    && (verification === 'all' || row.initialVerified === (verification === 'verified'))), [applicants, query, verification]);
  const pages = Math.max(1, Math.ceil(filtered.length / 10)), currentPage = Math.min(page, pages);
  return <section className="potential-directory" aria-labelledby="potential-directory-heading">
    <div><h3 id="potential-directory-heading">Potential scholars</h3><p>{filtered.length} of {applicants.length} applicants with complete requirements</p></div>
    <div className="potential-filters">
      <label>Search potential scholars<span><Search size={16} aria-hidden="true" /><input value={query} onChange={event => onQuery(event.target.value)} placeholder="Name, control number, municipality or school" /></span></label>
      <label>Document verification<select value={verification} onChange={event => onVerification(event.target.value)}><option value="all">All complete submissions</option><option value="verified">Verified · awaiting approval</option><option value="pending">Verification pending</option></select></label>
    </div>
    {!filtered.length ? <p className="potential-empty">{applicants.length ? 'No potential scholars match these filters.' : 'No applicants currently have a complete set of initial requirements. Applicants appear here after their current passing result is posted in a Passer List and all required initial files are submitted.'}</p> : <>
      <div className="potential-table-wrap"><table className="potential-table"><thead><tr><th>Applicant</th><th>School / municipality</th><th>Document verification</th><th>Action</th></tr></thead><tbody>
        {filtered.slice((currentPage - 1) * 10, currentPage * 10).map(row => <tr key={row.id}>
          <td data-label="Applicant"><strong>{row.name}</strong><small>{row.controlNo}</small><span className="potential-badge">Potential scholar</span></td>
          <td data-label="School / municipality">{row.school}<small>{row.municipality}</small></td>
          <td data-label="Document verification">{row.initialVerified ? 'Verified · awaiting administrator approval' : 'Complete submission · verification pending'}</td>
          <td data-label="Action">{onReview ? <button type="button" disabled={reviewDisabled} onClick={() => onReview(row.id)} aria-label={`Review ${row.name} for scholar approval`}>Review for approval</button> : <span>Administrator with examination access must review.</span>}</td>
        </tr>)}
      </tbody></table></div>
      <nav className="potential-pagination" aria-label="Potential scholar pages"><span>Page {currentPage} of {pages}</span><button type="button" disabled={currentPage === 1} onClick={() => onPage(currentPage - 1)}>Previous</button><button type="button" disabled={currentPage === pages} onClick={() => onPage(currentPage + 1)}>Next</button></nav>
    </>}
  </section>;
}

export default function PotentialScholars({ token, onReview }) {
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [query, setQuery] = useState(''), [verification, setVerification] = useState('all'), [page, setPage] = useState(1), [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`${API_BASE}/applicants/complete-requirements`, { headers: authHeaders(token), cache: 'no-store' });
        if (!response.ok) throw new Error('Applicants with complete requirements could not be refreshed. Please retry.');
        const payload = await response.json();
        if (!Array.isArray(payload.applicants)) throw new Error('The applicant response was unreadable. Please retry.');
        if (active) { setData(payload); setError(''); }
      } catch (failure) { if (active) setError(failure.message || 'Unable to load potential scholars. Please retry.'); }
      finally { if (active) setLoading(false); }
    };
    load();
    const stop = subscribeToVisibleRefresh(load, { intervalMs: ROUTINE_DATA_REFRESH_MS });
    return () => { active = false; stop(); };
  }, [token, retry]);
  return <div className="potential-scholars">
    <header><h2>Applicants with complete requirements</h2><p>{data?.period ? `${data.period.schoolYear} · ${data.period.semester}` : 'Primary academic period'}</p></header>
    <Notification title="Potential scholars · administrator approval required">A complete submission does not grant scholarship status. An authorized administrator must verify the initial documents and review the current posted passing result, then explicitly select Accept as Scholar in Results.</Notification>
    {error && <Notification tone="error" title="Unable to refresh potential scholars" action={<button type="button" onClick={() => { setLoading(true); setRetry(value => value + 1); }}>Retry</button>}>{error}{data && ' Previously loaded records are shown; review is disabled until refresh succeeds.'}</Notification>}
    {loading && !data && <Notification tone="progress" title="Loading complete requirements">Checking the current period and initial submissions.</Notification>}
    {data && !data.period && !error && <Notification title="No primary academic period">Set a primary academic period before reviewing potential scholars.</Notification>}
    {data?.period && <PotentialScholarDirectory applicants={data.applicants} query={query} verification={verification} onQuery={value => { setQuery(value); setPage(1); }} onVerification={value => { setVerification(value); setPage(1); }} onReview={onReview} reviewDisabled={Boolean(error)} page={page} onPage={setPage} />}
  </div>;
}
