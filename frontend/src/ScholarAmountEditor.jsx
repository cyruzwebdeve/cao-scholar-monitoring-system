import { useEffect, useRef, useState } from 'react';
import { API_BASE, authHeaders } from './services/api';
export default function ScholarAmountEditor({ record, token, onSaved, onClose }) {
  const input = useRef(null);
  const [value, setValue] = useState(String(record.claimAmount));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const amount = Number(value);
  const valid = value.trim() !== '' && Number.isFinite(amount) && amount >= 0 && amount <= 99999999.99 && amount === Math.round(amount * 100) / 100;
  const tuition = record.schoolType === 'Private' && record.grantPrepared ? Number(record.tuitionFeeAssistance) : null;
  useEffect(() => { input.current.focus(); input.current.select(); }, []);
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
  return <form className="scholar-amount-inline" aria-label={`Edit amount for ${record.name}`} onSubmit={save} onKeyDown={event => { if (event.key === 'Escape' && !busy) { event.preventDefault(); onClose(); } }}>
    <input ref={input} aria-label={`Amount in PHP for ${record.name}`} type="number" min="0" max="99999999.99" step="0.01" required value={value} disabled={busy} onChange={event => { setValue(event.target.value); setError(''); }} />
    {tuition !== null && <small>Allowance: {valid && amount >= tuition ? `₱${((Math.round(amount * 100) - Math.round(tuition * 100)) / 100).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : 'Amount must cover tuition assistance.'}</small>}
    {error && <small role="alert" className="scholar-amount-error">{error}</small>}
    <div className="scholar-amount-inline-actions"><button type="submit" disabled={!valid || busy || (tuition !== null && amount < tuition)}>{busy ? 'Saving…' : 'Save'}</button><button type="button" disabled={busy} onClick={onClose}>Cancel</button></div>
  </form>;
}
