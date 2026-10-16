import { useEffect, useState } from 'react';
import { Clock3, FileCheck2, Info, RefreshCw, Send, ShieldCheck, Users, AlertTriangle } from 'lucide-react';
import { API_BASE, authHeaders } from './services/api';
const empty = { uploadsOpen: true, revision: 0 };
export default function ContinuingRequirementsSettings({ token, periods, scholars, canEdit, onPeriodChange }) {
  const [periodId, setPeriodId] = useState('');
  const effectiveId = periodId || String(periods.find((period) => period.isPrimary && period.isActive)?.id || periods.find((period) => period.isActive)?.id || '');
  const [form, setForm] = useState(empty);
  const [loadedId, setLoadedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!effectiveId) return;
    let active = true;
    fetch(`${API_BASE}/scholars/continuing-schedules/${effectiveId}`, { headers: authHeaders(token), cache: 'no-store' })
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.message || 'Unable to load schedule.'); return body.schedule; })
      .then((schedule) => { if (active) { setForm(schedule ? { uploadsOpen: schedule.uploads_open !== false, revision: schedule.revision } : empty); setNotice(null); setLoadedId(effectiveId); } })
      .catch((error) => { if (active) setNotice({ error: true, text: error.message }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [effectiveId, token, reload]);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const save = async (event) => {
    event.preventDefault(); setSaving(true); setNotice(null);
    try {
      const response = await fetch(`${API_BASE}/scholars/continuing-schedules/${effectiveId}`, {
        method: 'PUT', headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to publish schedule.');
      update('revision', body.schedule.revision);
      setNotice({ error: false, text: body.message });
      await onPeriodChange(Number(effectiveId));
    } catch (error) { setNotice({ error: true, text: error.message }); }
    finally { setSaving(false); }
  };
  const currentScholars = scholars.filter((scholar) => scholar.academicPeriodId === Number(effectiveId) && scholar.status === 'Active');
  const waiting = currentScholars.filter((scholar) => scholar.continuingSubmission?.initialApproved === false).length;
  const submitted = currentScholars.filter((scholar) => scholar.continuingDocuments?.some((document) => document.submitted)).length;
  const controlsDisabled = !canEdit || loading || saving || loadedId !== effectiveId;
  const metrics = [
    { label: 'Active scholars', value: currentScholars.length, Icon: Users, tone: 'green' },
    { label: 'Initial approved', value: currentScholars.length - waiting, Icon: ShieldCheck, tone: 'green' },
    { label: 'Awaiting approval', value: waiting, Icon: Clock3, tone: 'amber' },
    { label: 'Continuing submitted', value: submitted, Icon: FileCheck2, tone: 'blue' },
  ];
  return <section className="continuing-settings" aria-label="Continuing requirements schedule" aria-busy={loading || saving}>
    <header className="continuing-header">
      <div><span className="continuing-eyebrow">SUBMISSION ACCESS</span><h3>Continuing Requirements</h3><p>Open or close continuing uploads for all eligible scholars in this academic period.</p></div>
      <label className="continuing-period">School year and semester<select aria-label="School year and semester" value={effectiveId} disabled={saving || !effectiveId} onChange={(event) => { setPeriodId(event.target.value); setLoading(true); onPeriodChange(Number(event.target.value)); }}>{periods.filter((period) => period.isActive).map((period) => <option key={period.id} value={period.id}>{period.schoolYear} · {period.semester}</option>)}</select></label>
    </header>
    {notice && <div role={notice.error ? 'alert' : 'status'} className={`continuing-notice ${notice.error ? 'continuing-error' : 'continuing-success'}`}>{notice.error ? <AlertTriangle size={16} aria-hidden="true" /> : <ShieldCheck size={16} aria-hidden="true" />}<p>{notice.text}</p></div>}
    <div className="continuing-counts">{metrics.map(({ label, value, Icon, tone }) => <article className={`continuing-metric ${tone}`} key={label}><div><span>{label}</span><strong>{loading ? '—' : value}</strong></div><i><Icon size={18} aria-hidden="true" /></i></article>)}</div>
    {!effectiveId && <div className="continuing-notice" role="status"><Info size={16} aria-hidden="true" /><p>No active academic period. Activate a school year and semester in Settings to manage submission access.</p></div>}
    <form onSubmit={save}>
      <fieldset className="continuing-window" disabled={controlsDisabled}>
        <legend><span className="continuing-window-icon"><ShieldCheck size={18} aria-hidden="true" /></span><span>Period submission access</span></legend>
        <p className="continuing-window-copy">Uploads stay open after initial requirements are approved until Admin closes submissions for this period.</p>
        <label>Continuing uploads<select aria-label="Continuing uploads" value={form.uploadsOpen ? 'open' : 'closed'} onChange={(event) => update('uploadsOpen', event.target.value === 'open')}><option value="open">Open for eligible scholars</option><option value="closed">Closed for this period</option></select></label>
        <p className="continuing-field-hint">Closing uploads preserves submitted files and review history. Reopen here when needed; no separate late window or individual authorization is required.</p>
      </fieldset>
      <div className="continuing-policy"><Info size={17} aria-hidden="true" /><div><strong>Submission access controls uploads only</strong><p>Incomplete requirements remain visible and do not block payroll-list generation.</p></div></div>
      <footer className="continuing-footer"><span className="continuing-timezone"><Clock3 size={14} aria-hidden="true" />Applies only to the selected academic period</span><div><button type="button" disabled={saving || !effectiveId} onClick={() => { setLoading(true); setReload((value) => value + 1); }}><RefreshCw size={14} aria-hidden="true" />Reload saved access</button>{canEdit && <button type="submit" disabled={controlsDisabled || !effectiveId}><Send size={14} aria-hidden="true" />{saving ? 'Saving…' : 'Save submission access'}</button>}</div></footer>
    </form>
  </section>;
}
