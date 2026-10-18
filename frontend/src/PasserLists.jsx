import { RefreshCw, Save, LockKeyhole, UsersRound } from 'lucide-react';
import RetainedPasserLists from './components/RetainedPasserLists';
import './styles/passer-lists.css';
import Notification from './components/Notification';
import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE, authHeaders } from './services/api';
export default function PasserLists({ applicants, token, onPosted }) {
  const [lists, setLists] = useState([]), [title, setTitle] = useState('Examination Passer List'), [selected, setSelected] = useState([]);
  const [previous, setPrevious] = useState(''), [reason, setReason] = useState(''), [notice, setNotice] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [ready, setReady] = useState(false);
  const requestKey = useRef(null);
  const candidates = applicants.filter((item) => item.status === 'Passed' && item.resultId && !item.isScholar);
  const load = useCallback(async () => {
    const response = await fetch(`${API_BASE}/passer-lists`, { headers: authHeaders(token), cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || 'Unable to load saved passer lists.');
    setLists(body.lists); setReady(true);
  }, [token]);
  useEffect(() => { let active = true; const timer = window.setTimeout(() => load().catch((failure) => { if (active) setError(failure.message); }), 0); return () => { active = false; window.clearTimeout(timer); }; }, [load]);
  const act = async (operation) => { setBusy(true); setError(''); setNotice(''); try { await operation(); } catch (failure) { setError(failure.message); } finally { setBusy(false); } };
  const send = async (path, payload) => {
    const response = await fetch(`${API_BASE}${path}`, { method: 'POST', headers: { ...authHeaders(token), 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const body = await response.json(); if (!response.ok) throw new Error(body.message || 'Unable to save list.');
    setNotice(body.message); await load(); if (body.list.status === 'posted') await onPosted(); return body;
  };
  const save = (status) => act(async () => {
    requestKey.current ||= crypto.randomUUID();
    await send('/passer-lists', { title, status, requestKey: requestKey.current, supersedesId: previous ? Number(previous) : null, revisionReason: reason, members: candidates.filter((item) => selected.includes(item.id)).map((item) => ({ applicantId: item.id, applicationId: item.applicationId, examId: item.examId, resultId: item.resultId, updatedAt: item.resultUpdatedAt })) });
    requestKey.current = null; setSelected([]);
  });
  // A changed selection represents a different request, not a retry of a lost response.
  const choose = (ids) => { setSelected(ids); requestKey.current = null; };
  const invalid = busy || !ready || !title.trim() || !selected.length || selected.length > 500 || (previous && !reason.trim());
  return <section className="passer-lists passer-workspace" aria-label="Passer Lists">
    <div className="passer-list-heading"><div><span className="passer-eyebrow">EXAMINATION RESULTS</span><h3>Passer Lists</h3><p>Prepare reviewed passers for initial document verification and Scholar acceptance.</p></div><button type="button" className="passer-refresh" disabled={busy} onClick={() => act(load)}><RefreshCw size={15} aria-hidden="true" />Refresh lists</button></div>
    {busy && <Notification tone="progress" title="Saving passer list">Keep this page open while records are checked and saved.</Notification>}{notice && <Notification tone="success" title="Passer list saved" onDismiss={() => setNotice('')}>{notice}</Notification>}{error && <Notification tone="error" title="Passer list needs attention">{error}</Notification>}
    <div className="passer-workspace-grid">
      <fieldset className="passer-prepare-panel" disabled={busy}>
        <legend>Prepare a list</legend>
        <p className="passer-panel-description">Enter the list details, then select the applicants to include.</p>
        <div className="passer-form-fields">
          <label>List title<input maxLength={160} value={title} onChange={(event) => { setTitle(event.target.value); requestKey.current = null; }} /></label>
          <label>Revision of<select value={previous} onChange={(event) => { setPrevious(event.target.value); requestKey.current = null; }}><option value="">New list</option>{lists.filter((list) => list.status === 'posted' && !lists.some((revision) => revision.supersedes_id === list.id && revision.status === 'posted')).map((list) => <option key={list.id} value={list.id}>#{list.id} - {list.title}</option>)}</select></label>
          {previous && <label className="passer-revision-reason">Revision reason<textarea maxLength={2000} rows={3} value={reason} onChange={(event) => { setReason(event.target.value); requestKey.current = null; }} /></label>}
        </div>
        <div className="passer-selection-heading"><div><h4><UsersRound size={16} aria-hidden="true" />Select passers</h4><span aria-live="polite">{selected.length} selected ? {candidates.length} available</span></div><button type="button" onClick={() => choose(selected.length ? [] : candidates.slice(0, 500).map((item) => item.id))}>{selected.length ? 'Clear selection' : 'Select available passers'}</button></div>
        <div className="passer-candidates">{candidates.map((item) => <label key={item.id} className={selected.includes(item.id) ? 'selected' : ''}><input type="checkbox" aria-label={`Select ${item.name}`} checked={selected.includes(item.id)} onChange={(event) => choose(event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))} /><span className="passer-candidate-copy"><strong>{item.name}</strong><small>{item.control} ? {item.municipality}</small></span><span className="passer-candidate-score"><small>Score</small><strong>{item.score}</strong></span></label>)}{!candidates.length && <p className="passer-empty">No unaccepted applicants with recorded passing scores. Record and review scores first.</p>}</div>
        <p className="passer-posting-note">Posting publishes the selected results and locks the retained list. Initial document verification comes before Scholar acceptance.</p>
        <div className="passer-list-actions"><button type="button" disabled={invalid} onClick={() => save('draft')}><Save size={15} aria-hidden="true" />Save draft</button><button type="button" className="passer-primary-action" disabled={invalid} onClick={() => save('posted')}><LockKeyhole size={15} aria-hidden="true" />Post &amp; lock list</button></div>
      </fieldset>
      <RetainedPasserLists lists={lists} ready={ready} busy={busy} onPostDraft={(id) => act(() => send(`/passer-lists/${id}/post`, {}))} />
    </div>
  </section>;
}
