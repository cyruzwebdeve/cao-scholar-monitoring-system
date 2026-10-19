import { useEffect, useRef, useState } from 'react';
import { API_BASE, authHeaders } from './services/api';
export default function ScholarAmountEditor({ record, token, onSaved, onClose }) {
  const dialog = useRef(null);
  const [value, setValue] = useState(String(record.claimAmount));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const amount = Number(value);
  const valid = value.trim() !== '' && Number.isFinite(amount) && amount >= 0 && amount <= 99999999.99 && amount === Math.round(amount * 100) / 100;
  const tuition = record.schoolType === 'Private' && record.grantPrepared ? Number(record.tuitionFeeAssistance) : null;
  useEffect(() => { dialog.current.showModal(); }, []);
  const save = async event => {
    event.preventDefault();
    if (!valid || busy || (tuition !== null && amount < tuition)) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`${API_BASE}/scholars/${record.applicantId}/amount`, { method: 'PUT', headers: { ...authHeaders(token), 'Content-Type': 'application/json' }, body: JSON.stringify({ academicPeriodId: record.academicPeriodId, amount, expectedAmount: Number(record.claimAmount) }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to save the amount.');
      await onSaved(body);
    } catch (failure) { setError(failure.message || 'Unable to save the amount.'); setBusy(false); }
  };
  return <dialog className="scholar-amount-dialog" ref={dialog} aria-labelledby="scholar-amount-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <form onSubmit={save}>
      <h3 id="scholar-amount-title">Edit scholar amount</h3>
      <p><strong>{record.name}</strong><br />{record.schoolYear} · {record.semester}</p>
      <label htmlFor="scholar-list-amount">Amount (PHP)</label>
      <input autoFocus id="scholar-list-amount" type="number" min="0" max="99999999.99" step="0.01" required value={value} disabled={busy} onChange={event => { setValue(event.target.value); setError(''); }} aria-describedby="scholar-list-amount-help" />
      <p id="scholar-list-amount-help">Use up to two decimal places. This saves the amount for this scholar and academic period.</p>
      {tuition !== null && <p>Tuition assistance: ₱{tuition.toLocaleString('en-PH', { minimumFractionDigits: 2 })}. Remaining allowance: {valid && amount >= tuition ? `₱${((Math.round(amount * 100) - Math.round(tuition * 100)) / 100).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : 'Amount must cover tuition assistance.'}</p>}
      {error && <p role="alert" className="scholar-amount-error">{error}</p>}
      <footer><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" disabled={!valid || busy || (tuition !== null && amount < tuition)}>{busy ? 'Saving…' : 'Save amount'}</button></footer>
    </form>
  </dialog>;
}
