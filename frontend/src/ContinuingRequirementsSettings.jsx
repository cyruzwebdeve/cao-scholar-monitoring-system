import { useEffect, useState } from 'react';
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
  return <section className="continuing-settings" aria-label="Continuing requirements schedule">
    <header><h3>Continuing Requirements</h3><p>Publish one schedule for this academic period. Uploads open automatically after the initial requirements are approved.</p></header>
    <label>School year and semester<select value={effectiveId} disabled={saving} onChange={(event) => { setPeriodId(event.target.value); setLoading(true); onPeriodChange(Number(event.target.value)); }}>{periods.filter((period) => period.isActive).map((period) => <option key={period.id} value={period.id}>{period.schoolYear} · {period.semester}</option>)}</select></label>
    {notice && <p role={notice.error ? 'alert' : 'status'} className={notice.error ? 'continuing-error' : 'continuing-success'}>{notice.text}</p>}
    <div className="continuing-counts"><span>{currentScholars.length} active scholars</span><span>{currentScholars.length - waiting} with initial requirements approved</span><span>{waiting} waiting for initial approval</span><span>{submitted} with continuing files</span></div>
    <form onSubmit={save}>
      <fieldset disabled={!canEdit || loading || saving || loadedId !== effectiveId}>
        <legend>Regular submission window</legend><p>Times use your device’s local timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}. The deadline does not block payroll-list generation.</p>
        <div className="continuing-date-grid"><label>Opening date and time<input type="datetime-local" required value={form.opensAt} onChange={(event) => update('opensAt', event.target.value)} /></label><label>Regular deadline<input type="datetime-local" required value={form.closesAt} onChange={(event) => update('closesAt', event.target.value)} /></label></div>
      </fieldset>
      <fieldset disabled={!canEdit || loading || saving || loadedId !== effectiveId}>
        <legend>Late-submission window (optional)</legend><p>Keep the original deadline. Reopen uploads in the same semester for everyone or selected scholars. Clear both dates to remove the late window.</p>
        <div className="continuing-date-grid"><label>Late opening date and time<input type="datetime-local" value={form.lateOpensAt} onChange={(event) => update('lateOpensAt', event.target.value)} /></label><label>Late deadline<input type="datetime-local" value={form.lateClosesAt} onChange={(event) => update('lateClosesAt', event.target.value)} /></label></div>
        <label>Who can submit late?<select aria-label="Who can submit late?" value={form.lateScope} onChange={(event) => update('lateScope', event.target.value)}><option value="all">All scholars</option><option value="selected">Selected scholars</option></select></label>
        {form.lateScope === 'selected' && <div className="continuing-scholar-picker" role="group" aria-label="Scholars allowed to submit late">{currentScholars.map((scholar) => <label key={scholar.applicantId}><input type="checkbox" checked={form.lateApplicantIds.includes(scholar.applicantId)} onChange={(event) => update('lateApplicantIds', event.target.checked ? [...form.lateApplicantIds, scholar.applicantId] : form.lateApplicantIds.filter((id) => id !== scholar.applicantId))} />{scholar.name} · {scholar.controlNumber || scholar.scholarId}</label>)}</div>}
      </fieldset>
      <footer><button type="button" disabled={saving} onClick={() => { setLoading(true); setReload((value) => value + 1); }}>Reload saved schedule</button>{canEdit && <button type="submit" disabled={loading || saving || !effectiveId || loadedId !== effectiveId}>{saving ? 'Publishing…' : 'Publish schedule'}</button>}</footer>
    </form>
  </section>;
}
