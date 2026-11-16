import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarRange, Save } from 'lucide-react';
import { API_BASE, authHeaders } from '../services/api';
import Notification from './Notification';
import '../styles/intake-period.css';
import { createIntakeRequestGuard } from '../utils/intakePeriod';

export default function IntakePeriodSettings({ token, periods, canEdit }) {
  const [context, setContext] = useState(null), [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [confirming, setConfirming] = useState(false);
  const guard = useRef(null);
  if (!guard.current) guard.current = createIntakeRequestGuard();
  const load = useCallback(() => guard.current.run(async signal => {
    const response = await fetch(`${API_BASE}/intake-period`, { headers: authHeaders(token), cache: 'no-store', signal });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || 'Unable to load the intake period.');
    return body;
  }, { onLoading: setLoading, onError: failure => setError(failure.message), onSuccess: body => {
    setContext(body); setSelectedId(body.intakePeriod ? String(body.intakePeriod.id) : ''); setError('');
  } }), [token]);
  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => { window.clearTimeout(timer); guard.current.cancel(); };
  }, [load]);
  const save = async () => {
    if (!canEdit || saving || loading || !selectedId || !context) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch(`${API_BASE}/intake-period`, { method: 'PUT',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ academicPeriodId: Number(selectedId), revision: context.revision }) });
      const body = await response.json();
      if (!response.ok) {
        if (response.status === 409) { setConfirming(false); await load(); }
        throw new Error(body.message || 'Unable to change the intake period.');
      }
      setContext(body); setConfirming(false); setNotice(body.message);
      try { localStorage.setItem('intakePeriodRevision', String(Date.now())); } catch { /* Return refresh remains available. */ }
      window.dispatchEvent(new CustomEvent('intake-period-changed', { detail: body.intakePeriod }));
    } catch (failure) { setError(failure.message); }
    finally { setSaving(false); }
  };
  const selected = periods.find(period => String(period.id) === selectedId);
  return <section className="settings-card" aria-labelledby="intake-period-title">
    <header className="settings-card-header"><div><span className="settings-eyebrow">APPLICATIONS AND EXAMINATIONS</span><h3 id="intake-period-title">Intake school year and semester</h3><p>Choose the intake for applications, examination schedules, results and Scholar acceptance. Continuing Scholar requirements and Billing/Payroll keep their processing period.</p></div><CalendarRange size={22} aria-hidden="true" /></header>
    {error && <Notification tone="error" title="Intake needs attention">{error}<button type="button" onClick={load}>Reload intake</button></Notification>}
    {notice && <Notification tone="success" title="Intake updated">{notice}</Notification>}
    <form className="intake-period-form" onSubmit={event => { event.preventDefault(); setConfirming(true); }}>
      <label className="intake-year-filter"><span>Application and examination intake</span><select value={selectedId} onChange={event => { setSelectedId(event.target.value); setConfirming(false); }} disabled={!canEdit || loading || saving} required><option value="">{loading ? 'Loading intake...' : 'Select a configured period'}</option>{periods.map(period => <option key={period.id} value={period.id}>{period.schoolYear} · {period.semester}</option>)}</select></label>
      <p>{context?.intakePeriod ? `Current intake: ${context.intakePeriod.schoolYear} · ${context.intakePeriod.semester}` : 'No intake selected.'} Create missing school-year periods below before selecting them here.</p>
      {canEdit && <button type="submit" className="settings-save" disabled={loading || saving || !context || !selected || Number(selectedId) === context?.intakePeriod?.id}><Save size={16} />Change intake</button>}
      {confirming && <div className="intake-period-confirmation" role="group" aria-label="Confirm intake change"><p>Change intake to {selected?.schoolYear} · {selected?.semester}? Finish pending examination and acceptance work first. Previous-year applications and schedules remain in history; examination access for the previous school year closes when changing school years. Application opening dates and examination settings remain as configured.</p><button type="button" disabled={saving} onClick={() => setConfirming(false)}>Cancel</button><button type="button" disabled={saving} onClick={save}>{saving ? 'Changing intake...' : 'Confirm intake change'}</button></div>}
    </form>
  </section>;
}
