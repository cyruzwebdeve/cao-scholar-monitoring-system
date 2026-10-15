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
  return <section className="passer-lists" aria-label="Passer Lists">
    <div className="passer-list-heading"><div><h3>Passer Lists</h3><p>Save a draft or post reviewed passers now. Posting publishes their results and locks a retained list. Initial verification comes before Scholar acceptance.</p></div><button type="button" disabled={busy} onClick={() => act(load)}>Refresh lists</button></div>
    {busy && <p role="status">Processing the list. Keep this page open while records are checked and saved.</p>}{notice && <p role="status" className="capture-notice capture-notice-success">{notice}</p>}{error && <p role="alert" className="rm-accept-error">{error}</p>}
    <fieldset disabled={busy}><legend>Prepare a list</legend><label>List title<input maxLength={160} value={title} onChange={(event) => { setTitle(event.target.value); requestKey.current = null; }} /></label>
      <label>Revision of<select value={previous} onChange={(event) => { setPrevious(event.target.value); requestKey.current = null; }}><option value="">New list</option>{lists.filter((list) => list.status === 'posted' && !lists.some((revision) => revision.supersedes_id === list.id && revision.status === 'posted')).map((list) => <option key={list.id} value={list.id}>#{list.id} · {list.title}</option>)}</select></label>
      {previous && <label>Revision reason<input maxLength={2000} value={reason} onChange={(event) => { setReason(event.target.value); requestKey.current = null; }} /></label>}
      <div className="passer-selection-heading"><span>{selected.length} selected · {candidates.length} available passers</span><button type="button" onClick={() => choose(selected.length ? [] : candidates.slice(0, 500).map((item) => item.id))}>{selected.length ? 'Clear selection' : 'Select available passers'}</button></div>
      <div className="passer-candidates">{candidates.map((item) => <label key={item.id}><input type="checkbox" checked={selected.includes(item.id)} onChange={(event) => choose(event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))} /><span><strong>{item.name}</strong><small>{item.control} · {item.municipality} · Score {item.score}</small></span></label>)}{!candidates.length && <p>No unaccepted applicants with recorded passing scores. Record and review scores first.</p>}</div>
      <div className="capture-actions"><button type="button" disabled={invalid} onClick={() => save('draft')}>Save draft</button><button type="button" className="capture-submit" disabled={invalid} onClick={() => save('posted')}>Post &amp; lock list</button></div>
    </fieldset>
    <h3>Retained lists</h3>{lists.length ? lists.map((list) => <details key={list.id}><summary>#{list.id} · {list.title} · {list.status === 'posted' ? 'Posted · Locked' : 'Saved draft'} · {list.members.length} passers</summary><p>{list.posted_at ? `Posted ${new Date(list.posted_at).toLocaleString()}` : `Saved ${new Date(list.created_at).toLocaleString()}`}{list.supersedes_id ? ` · Revision of #${list.supersedes_id}: ${list.revision_reason}` : ''}</p><ul>{list.members.map((member) => <li key={member.id}>{member.snapshot.name} · Score {member.snapshot.score}</li>)}</ul>{list.status === 'draft' && <button type="button" disabled={busy} onClick={() => act(() => send(`/passer-lists/${list.id}/post`, {}))}>Post &amp; lock saved draft</button>}</details>) : <p>{ready ? 'No saved lists yet.' : 'Loading saved lists…'}</p>}
  </section>;
}
