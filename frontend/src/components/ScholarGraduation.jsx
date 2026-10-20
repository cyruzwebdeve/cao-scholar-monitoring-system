import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { API_BASE, authHeaders } from '../services/api';
import { DOCUMENT_FILE_ACCEPT, validateDocumentFile } from '../utils/documentFilePolicy';
import Notification from './Notification';
import '../styles/scholar-graduation.css';
import { LATIN_HONORS } from '../utils/graduationHonors';
const empty = { graduationDate: '', academicYear: '', latinHonor: 'none', school: '', course: '' };
const statusLabels = { pending: 'Pending verification', verified: 'Verified', rejected: 'Returned for correction' };
export default function ScholarGraduation({ token, applicantId, staff = false, onSaved }) {
  const uid = useId(), fileInput = useRef(null), saving = useRef(false);
  const base = `${API_BASE}/${staff ? `scholar-graduations/${applicantId}` : 'graduations/me'}`;
  const [record, setRecord] = useState(null), [form, setForm] = useState(empty), [file, setFile] = useState(null);
  const [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [notes, setNotes] = useState(''), [proofReviewed, setProofReviewed] = useState(false);
  const applyRecord = useCallback(data => { setRecord(data); setForm(data ? Object.fromEntries(Object.keys(empty).map(key => [key, data[key]])) : empty); setFile(null); setProofReviewed(false); setNotes(''); if (fileInput.current) fileInput.current.value = ''; }, []);
  const read = useCallback(async signal => {
    const response = await fetch(base, { headers: authHeaders(token), signal });
    const body = await response.json(); if (!response.ok) throw new Error(body.message || 'Unable to load graduation record.');
    return body.graduation;
  }, [base, token]);
  useEffect(() => {
    const controller = new AbortController();
    read(controller.signal).then(data => { if (!controller.signal.aborted) { applyRecord(data); setLoaded(true); } }).catch(failure => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [read, applyRecord]);
  const reload = () => {
    setLoaded(false); setError(''); setNotice('');
    read().then(data => { applyRecord(data); setLoaded(true); }).catch(failure => setError(failure.message));
  };
  const mutate = async (path, payload) => {
    const response = await fetch(`${base}${path}`, { method: 'PUT', headers: { ...authHeaders(token), 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const body = await response.json(); if (!response.ok) throw new Error(body.message || 'Unable to save graduation record.');
    applyRecord(body.graduation); onSaved?.();
  };
  const submit = async event => {
    event.preventDefault(); if (saving.current || !loaded) return;
    saving.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const payload = { ...form, expectedVersion: record?.version || 0 };
      if (file) {
        await validateDocumentFile(file);
        payload.fileName = file.name;
        payload.fileData = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Unable to read proof. Choose it again.')); reader.readAsDataURL(file); });
      }
      await mutate('', payload); setNotice('Graduation record submitted for staff verification.');
    } catch (failure) { setError(failure.message); }
    finally { saving.current = false; setBusy(false); }
  };
  const review = async decision => {
    if (saving.current || !record || !loaded) return;
    saving.current = true; setBusy(true); setError(''); setNotice('');
    try { await mutate('/review', { decision, expectedVersion: record.version, notes, proofReviewed }); setNotice(decision === 'verified' ? 'Graduation record verified.' : 'Record returned for correction.'); }
    catch (failure) { setError(failure.message); }
    finally { saving.current = false; setBusy(false); }
  };
  const downloadProof = async () => {
    if (busy || !record) return; setBusy(true); setError('');
    try {
      const response = await fetch(`${base}/proof`, { headers: authHeaders(token) });
      if (!response.ok) { const body = await response.json(); throw new Error(body.message || 'Unable to download proof.'); }
      const url = URL.createObjectURL(await response.blob()); const link = document.createElement('a'); link.href = url; link.download = record.proofName; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  const field = (key, label, props = {}) => <label htmlFor={`${uid}-${key}`}>{label}<input id={`${uid}-${key}`} value={form[key]} onChange={event => { setForm(current => ({ ...current, [key]: event.target.value })); setProofReviewed(false); }} required disabled={busy || !loaded} {...props} /></label>;
  const changed = record && (file || Object.keys(empty).some(key => form[key] !== record[key]));
  return <section className="scholar-graduation" aria-labelledby={`${uid}-title`}>
    <header><div><h3 id={`${uid}-title`}>Graduation &amp; Latin honors</h3><p>Record completed graduation for CAO recognition. Fourth-year standing alone does not confirm graduation.</p></div>{record && <span className={`graduation-status ${record.reviewStatus}`}>{statusLabels[record.reviewStatus]}</span>}</header>
    {error && <Notification tone="error" title="Graduation record">{error} {!loaded && <button type="button" onClick={reload}>Retry</button>}</Notification>}
    {notice && <Notification tone="success" title="Graduation update">{notice}</Notification>}
    {!loaded && !error && <p role="status">Loading graduation record…</p>}
    {loaded && <>
      {record ? <div className="graduation-record-summary"><strong>{record.honorLabel}</strong><span>{record.graduationDate} · {record.academicYear}</span><span>{record.school} · {record.course}</span>{record.reviewNotes && <p>Staff review: {record.reviewNotes}</p>}<button type="button" disabled={busy} onClick={downloadProof}>Download proof · {record.proofName}</button></div> : <p>No graduation record submitted yet. Submit after graduation, with or without Latin honors.</p>}
      <form onSubmit={submit}>
        <fieldset disabled={busy}><legend>{record ? 'Update graduation record' : 'Submit graduation record'}</legend>
          <div className="graduation-form-grid">
            {field('graduationDate', 'Graduation date', { type: 'date' })}
            {field('academicYear', 'Graduation academic year', { placeholder: '2025-2026', pattern: '[0-9]{4}-[0-9]{4}', maxLength: 9 })}
            {field('school', 'School at graduation', { maxLength: 200 })}
            {field('course', 'Degree / course completed', { maxLength: 200 })}
            <label htmlFor={`${uid}-honor`}>Latin honor<select id={`${uid}-honor`} value={form.latinHonor} onChange={event => { setForm(current => ({ ...current, latinHonor: event.target.value })); setProofReviewed(false); }} disabled={!loaded}>{Object.entries(LATIN_HONORS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            <label htmlFor={`${uid}-proof`}>{record ? 'Replace supporting proof (optional)' : 'Supporting proof'}<input ref={fileInput} id={`${uid}-proof`} type="file" accept={DOCUMENT_FILE_ACCEPT} required={!record} onChange={event => { setFile(event.target.files?.[0] || null); setProofReviewed(false); }} /><small>Diploma, transcript or official certification showing graduation and any Latin honor. PDF, JPG or PNG · Maximum 6 MB.</small></label>
          </div>
          <p className="graduation-help">Saving changes returns this record to Pending verification. Only verified Latin honors appear in the recognition list. Scholarship eligibility and payroll records stay unchanged.</p>
          <div className="graduation-actions"><button type="submit" disabled={busy}>{busy ? 'Please wait…' : 'Submit for verification'}</button><button type="button" disabled={busy} onClick={reload}>Reload saved record</button></div>
        </fieldset>
      </form>
      {staff && record?.reviewStatus === 'pending' && <fieldset className="graduation-review" disabled={busy}><legend>Staff verification</legend><p>Compare the saved date, school, degree and Latin honor with the official proof before verifying.</p><label htmlFor={`${uid}-notes`}>Review notes<textarea id={`${uid}-notes`} maxLength={1000} value={notes} onChange={event => setNotes(event.target.value)} /></label><label className="graduation-check"><input type="checkbox" checked={proofReviewed} disabled={Boolean(changed)} onChange={event => setProofReviewed(event.target.checked)} />I checked the proof against this saved record.</label>{changed && <p>Submit or reload unsaved changes before reviewing.</p>}<div className="graduation-actions"><button type="button" disabled={!proofReviewed || Boolean(changed)} onClick={() => review('verified')}>Verify graduation record</button><button type="button" disabled={!notes.trim() || Boolean(changed)} onClick={() => review('rejected')}>Return for correction</button></div></fieldset>}
    </>}
  </section>;
}
