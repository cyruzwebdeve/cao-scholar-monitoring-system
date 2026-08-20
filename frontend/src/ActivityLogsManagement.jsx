import {
  Activity,
  ClipboardList,
  Clock3,
  LogIn,
  RefreshCw,
  Search,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { API_BASE, authHeaders } from './services/api';

const initialData = {
  stats: { today: 0, week: 0, signIns: 0, adminActions: 0 },
  pagination: { page: 1, pageSize: 25, total: 0, pages: 1 },
  logs: [],
};

const formatAction = (value) => String(value || 'System activity')
  .toLowerCase()
  .split('_')
  .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
  .join(' ');

const formatTimestamp = (value) => {
  if (!value) return 'Time unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';
  return date.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

function ActivityLogsManagement({ token }) {
  const [data, setData] = useState(initialData);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [actorType, setActorType] = useState('');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const query = new URLSearchParams({ page: String(page), pageSize: '25' });
        if (search) query.set('search', search);
        if (actorType) query.set('actorType', actorType);
        const response = await fetch(`${API_BASE}/activity-logs?${query}`, { headers: authHeaders(token) });
        if (!response.ok) throw new Error('Unable to load system activity.');
        const nextData = await response.json();
        if (active) {
          setData(nextData);
          setError('');
        }
      } catch (loadError) {
        console.warn('Unable to load activity logs:', loadError);
        if (active) setError('Activity logs could not be refreshed. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    const timer = window.setInterval(load, 30000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [actorType, page, reloadKey, search, token]);

  const metrics = [
    ['Today', data.stats.today, Activity, 'emerald', 'Events recorded today'],
    ['Last 7 days', data.stats.week, Clock3, 'sky', 'Recent system activity'],
    ['Sign-ins', data.stats.signIns, LogIn, 'amber', 'Successful account access'],
    ['Admin actions', data.stats.adminActions, ShieldCheck, 'violet', 'Administrative events'],
  ];

  const applySearch = (event) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  return (
    <div className="audit-management">
      <header className="audit-heading">
        <div>
          <span>AUDIT TRAIL</span>
          <h2>Activity Logs</h2>
          <p>Review successful sign-ins and meaningful actions performed across the system.</p>
        </div>
        <button type="button" onClick={() => { setLoading(true); setReloadKey((value) => value + 1); }} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spinning' : ''} />
          Refresh
        </button>
      </header>

      <div className="audit-metrics">
        {metrics.map(([label, value, Icon, tone, helper]) => (
          <article className={tone} key={label}>
            <div><span>{label}</span><strong>{value}</strong><small>{helper}</small></div>
            <i><Icon size={20} /></i>
          </article>
        ))}
      </div>

      {error && (
        <div className="audit-error" role="status">
          <TriangleAlert size={17} />
          <span>{error}</span>
          <button type="button" onClick={() => { setLoading(true); setReloadKey((value) => value + 1); }}>Retry</button>
        </div>
      )}

      <section className="audit-directory">
        <div className="audit-directory-heading">
          <div className="audit-directory-title">
            <span><ClipboardList size={18} /></span>
            <div><h3>System activity</h3><p>{data.pagination.total} recorded event{data.pagination.total === 1 ? '' : 's'}</p></div>
          </div>
          <form className="audit-filters" onSubmit={applySearch}>
            <label>
              <span>Search logs</span>
              <div><Search size={15} /><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Action or description" /></div>
            </label>
            <label>
              <span>User type</span>
              <select value={actorType} onChange={(event) => { setActorType(event.target.value); setPage(1); }}>
                <option value="">All user types</option>
                <option value="admin">Administrators</option>
                <option value="applicant">Applicants</option>
                <option value="scholar">Scholars</option>
              </select>
            </label>
            <button type="submit">Apply</button>
          </form>
        </div>

        <div className="audit-table-wrap">
          <table className="audit-table">
            <thead><tr><th>Activity</th><th>User</th><th>Type</th><th>Target</th><th>Date and time</th></tr></thead>
            <tbody>
              {loading && !data.logs.length && <tr className="audit-empty"><td colSpan="5"><span className="audit-loader" />Loading activity records...</td></tr>}
              {!loading && !data.logs.length && <tr className="audit-empty"><td colSpan="5"><ClipboardList size={24} /><strong>No activity found</strong><span>New sign-ins and system actions will appear here.</span></td></tr>}
              {data.logs.map((log) => (
                <tr key={log.id}>
                  <td data-label="Activity"><strong>{formatAction(log.action)}</strong><small>{log.description}</small></td>
                  <td data-label="User"><strong>{log.actorName}</strong><small>{log.actorIdentifier || `User #${log.actorId}`}</small></td>
                  <td data-label="Type"><span className={`audit-type ${log.actorType}`}>{log.actorType}</span></td>
                  <td data-label="Target"><span>{log.targetTable ? log.targetTable.replace(/_/g, ' ') : 'System'}</span>{log.targetId && <small>Record #{log.targetId}</small>}</td>
                  <td data-label="Date and time"><span>{formatTimestamp(log.createdAt)}</span>{log.ipAddress && <small>IP {log.ipAddress}</small>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.pagination.total > 0 && (
          <footer className="audit-pagination">
            <span>Page {data.pagination.page} of {data.pagination.pages}</span>
            <div>
              <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
              <button type="button" disabled={page >= data.pagination.pages || loading} onClick={() => setPage((value) => value + 1)}>Next</button>
            </div>
          </footer>
        )}
      </section>
    </div>
  );
}

export default ActivityLogsManagement;
