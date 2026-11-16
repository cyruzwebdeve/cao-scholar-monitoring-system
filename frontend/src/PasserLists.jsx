import { RefreshCw, Save, LockKeyhole, UsersRound } from 'lucide-react';
import RetainedPasserLists from './components/RetainedPasserLists';
import './styles/passer-lists.css';
import Notification from './components/Notification';
import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE, authHeaders } from './services/api';
import { createIntakeRequestGuard, intakeYearQuery } from './utils/intakePeriod';
import { getPasserCandidates } from './utils/passerCandidates';
export default function PasserLists({ applicants, token, onPosted, academicPeriodId, schoolYear = '', readOnly = false }) {
  const [lists, setLists] = useState([]), [title, setTitle] = useState('Examination Passer List'), [selected, setSelected] = useState([]);
  const [previous, setPrevious] = useState(''), [reason, setReason] = useState(''), [notice, setNotice] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [ready, setReady] = useState(false);
  const requestKey = useRef(null), mounted = useRef(false), viewVersion = useRef(0);
  const loadGuard = useRef(null);
  if (!loadGuard.current) loadGuard.current = createIntakeRequestGuard();
  const [postedMemberships, setPostedMemberships] = useState([]);
  const activePostedListIds = new Set(postedMemberships.map(member => member.listId));
  const revisionLists = lists.filter(list => list.status === 'posted' && activePostedListIds.has(list.id));
  const revisionList = revisionLists.find(list => list.id === Number(previous));
  const candidates = ready ? getPasserCandidates(applicants, postedMemberships, revisionList?.id) : [];
  const selectedCandidates = candidates.filter(item => selected.includes(item.id));
  const load = useCallback(() => loadGuard.current.run(async signal => {
    const response = await fetch(`${API_BASE}/passer-lists${intakeYearQuery(schoolYear)}`, { headers: authHeaders(token), cache: 'no-store', signal });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || 'Unable to load saved passer lists.');
    if (!Array.isArray(body.lists) || !Array.isArray(body.postedMemberships) || !body.postingScope
      || (academicPeriodId && body.postingScope.academicPeriodId !== academicPeriodId)) {
      throw new Error('Unable to verify available passers for this intake. Refresh Results before preparing a list.');
    }
    return body;
  }, {
    onLoading: loading => { if (loading) setReady(false); },
    onError: failure => setError(failure.message || 'Unable to verify available passers. Refresh lists before preparing a list.'),
    onSuccess: body => { setLists(body.lists); setPostedMemberships(body.postedMemberships); setReady(true); setError(''); },
  }), [token, schoolYear, academicPeriodId]);
  useEffect(() => {
    mounted.current = true; viewVersion.current += 1;
    const version = viewVersion.current;
    const timer = window.setTimeout(() => { setReady(false); setSelected([]); requestKey.current = null; void load().catch((failure) => { if (mounted.current && version === viewVersion.current) setError(failure.message); }); }, 0);
    return () => { mounted.current = false; viewVersion.current += 1; loadGuard.current.cancel(); window.clearTimeout(timer); };
  }, [load, academicPeriodId]);
  const act = async (operation) => {
    const version = viewVersion.current;
    setBusy(true); setError(''); setNotice('');
    try { await operation(); }
    catch (failure) { if (mounted.current && version === viewVersion.current) setError(failure.message); }
    finally { if (mounted.current && version === viewVersion.current) setBusy(false); }
  };
  const send = async (path, payload) => {
    if (readOnly) throw new Error('Historical passer lists are view-only.');
    loadGuard.current.cancel(); setReady(false);
    const version = viewVersion.current;
    const response = await fetch(`${API_BASE}${path}`, { method: 'POST', headers: { ...authHeaders(token), 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const body = await response.json();
    if (!mounted.current || version !== viewVersion.current) return;
    if (!response.ok) throw new Error(body.message || 'Unable to save list.');
    setNotice(body.message);
    if (body.list.status === 'posted') {
      setLists(current => [body.list, ...current.filter(list => list.id !== body.list.id)]);
      if (body.list.academic_period_id === academicPeriodId) setPostedMemberships(current => [
        ...current.filter(member => member.listId !== body.list.id && member.listId !== body.list.supersedes_id),
        ...body.list.members.map(member => ({ listId: body.list.id, applicantId: member.applicant_id })),
      ]);
      setSelected([]); setPrevious(''); setReason(''); requestKey.current = null;
    }
    await load();
    if (!mounted.current || version !== viewVersion.current) return;
    if (body.list.status === 'posted') await onPosted(); return body;
  };
  const save = (status) => act(async () => {
    requestKey.current ||= crypto.randomUUID();
    const body = await send('/passer-lists', { academicPeriodId, title, status, requestKey: requestKey.current, supersedesId: previous ? Number(previous) : null, revisionReason: reason, members: selectedCandidates.map((item) => ({ applicantId: item.id, applicationId: item.applicationId, examId: item.examId, resultId: item.resultId, updatedAt: item.resultUpdatedAt })) });
    if (!body) return;
    requestKey.current = null; setSelected([]);
  });
  // A changed selection represents a different request, not a retry of a lost response.
  const choose = (ids) => { setSelected(ids); requestKey.current = null; };
  const invalid = readOnly || !academicPeriodId || busy || !ready || !title.trim() || !selectedCandidates.length || selectedCandidates.length > 500 || (previous && (!revisionList || !reason.trim()));
  return <section className="passer-lists passer-workspace" aria-label="Passer Lists">
    <div className="passer-list-heading"><div><span className="passer-eyebrow">EXAMINATION RESULTS</span><h3>Passer Lists</h3><p>Prepare reviewed passers for initial document verification and Scholar acceptance.</p></div><button type="button" className="passer-refresh" disabled={busy} onClick={() => act(load)}><RefreshCw size={15} aria-hidden="true" />Refresh lists</button></div>
    {busy && <Notification tone="progress" title="Saving passer list">Keep this page open while records are checked and saved.</Notification>}{notice && <Notification tone="success" title="Passer list saved" onDismiss={() => setNotice('')}>{notice}</Notification>}{error && <Notification tone="error" title="Passer list needs attention">{error}</Notification>}
    <div className="passer-workspace-grid">
      <fieldset className="passer-prepare-panel" disabled={busy || readOnly || !ready}>
        <legend>Prepare a list</legend>
        <p className="passer-panel-description">Enter the list details, then select the applicants to include.</p>
        <div className="passer-form-fields">
          <label>List title<input maxLength={160} value={title} onChange={(event) => { setTitle(event.target.value); requestKey.current = null; }} /></label>
          <label>Revision of<select value={previous} onChange={(event) => { setPrevious(event.target.value); setReason(''); choose([]); }}><option value="">New list</option>{revisionLists.map((list) => <option key={list.id} value={list.id}>#{list.id} - {list.title}</option>)}</select></label>
          {previous && <label className="passer-revision-reason">Revision reason<textarea maxLength={2000} rows={3} value={reason} onChange={(event) => { setReason(event.target.value); requestKey.current = null; }} /></label>}
        </div>
        <div className="passer-selection-heading"><div><h4><UsersRound size={16} aria-hidden="true" />Select passers</h4><span aria-live="polite">{ready ? `${selectedCandidates.length} selected · ${candidates.length} available` : error ? 'Available passers could not be verified.' : 'Checking available passers...'}</span></div><button type="button" onClick={() => choose(selectedCandidates.length ? [] : candidates.slice(0, 500).map((item) => item.id))}>{selectedCandidates.length ? 'Clear selection' : 'Select available passers'}</button></div>
        <div className="passer-candidates">{candidates.map((item) => <label key={item.id} className={selected.includes(item.id) ? 'selected' : ''}><input type="checkbox" aria-label={`Select ${item.name}`} checked={selected.includes(item.id)} onChange={(event) => choose(event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))} /><span className="passer-candidate-copy"><strong>{item.name}</strong><small>{item.control} · {item.municipality}</small></span><span className="passer-candidate-score"><small>Score</small><strong>{item.score}</strong></span></label>)}{!candidates.length && <p className="passer-empty">{!ready ? error ? 'Refresh lists to verify available passers before preparing a list.' : 'Loading available passers...' : previous ? 'No eligible passers for this revision. Members of other posted lists are unavailable.' : postedMemberships.length ? 'No unlisted passers available. Already-posted passers remain in Retained lists and Results; choose Revision of to revise their list.' : 'No unaccepted applicants with recorded passing scores. Record and review scores first.'}</p>}</div>
        <p className="passer-posting-note">Posting publishes the selected results and locks the retained list. Initial document verification comes before Scholar acceptance.</p>
        <div className="passer-list-actions"><button type="button" disabled={invalid} onClick={() => save('draft')}><Save size={15} aria-hidden="true" />Save draft</button><button type="button" className="passer-primary-action" disabled={invalid} onClick={() => save('posted')}><LockKeyhole size={15} aria-hidden="true" />Post &amp; lock list</button></div>
      </fieldset>
      <RetainedPasserLists lists={lists} readOnly={readOnly || !ready} ready={ready} busy={busy} onPostDraft={(id) => act(() => send(`/passer-lists/${id}/post`, {}))} />
    </div>
  </section>;
}
