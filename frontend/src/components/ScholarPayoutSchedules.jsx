import { useCallback, useEffect, useState } from 'react';
import { API_BASE, authHeaders } from '../services/api';
import { subscribeToVisibleRefresh, TIME_SENSITIVE_DATA_REFRESH_MS } from '../utils/dataRefresh';
import Notification from './Notification';
import PayoutScheduleCard from './PayoutScheduleCard';
export default function ScholarPayoutSchedules({ token }) {
  const [rows, setRows] = useState([]), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const load = useCallback(async signal => {
    try { const response = await fetch(`${API_BASE}/payout-schedules/me`, { headers: authHeaders(token), cache: 'no-store', ...(signal ? { signal } : {}) }); const body = await response.json(); if (!response.ok) throw new Error(body.message || 'Unable to load your payout schedules.'); setRows(body.schedules || []); setError(''); }
    catch (failure) { if (failure.name !== 'AbortError') setError(failure.message); } finally { setLoading(false); }
  }, [token]);
  useEffect(() => { const controller = new AbortController(); const refresh = () => load(controller.signal); refresh(); const stop = subscribeToVisibleRefresh(refresh, { intervalMs: TIME_SENSITIVE_DATA_REFRESH_MS }); return () => { controller.abort(); stop(); }; }, [load]);
  if (loading) return null;
  return <section className="scholar-payout-schedules" aria-label="Your payout schedules">{error && <Notification tone="error" title="Unable to refresh payout schedules" action={<button type="button" onClick={() => load()}>Retry schedules</button>}>{error} Previously loaded schedules may be out of date.</Notification>}{!!rows.length && <><h2>Your payout schedules</h2><div className="payout-schedule-list">{rows.map(row => <PayoutScheduleCard key={row.id} schedule={row} />)}</div></>}</section>;
}
