import { useCallback, useEffect, useState } from 'react';
import { Plus, Save, RefreshCw, Trash2 } from 'lucide-react';
import { API_BASE, authHeaders } from './services/api';
import './styles/online-questions.css';

const types = { 'multiple-choice': 'Multiple choice', identification: 'Identification', 'true-false': 'True or false', essay: 'Essay (completion credit)' };
const newQuestion = (id, type = 'multiple-choice') => ({ id, type, text: '', points: 1, grading: type === 'essay' ? 'completion' : 'answer', ...(type === 'multiple-choice' ? { options: ['', '', '', ''], answer: 0 } : type === 'true-false' ? { answer: 'TRUE' } : type === 'identification' ? { acceptedAnswers: [''] } : { essayPrompt: '' }) });

export default function OnlineQuestionsSettings({ token, active }) {
  const [configuration, setConfiguration] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [attempted, setAttempted] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setAttempted(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/online-examination/configuration`, { headers: authHeaders(token), cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to load online questions.');
      setConfiguration(body.configuration);
      setDirty(false);
    } catch (failure) { setError(failure.message); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => {
    if (!active || attempted) return undefined;
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [active, attempted, load]);
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const edit = (next) => { setConfiguration(next); setDirty(true); setNotice(''); };
  const updateQuestion = (id, patch) => edit({ ...configuration, questions: configuration.questions.map((question) => question.id === id ? { ...question, ...patch } : question) });
  const total = configuration?.questions.reduce((sum, question) => sum + Number(question.points || 0), 0) || 0;
  const save = async (event) => {
    event.preventDefault();
    if (!configuration || saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`${API_BASE}/online-examination/configuration`, {
        method: 'PUT', headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...configuration, baseVersion: configuration.id }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to save online questions.');
      setConfiguration(body.configuration);
      setDirty(false);
      setNotice(body.message);
    } catch (failure) { setError(failure.message); }
    finally { setSaving(false); }
  };

  return <section className="settings-card online-questions-settings">
    <div className="settings-card-heading"><div><span className="settings-eyebrow">OPTIONAL ONLINE EXAMINATION</span><h3>Online Questions</h3><p>Edit the question bank and server-side answer keys. Saving creates a new version for subsequently opened examinations; it does not activate online delivery.</p></div></div>
    <p className="online-questions-warning">The examination remains out of 20 points. Identification can use exact accepted answers (ignoring case and repeated spaces). Legacy completion-credit identification and essays award points for any non-empty answer—not correctness or a human assessment. Replace those items if completion credit is not appropriate.</p>
    {error && <p role="alert" className="settings-period-message error">{error}</p>}
    {notice && <p role="status" className="settings-period-message success">{notice}</p>}
    <button type="button" className="settings-save" disabled={loading || saving} onClick={() => { if (!dirty || window.confirm('Discard unsaved question edits and reload the saved version?')) { setNotice(''); void load(); } }}><RefreshCw size={15} />{loading ? 'Loading…' : 'Reload saved questions'}</button>
    {configuration && <form onSubmit={save}>
      <fieldset disabled={loading || saving}>
        <legend>Question configuration · Version {configuration.id || 'built-in'}{dirty ? ' · Unsaved changes' : ''}</legend>
        <div className="online-question-fields">
          <label>Examination title<input required maxLength={150} value={configuration.title} onChange={(event) => edit({ ...configuration, title: event.target.value })} /></label>
          <label>Passing score (out of 20)<input required type="number" min="1" max="20" step="1" value={configuration.passingScore} onChange={(event) => edit({ ...configuration, passingScore: event.target.value === '' ? '' : Number(event.target.value) })} /></label>
        </div>
        <label>Applicant instructions<textarea maxLength={3000} rows={3} value={configuration.instructions} onChange={(event) => edit({ ...configuration, instructions: event.target.value })} /></label>
        {configuration.questions.map((question, index) => <fieldset key={question.id} className="online-question-card">
          <legend>Question {index + 1}</legend>
          <div className="online-question-fields">
            <label>Type<select value={question.type} onChange={(event) => updateQuestion(question.id, { ...newQuestion(question.id, event.target.value), text: question.text, points: question.points })}>{Object.entries(types).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Points<input required type="number" min="1" max="20" step="1" value={question.points} onChange={(event) => updateQuestion(question.id, { points: event.target.value === '' ? '' : Number(event.target.value) })} /></label>
          </div>
          <label>Question text<textarea required maxLength={3000} rows={2} value={question.text} onChange={(event) => updateQuestion(question.id, { text: event.target.value })} /></label>
          {question.type === 'multiple-choice' && <>
            <div className="online-question-fields">{question.options.map((option, optionIndex) => <label key={optionIndex}>Option {String.fromCharCode(65 + optionIndex)}<input required maxLength={500} value={option} onChange={(event) => updateQuestion(question.id, { options: question.options.map((value, i) => i === optionIndex ? event.target.value : value) })} /></label>)}</div>
            <label>Correct answer<select value={question.answer} onChange={(event) => updateQuestion(question.id, { answer: Number(event.target.value) })}>{question.options.map((_, i) => <option key={i} value={i}>Option {String.fromCharCode(65 + i)}</option>)}</select></label>
          </>}
          {question.type === 'true-false' && <label>Correct answer<select value={question.answer} onChange={(event) => updateQuestion(question.id, { answer: event.target.value })}><option value="TRUE">TRUE</option><option value="FALSE">FALSE</option></select></label>}
          {question.type === 'identification' && <>
            <label>Marking rule<select value={question.grading} onChange={(event) => updateQuestion(question.id, { grading: event.target.value, acceptedAnswers: question.acceptedAnswers || [''] })}><option value="answer">Match an accepted answer</option><option value="completion">Completion credit only (legacy)</option></select></label>
            {question.grading !== 'completion' && <label>Accepted answers (one per line, up to 10)<textarea required rows={3} value={(question.acceptedAnswers || []).join('\n')} onChange={(event) => updateQuestion(question.id, { acceptedAnswers: event.target.value.split('\n') })} /></label>}
          </>}
          {question.type === 'essay' && <><label>Essay prompt<textarea required maxLength={3000} rows={3} value={question.essayPrompt || ''} onChange={(event) => updateQuestion(question.id, { essayPrompt: event.target.value })} /></label><p>Completion credit only. Manual essay grading is not implemented. At most one essay is supported.</p></>}
          <button type="button" className="online-question-remove" onClick={() => edit({ ...configuration, questions: configuration.questions.filter(({ id }) => id !== question.id) })}><Trash2 size={14} />Remove question {index + 1}</button>
        </fieldset>)}
        <div className="online-question-actions">
          <button type="button" className="settings-save" disabled={configuration.questions.length >= 20} onClick={() => edit({ ...configuration, questions: [...configuration.questions, newQuestion(Math.max(0, ...configuration.questions.map(({ id }) => id)) + 1)] })}><Plus size={15} />Add question</button>
          <strong role="status">Total: {total}/20 points</strong>
          <button type="submit" className="settings-save" disabled={!dirty || total !== 20 || !configuration.questions.length}><Save size={15} />{saving ? 'Saving…' : 'Save new question version'}</button>
        </div>
      </fieldset>
    </form>}
  </section>;
}
