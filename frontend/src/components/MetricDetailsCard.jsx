import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import { API_BASE, authHeaders } from '../services/api';
import { filterMetricRows, metricPage } from '../utils/metricDetails';
import '../styles/metric-details.css';

const recordLoadError = message => Object.assign(new Error(message), { userMessage: message });

const defaultColumns = [{ key: 'name', label: 'Name' }, { key: 'controlNo', label: 'Control no.' }, { key: 'municipality', label: 'Municipality' }, { key: 'status', label: 'Status' }];

export function MetricRecordsModal({ title, description, rows = [], columns = defaultColumns, endpoint, token, responseKey = 'rows', searchPlaceholder = 'Search records', onClose, onSessionExpired }) {
  const dialog = useRef(null);
  const searchInput = useRef(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [remote, setRemote] = useState(null);
  const requestKey = JSON.stringify([endpoint, query, page, retry]);
  const currentRemote = remote?.requestKey === requestKey ? remote : null;
  const error = currentRemote?.error || '';
  const loading = Boolean(endpoint && !currentRemote);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal(); searchInput.current?.focus();
    return () => { element.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  useEffect(() => {
    if (!endpoint) return undefined;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      if (!controller.signal.aborted) { setRemote({ requestKey, error: 'Loading took too long. Please retry.' }); controller.abort(); }
    }, 20000);
    const timer = window.setTimeout(async () => {
      try {
        const url = new URL(`${API_BASE}${endpoint}`, window.location.origin);
        url.searchParams.set('page', page); url.searchParams.set('pageSize', '25');
        if (query.trim()) url.searchParams.set('search', query.trim());
        const response = await fetch(url, { headers: authHeaders(token), signal: controller.signal });
        if (response.status === 401) { onSessionExpired?.(); throw recordLoadError('Your session expired. Sign in again to view records.'); }
        if (!response.ok) throw recordLoadError(response.status === 403 ? 'You do not have access to these records.' : 'Records could not be loaded. Please retry.');
        const data = await response.json();
        if (!Array.isArray(data[responseKey]) || !data.pagination) throw recordLoadError('The record list is unavailable. Please retry.');
        if (!controller.signal.aborted) setRemote({ rows: data[responseKey], ...data.pagination, requestKey });
      } catch (failure) { if (!controller.signal.aborted) setRemote({ requestKey, error: failure.userMessage || 'Records could not be loaded. Check your connection and retry.' }); }
      finally { window.clearTimeout(timeout); }
    }, query ? 250 : 0);
    return () => { window.clearTimeout(timer); window.clearTimeout(timeout); controller.abort(); };
  }, [endpoint, token, query, page, retry, responseKey, onSessionExpired, requestKey]);
  const result = endpoint ? currentRemote : metricPage(filterMetricRows(rows, query, columns), page);
  const total = result?.total ?? 0;
  return <dialog ref={dialog} className="metric-records-modal" aria-modal="true" aria-labelledby="metric-records-title" aria-describedby="metric-records-description" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) { const bounds = dialog.current.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose(); } }}>
    <header><div><span>RECORD DETAILS</span><h2 id="metric-records-title">{title}</h2><p id="metric-records-description">{description || 'Records included in this summary card. Dashboard-wide totals are independent of directory filters.'}</p></div><button type="button" onClick={onClose} aria-label="Close record details"><X size={20} /></button></header>
    <label className="metric-records-search"><Search size={17} aria-hidden="true" /><span className="metric-sr-only">Search {title}</span><input ref={searchInput} value={query} maxLength={100} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder={searchPlaceholder} /></label>
    <div className="metric-records-content" aria-busy={loading}>
      {error ? <div className="metric-records-message" role="alert"><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)}>Retry</button></div> : loading ? <p className="metric-records-message" role="status">Loading records...</p> : <>
        <p className="metric-records-count" role="status">{total} {total === 1 ? 'record' : 'records'}{query ? ' matching your search' : ''}</p>
        {total ? <div className="metric-records-table"><table><thead><tr>{columns.map(column => <th key={column.key} scope="col">{column.label}</th>)}</tr></thead><tbody>{result.rows.map((row, index) => <tr key={row.id ?? index}>{columns.map(column => <td key={column.key}>{String(row[column.key] ?? 'Not specified')}</td>)}</tr>)}</tbody></table></div> : <p className="metric-records-message">{query ? 'No matching records.' : 'No records in this category yet.'}</p>}
      </>}
    </div>
    <footer><span>{!loading && !error ? `Page ${result?.page || 1} of ${result?.pages || 1}` : 'Read-only record details'}</span><div><button type="button" disabled={loading || Boolean(error) || (result?.page || 1) <= 1} onClick={() => setPage((result?.page || 1) - 1)}>Previous</button><button type="button" disabled={loading || Boolean(error) || (result?.page || 1) >= (result?.pages || 1)} onClick={() => setPage((result?.page || 1) + 1)}>Next</button><button type="button" onClick={onClose}>Close</button></div></footer>
  </dialog>;
}

export default function MetricDetailsCard({ title, className = '', children, disabled = false, ...details }) {
  const [open, setOpen] = useState(false);
  return <article className={`${className} metric-details-card`}>
    {children}
    <button type="button" className="metric-details-trigger" disabled={disabled} onClick={() => setOpen(true)} aria-label={`View ${title} records`} aria-haspopup="dialog"><span className="metric-sr-only">View {title} records</span></button>
    {open && createPortal(<MetricRecordsModal {...details} title={title} onClose={() => setOpen(false)} />, document.body)}
  </article>;
}
