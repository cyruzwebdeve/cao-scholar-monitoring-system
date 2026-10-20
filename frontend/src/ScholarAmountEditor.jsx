import { useEffect, useRef, useState } from 'react';
import { API_BASE, authHeaders } from './services/api';
export default function ScholarAmountEditor({ record, token, onSaved, onClose, onError }) {
  const editor = useRef(null);
  const saving = useRef(false);
  const cancelled = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    editor.current.textContent = String(record.claimAmount);
    editor.current.focus();
    const range = document.createRange();
    range.selectNodeContents(editor.current);
    const selection = window.getSelection();
    selection.removeAllRanges(); selection.addRange(range);
  }, [record.claimAmount]);
  const report = message => { setError(message); onError?.(message); };
  const save = async () => {
    if (saving.current || cancelled.current) return;
    const text = editor.current.textContent.trim().replace(/^₱\s*/, '');
    const amount = Number(text.replaceAll(',', ''));
    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text) || !Number.isFinite(amount) || amount < 0 || amount > 99999999.99) {
      report('Enter an amount from PHP 0 to PHP 99,999,999.99 with at most two decimal places.'); return;
    }
    if (record.schoolType === 'Private' && record.grantPrepared && amount < Number(record.tuitionFeeAssistance)) {
      report('The amount must cover the saved tuition assistance.'); return;
    }
    if (amount === Number(record.claimAmount)) { cancelled.current = true; onClose(); return; }
    saving.current = true; setBusy(true); setError('');
    try {
      const response = await fetch(`${API_BASE}/scholars/${record.applicantId}/amount`, { method: 'PUT', headers: { ...authHeaders(token), 'Content-Type': 'application/json' }, body: JSON.stringify({ academicPeriodId: record.academicPeriodId, amount, expectedAmount: Number(record.claimAmount) }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to save the amount.');
      await onSaved(body);
    } catch (failure) { saving.current = false; setBusy(false); report(failure.message || 'Unable to save the amount.'); }
  };
  const paste = event => {
    event.preventDefault();
    const text = event.clipboardData.getData('text/plain').replace(/[\r\n]+/g, '');
    const selection = window.getSelection();
    if (!selection?.rangeCount || !editor.current.contains(selection.anchorNode) || !editor.current.contains(selection.focusNode)) return;
    const range = selection.getRangeAt(0); range.deleteContents();
    const node = document.createTextNode(text); range.insertNode(node); range.setStartAfter(node); range.collapse(true);
    selection.removeAllRanges(); selection.addRange(range); setError('');
  };
  return <span className="scholar-amount-direct" aria-busy={busy}>
    <span aria-hidden="true">₱</span><span ref={editor} role="textbox" aria-label={`Amount in PHP for ${record.name}`} aria-multiline="false" aria-readonly={busy} aria-invalid={Boolean(error)} contentEditable={!busy} suppressContentEditableWarning inputMode="decimal" onPaste={paste} onInput={() => setError('')} onBlur={save} onKeyDown={event => {
      if (event.key === 'Enter') { event.preventDefault(); save(); }
      if (event.key === 'Escape') { event.preventDefault(); if (!saving.current) { cancelled.current = true; onClose(); } }
    }} />
  </span>;
}
