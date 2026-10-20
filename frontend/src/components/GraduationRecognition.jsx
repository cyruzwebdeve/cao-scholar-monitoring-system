import { useEffect, useRef, useState } from 'react';
import { API_BASE, authHeaders } from '../services/api';
import ScholarGraduation from './ScholarGraduation';
import { LATIN_HONORS } from '../utils/graduationHonors';
import Notification from './Notification';
export default function GraduationRecognition({ token }) {
  const selectedRef = useRef(null);
  const [query, setQuery] = useState(''), [year, setYear] = useState('');
  const [filters, setFilters] = useState({ q: '', year: '', status: 'verified', honor: 'honors', page: 1 });
  const [resource, setResource] = useState(null), [refresh, setRefresh] = useState(0), [selected, setSelected] = useState(null);
  const current = resource?.filters === filters && resource?.refresh === refresh && resource?.token === token;
  const data = current ? resource.data : null;
  const error = current ? resource.error : '';
  useEffect(() => { if (selectedRef.current) { selectedRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); selectedRef.current.focus({ preventScroll: true }); } }, [selected]);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE}/scholar-graduations?${new URLSearchParams(filters)}`, { headers: authHeaders(token), signal: controller.signal }).then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.message || 'Unable to load graduation records.'); return body; }).then(body => { if (!controller.signal.aborted) setResource({ data: body, error: '', filters, refresh, token }); }).catch(failure => { if (!controller.signal.aborted) setResource({ data: null, error: failure.message, filters, refresh, token }); });
    return () => controller.abort();
  }, [filters, refresh, token]);
  const filter = (key, value) => setFilters(current => ({ ...current, [key]: value, page: 1 }));
  return <section className="graduation-directory" aria-labelledby="graduation-recognition-title">
    <header><h2 id="graduation-recognition-title">Graduates &amp; Latin honors</h2><p>The recognition list opens with verified Latin honors. Select Pending verification to review submissions, or All honors to include graduates without Latin honors.</p></header>
    <form className="graduation-directory-filters" onSubmit={event => { event.preventDefault(); setFilters(current => ({ ...current, q: query.trim(), year: year.trim(), page: 1 })); }}>
      <label>Search graduates<input type="search" maxLength={100} placeholder="Scholar name, school or degree" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <label>Graduation academic year<input placeholder="All years" pattern="[0-9]{4}-[0-9]{4}" maxLength={9} value={year} onChange={event => setYear(event.target.value)} /></label>
      <label>Verification<select value={filters.status} onChange={event => filter('status', event.target.value)}><option value="verified">Verified</option><option value="pending">Pending verification</option><option value="rejected">Returned for correction</option><option value="all">All statuses</option></select></label>
      <label>Latin honors<select value={filters.honor} onChange={event => filter('honor', event.target.value)}><option value="honors">With Latin honors</option><option value="all">All honors / no honors</option>{Object.entries(LATIN_HONORS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <button type="submit">Search</button>
    </form>
    {error && <Notification tone="error" title="Graduation list unavailable" action={<button onClick={() => setRefresh(current => current + 1)}>Retry</button>}>{error}</Notification>}
    {!data && !error && <p role="status">Loading graduates…</p>}
    {data && <><p role="status">{data.total} matching graduation {data.total === 1 ? 'record' : 'records'}</p><div className="graduation-directory-table"><table><thead><tr><th scope="col">Scholar</th><th scope="col">Graduation</th><th scope="col">School / degree</th><th scope="col">Latin honor</th><th scope="col">Verification</th><th scope="col">Record</th></tr></thead><tbody>{data.records.map(record => <tr key={record.applicantId}><td data-label="Scholar"><strong>{record.name}</strong><small>{record.scholarId || 'No scholar ID'}</small></td><td data-label="Graduation">{record.graduationDate}<small>{record.academicYear}</small></td><td data-label="School / degree">{record.school}<small>{record.course}</small></td><td data-label="Latin honor">{record.honorLabel}</td><td data-label="Verification"><span className={`graduation-status ${record.reviewStatus}`}>{record.reviewStatus === 'verified' ? 'Verified' : record.reviewStatus === 'pending' ? 'Pending verification' : 'Returned for correction'}</span></td><td data-label="Record"><button onClick={() => setSelected({ id: record.applicantId, name: record.name })}>View record</button></td></tr>)}</tbody></table></div>{!data.records.length && <p>No graduation records match these filters. Graduation can be submitted through the Scholar Portal or recorded in a Scholar’s Graduation &amp; honors tab.</p>}<footer><span>Page {filters.page} of {Math.max(1, Math.ceil(data.total / 25))}</span><div><button disabled={filters.page <= 1} onClick={() => setFilters(current => ({ ...current, page: current.page - 1 }))}>Previous</button><button disabled={filters.page * 25 >= data.total} onClick={() => setFilters(current => ({ ...current, page: current.page + 1 }))}>Next</button></div></footer></>}
    {selected && <div className="graduation-selected" ref={selectedRef} tabIndex={-1}><header><h3>{selected.name}</h3><button onClick={() => setSelected(null)}>Close record</button></header><ScholarGraduation key={selected.id} token={token} applicantId={selected.id} staff onSaved={() => setRefresh(current => current + 1)} /></div>}
  </section>;
}
