import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Plus, X } from 'lucide-react';
import { API_BASE, authHeaders } from './services/api';
import { subscribeToVisibleRefresh, TIME_SENSITIVE_DATA_REFRESH_MS } from './utils/dataRefresh';
import { filterScheduleScholars, scheduleIso, scheduleLocalInput } from './utils/payoutSchedules';
import Notification from './components/Notification';
import PayoutScheduleCard from './components/PayoutScheduleCard';
import './components/PayoutSchedules.css';
const emptyForm = { title: 'Payout schedule', batchId: '', startsAt: '', endsAt: '', venue: '', instructions: '', applicantIds: [] };
export default function PayoutSchedules({ token }) {
  const cancelDialog = useRef(null), cancelReturnFocus = useRef(null);
  const [data, setData] = useState({ batches: [], schedules: [] });
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState(null);
  const [form, setForm] = useState(null), [roster, setRoster] = useState([]), [rosterLoading, setRosterLoading] = useState(false), [rosterError, setRosterError] = useState(''), [rosterRetry, setRosterRetry] = useState(0);
  const [municipality, setMunicipality] = useState(''), [school, setSchool] = useState(''), [query, setQuery] = useState('');
  const [preview, setPreview] = useState(false), [busy, setBusy] = useState(false), [cancel, setCancel] = useState(null), [cancelNote, setCancelNote] = useState('');
  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers: { ...authHeaders(token), 'Content-Type': 'application/json' }, cache: 'no-store' });
    const body = await response.json(); if (!response.ok) throw new Error(body.message || 'Unable to load schedules.'); return body;
  }, [token]);
  const load = useCallback(async () => { try { const body = await request('/payroll/schedules/management'); setData(body); setError(''); } catch (failure) { setError(failure.message); } finally { setLoading(false); } }, [request]);
  useEffect(() => { const initial = window.setTimeout(load, 0); const stop = subscribeToVisibleRefresh(load, { intervalMs: TIME_SENSITIVE_DATA_REFRESH_MS }); return () => { window.clearTimeout(initial); stop(); }; }, [load]);
  useEffect(() => {
    let active = true;
    const initial = window.setTimeout(() => {
      setRoster([]); setRosterError('');
      if (!form?.batchId) { setRosterLoading(false); return; }
      setRosterLoading(true);
      request(`/payroll/schedule-batches/${form.batchId}`).then(body => { if (active) setRoster(body.scholars); }).catch(failure => { if (active) setRosterError(failure.message); }).finally(() => { if (active) setRosterLoading(false); });
    }, 0);
    return () => { active = false; window.clearTimeout(initial); };
  }, [form?.batchId, request, rosterRetry]);
  useEffect(() => {
    if (!cancel) return undefined;
    const previous = cancelReturnFocus.current, dialogNode = cancelDialog.current;
    const keydown = event => {
      if (event.key === 'Escape' && !busy) { event.preventDefault(); setCancel(null); }
      if (event.key === 'Tab') {
        const controls = [...dialogNode.querySelectorAll('button:not(:disabled),textarea:not(:disabled)')];
        if (!controls.length) { event.preventDefault(); return; }
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); if (!dialogNode?.isConnected) previous?.focus(); };
  }, [cancel, busy]);
  const editingPublished = form?.status === 'published';
  const assigned = useMemo(() => new Set(data.schedules.filter(row => row.status === 'published' && row.batchId === Number(form?.batchId) && row.id !== form?.id).flatMap(row => row.applicantIds)), [data.schedules, form?.batchId, form?.id]);
  const visible = filterScheduleScholars(roster, municipality, school, query);
  const batchById = new Map(data.batches.map(row => [row.id, row]));
  const batch = batchById.get(Number(form?.batchId));
  const update = (key, value) => { setForm(current => ({ ...current, [key]: value })); setNotice(null); };
  const open = row => { setForm(row ? { ...row, batchId: String(row.batchId), startsAt: scheduleLocalInput(row.startsAt), endsAt: scheduleLocalInput(row.endsAt) } : { ...emptyForm, applicantIds: [] }); setMunicipality(''); setSchool(''); setQuery(''); setPreview(false); setNotice(null); };
  const save = async action => {
    setBusy(true); setNotice(null);
    try {
      const body = await request(`/payroll/schedules${form.id ? `/${form.id}` : ''}`, { method: form.id ? 'PUT' : 'POST', body: JSON.stringify({ ...form, batchId: Number(form.batchId), startsAt: scheduleIso(form.startsAt), endsAt: scheduleIso(form.endsAt), action }) });
      setForm(null); setPreview(false); setNotice({ tone: 'success', text: body.message }); await load();
    } catch (failure) { setNotice({ tone: 'error', text: failure.message }); } finally { setBusy(false); }
  };
  const cancelSchedule = async () => {
    setBusy(true); setNotice(null);
    try { const body = await request(`/payroll/schedules/${cancel.id}`, { method: 'PUT', body: JSON.stringify({ revision: cancel.revision, action: 'cancel', cancellationReason: cancelNote }) }); setCancel(null); setCancelNote(''); setNotice({ tone: 'success', text: body.message }); await load(); }
    catch (failure) { setNotice({ tone: 'error', text: failure.message }); } finally { setBusy(false); }
  };
  return <section className="payout-workspace">
    <header className="payout-heading"><div><span className="payout-eyebrow">PAYROLL ANNOUNCEMENTS</span><h2>Payout schedules</h2><p>Arrange the date, venue and instructions for Scholars in an official Payroll batch.</p></div><button type="button" className="payout-primary" disabled={loading || !!error || !!form || !data.batches.length || busy} onClick={() => open()}><Plus size={16} />Create schedule</button></header>
    {error && <Notification tone="error" title="Unable to refresh schedules" action={<button type="button" onClick={load}>Retry</button>}>{error} Previously loaded schedules may be out of date.</Notification>}
    {notice && <Notification tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Notification>}
    {loading && <Notification tone="progress">Loading schedules…</Notification>}
    {!loading && !error && !data.batches.length && <Notification title="Generate a Payroll list first">Schedules use members of an existing official Payroll batch.</Notification>}
    {form && <form className="payout-editor" onSubmit={event => { event.preventDefault(); setPreview(true); }}>
      <header><div><h3>{form.id ? 'Edit schedule' : 'Create schedule'}</h3><p>Dates and times use Philippine time (UTC+8).</p></div><button type="button" className="payout-icon-button" aria-label="Close schedule editor" disabled={busy} onClick={() => { setForm(null); setPreview(false); }}><X size={20} /></button></header>
      <fieldset disabled={busy || preview}>
        <div className="payout-form-grid">
          <label>Payroll batch<select aria-label="Payroll batch" required value={form.batchId} disabled={editingPublished} onChange={event => { update('batchId', event.target.value); update('applicantIds', []); setMunicipality(''); setSchool(''); setQuery(''); }}><option value="">Select an official batch</option>{data.batches.map(row => <option key={row.id} value={row.id}>{row.reference} · {row.schoolYear} · {row.semester} · {row.scholarCount} Scholars</option>)}</select></label>
          <label>Schedule title<input required maxLength={160} value={form.title} onChange={event => update('title', event.target.value)} /></label>
          <label>Start date and time<input type="datetime-local" required value={form.startsAt} onChange={event => update('startsAt', event.target.value)} /></label>
          <label>End date and time (optional)<input type="datetime-local" value={form.endsAt} onChange={event => update('endsAt', event.target.value)} /></label>
          <label className="payout-full">Venue<input required maxLength={250} placeholder="Office or designated school, including address" value={form.venue} onChange={event => update('venue', event.target.value)} /></label>
          <label className="payout-full">Instructions and documents to bring<textarea rows={3} maxLength={3000} value={form.instructions} onChange={event => update('instructions', event.target.value)} /></label>
        </div>
        {form.batchId && <section className="payout-recipients"><header><h4>Recipients</h4><strong>{form.applicantIds.length} selected</strong></header>
          {editingPublished && <p>Recipients are fixed after publication. You can update the date, venue and instructions. Cancel this schedule to create one for a different group.</p>}
          {rosterError && <Notification tone="error" action={<button type="button" onClick={() => setRosterRetry(value => value + 1)}>Retry recipients</button>}>{rosterError}</Notification>}
          {rosterLoading ? <p>Loading batch members…</p> : <>
            <div className="payout-filter-grid"><label>Municipality<select aria-label="Municipality" value={municipality} onChange={event => setMunicipality(event.target.value)}><option value="">All municipalities</option>{[...new Set(roster.map(row => row.municipality).filter(Boolean))].sort().map(value => <option key={value}>{value}</option>)}</select></label><label>School<select aria-label="School" value={school} onChange={event => setSchool(event.target.value)}><option value="">All schools</option>{[...new Set(roster.map(row => row.school).filter(Boolean))].sort().map(value => <option key={value}>{value}</option>)}</select></label><label>Search Scholar<input value={query} onChange={event => setQuery(event.target.value)} /></label></div>
            {!editingPublished && <div className="payout-selection-actions"><button type="button" onClick={() => update('applicantIds', [...new Set([...form.applicantIds, ...visible.filter(row => !assigned.has(row.applicantId)).map(row => row.applicantId)])])}>Select filtered Scholars</button><button type="button" onClick={() => update('applicantIds', [])}>Clear selection</button></div>}
            <div className="payout-roster">{visible.map(row => <label key={row.applicantId}><input type="checkbox" checked={form.applicantIds.includes(row.applicantId)} disabled={editingPublished || assigned.has(row.applicantId)} onChange={event => update('applicantIds', event.target.checked ? [...form.applicantIds, row.applicantId] : form.applicantIds.filter(id => id !== row.applicantId))} /><span><strong>{row.name}</strong><small>{[row.municipality, row.school].filter(Boolean).join(' · ')}{assigned.has(row.applicantId) ? ' · Already scheduled' : ''}</small></span></label>)}{!visible.length && !rosterError && <p>No batch members match these filters.</p>}</div>
          </>}
        </section>}
      </fieldset>
      {preview && <section className="payout-preview"><h4>Review before publishing</h4><PayoutScheduleCard schedule={{ ...form, startsAt: scheduleIso(form.startsAt), endsAt: scheduleIso(form.endsAt), status: 'published', schoolYear: batch?.schoolYear, semester: batch?.semester }} reference={batch?.reference}><p><strong>{form.applicantIds.length} recipient{form.applicantIds.length === 1 ? '' : 's'}</strong></p><ul>{form.applicantIds.map(id => <li key={id}>{roster.find(row => row.applicantId === id)?.name || 'Listed Scholar'}</li>)}</ul></PayoutScheduleCard></section>}
      <footer>{preview ? <><button type="button" disabled={busy} onClick={() => setPreview(false)}>Back to editing</button><button type="button" className="payout-primary" disabled={busy || !form.applicantIds.length || !!rosterError || rosterLoading} onClick={() => save('publish')}>{busy ? 'Publishing…' : editingPublished ? 'Publish changes' : 'Publish schedule'}</button></> : <>{!editingPublished && <button type="button" disabled={busy || !form.batchId || !form.applicantIds.length || !!rosterError || rosterLoading} onClick={event => { if (event.currentTarget.form.reportValidity()) save('draft'); }}>Save draft</button>}<button type="submit" className="payout-primary" disabled={busy || !form.applicantIds.length || !!rosterError || rosterLoading}>Review schedule</button></>}</footer>
    </form>}
    {!form && !loading && !error && !data.schedules.length && !!data.batches.length && <div className="payout-empty"><CalendarDays size={28} /><h3>No payout schedules yet</h3><p>Create a schedule for a saved batch, then preview its recipients before publishing.</p></div>}
    <div className="payout-schedule-list">{data.schedules.map(row => <PayoutScheduleCard key={row.id} schedule={{ ...row, schoolYear: batchById.get(row.batchId)?.schoolYear, semester: batchById.get(row.batchId)?.semester }} reference={batchById.get(row.batchId)?.reference}><footer><small>{row.applicantIds.length} recipient{row.applicantIds.length === 1 ? '' : 's'}</small>{row.status !== 'cancelled' && <span><button type="button" disabled={busy || !!form} onClick={() => open(row)}>{row.status === 'draft' ? 'Edit draft' : 'Reschedule / edit'}</button>{row.status === 'published' && <button type="button" disabled={busy || !!form} onClick={() => { cancelReturnFocus.current = document.activeElement; setCancel(row); setCancelNote(''); setNotice(null); }}>Cancel schedule</button>}</span>}</footer></PayoutScheduleCard>)}</div>
    {cancel && <div className="payout-dialog-backdrop"><section ref={cancelDialog} className="payout-cancel-dialog" role="dialog" aria-modal="true" aria-labelledby="payout-cancel-title"><h3 id="payout-cancel-title">Cancel this schedule?</h3><p>The {cancel.applicantIds.length} selected Scholar{cancel.applicantIds.length === 1 ? '' : 's'} will be notified. The Payroll list remains recorded.</p><label>Cancellation note (optional)<textarea autoFocus rows={3} maxLength={1000} value={cancelNote} disabled={busy} onChange={event => setCancelNote(event.target.value)} /></label>{notice?.tone === 'error' && <Notification tone="error">{notice.text}</Notification>}<footer><button type="button" disabled={busy} onClick={() => setCancel(null)}>Keep schedule</button><button type="button" className="payout-primary" disabled={busy} onClick={cancelSchedule}>{busy ? 'Cancelling…' : 'Confirm cancellation'}</button></footer></section></div>}
  </section>;
}
