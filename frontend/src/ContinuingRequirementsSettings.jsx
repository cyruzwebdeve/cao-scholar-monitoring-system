import { useEffect, useState } from 'react';
import { CalendarDays, Clock3, FileCheck2, Info, RefreshCw, Send, ShieldCheck, Users, AlertTriangle } from 'lucide-react';
import { API_BASE, authHeaders } from './services/api';
const localTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const empty = { opensAt: '', closesAt: '', lateOpensAt: '', lateClosesAt: '', lateScope: 'all', lateApplicantIds: [], revision: 0 };
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
      .then((schedule) => { if (active) { setForm(schedule ? { opensAt: localTime(schedule.opens_at), closesAt: localTime(schedule.closes_at), lateOpensAt: localTime(schedule.late_opens_at), lateClosesAt: localTime(schedule.late_closes_at), lateScope: schedule.late_scope, lateApplicantIds: schedule.late_applicant_ids, revision: schedule.revision } : empty); setNotice(null); setLoadedId(effectiveId); } })
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
        body: JSON.stringify({ ...form, ...Object.fromEntries(['opensAt', 'closesAt', 'lateOpensAt', 'lateClosesAt'].map((key) => [key, form[key] ? new Date(form[key]).toISOString() : null])) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to publish schedule.');
      update('revision', body.schedule.revision);
      setNotice({ error: false, text: 'Schedule published. Eligible scholars gain access automatically during their upload window.' });
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
      <div><span className="continuing-eyebrow">SUBMISSION SCHEDULE</span><h3>Continuing Requirements</h3><p>Set the upload window for this academic period.</p></div>
      <label className="continuing-period">School year and semester<select aria-label="School year and semester" value={effectiveId} disabled={saving || !effectiveId} onChange={(event) => { setPeriodId(event.target.value); setLoading(true); onPeriodChange(Number(event.target.value)); }}>{periods.filter((period) => period.isActive).map((period) => <option key={period.id} value={period.id}>{period.schoolYear} · {period.semester}</option>)}</select></label>
    </header>
    {notice && <div role={notice.error ? 'alert' : 'status'} className={`continuing-notice ${notice.error ? 'continuing-error' : 'continuing-success'}`}>{notice.error ? <AlertTriangle size={16} aria-hidden="true" /> : <ShieldCheck size={16} aria-hidden="true" />}<p>{notice.text}</p></div>}
    <div className="continuing-counts">{metrics.map(({ label, value, Icon, tone }) => <article className={`continuing-metric ${tone}`} key={label}><div><span>{label}</span><strong>{loading ? '—' : value}</strong></div><i><Icon size={18} aria-hidden="true" /></i></article>)}</div>
    {!effectiveId && <div className="continuing-notice" role="status"><Info size={16} aria-hidden="true" /><p>No active academic period. Activate a school year and semester in Settings to configure a schedule.</p></div>}
    <form onSubmit={save}>
      <div className="continuing-windows">
        <fieldset className="continuing-window" disabled={controlsDisabled}>
          <legend><span className="continuing-window-icon"><CalendarDays size={18} aria-hidden="true" /></span><span>Regular submission</span></legend>
          <p className="continuing-window-copy">The main upload window for all eligible scholars.</p>
          <div className="continuing-date-grid"><label>Opening date and time<input type="datetime-local" required value={form.opensAt} onChange={(event) => update('opensAt', event.target.value)} /></label><label>Regular deadline<input type="datetime-local" required value={form.closesAt} onChange={(event) => update('closesAt', event.target.value)} /></label></div>
          <div className="continuing-window-note"><ShieldCheck size={15} aria-hidden="true" /><span>Uploads open automatically after all initial requirements are approved.</span></div>
        </fieldset>
        <fieldset className="continuing-window continuing-window-late" disabled={controlsDisabled}>
          <legend><span className="continuing-window-icon"><Clock3 size={18} aria-hidden="true" /></span><span>Late submission</span><span className="continuing-optional">Optional</span></legend>
          <p className="continuing-window-copy">Reopen uploads after the regular deadline in the same semester.</p>
          <div className="continuing-date-grid"><label>Late opening date and time<input type="datetime-local" value={form.lateOpensAt} onChange={(event) => update('lateOpensAt', event.target.value)} /></label><label>Late deadline<input type="datetime-local" value={form.lateClosesAt} onChange={(event) => update('lateClosesAt', event.target.value)} /></label></div>
          <label>Who can submit late?<select aria-label="Who can submit late?" value={form.lateScope} onChange={(event) => update('lateScope', event.target.value)}><option value="all">All scholars</option><option value="selected">Selected scholars</option></select></label>
          {form.lateScope === 'selected' && <div className="continuing-selection"><div className="continuing-selection-heading"><span>Select scholars</span><strong>{form.lateApplicantIds.length} selected</strong></div><div className="continuing-scholar-picker" role="group" aria-label="Scholars allowed to submit late">{currentScholars.length ? currentScholars.map((scholar) => <label key={scholar.applicantId}><input type="checkbox" checked={form.lateApplicantIds.includes(scholar.applicantId)} onChange={(event) => update('lateApplicantIds', event.target.checked ? [...form.lateApplicantIds, scholar.applicantId] : form.lateApplicantIds.filter((id) => id !== scholar.applicantId))} /><span><strong>{scholar.name}</strong><small>{scholar.controlNumber || scholar.scholarId}</small></span></label>) : <p className="continuing-picker-empty">No active scholars in this period.</p>}</div></div>}
          <p className="continuing-field-hint">Clear both late dates to remove this window. The regular deadline stays recorded.</p>
        </fieldset>
      </div>
      <div className="continuing-policy"><Info size={17} aria-hidden="true" /><div><strong>Submission dates control uploads only</strong><p>Incomplete requirements remain visible and do not block payroll-list generation.</p></div></div>
      <footer className="continuing-footer"><span className="continuing-timezone"><Clock3 size={14} aria-hidden="true" />Times shown in {Intl.DateTimeFormat().resolvedOptions().timeZone}</span><div><button type="button" disabled={saving || !effectiveId} onClick={() => { setLoading(true); setReload((value) => value + 1); }}><RefreshCw size={14} aria-hidden="true" />Reload saved schedule</button>{canEdit && <button type="submit" disabled={controlsDisabled || !effectiveId}><Send size={14} aria-hidden="true" />{saving ? 'Publishing…' : 'Publish schedule'}</button>}</div></footer>
    </form>
  </section>;
}
