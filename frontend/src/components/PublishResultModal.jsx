import { useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import '../styles/publish-result-modal.css';

export default function PublishResultModal({ result, busy, error, onCancel, onConfirm }) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal(); cancelRef.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = previousOverflow; if (previousFocus?.isConnected) previousFocus.focus(); };
  }, []);
  return <dialog ref={dialogRef} className="publish-result-modal" aria-modal="true" aria-labelledby="publish-result-title" aria-describedby="publish-result-description" aria-busy={busy} onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }} onKeyDown={event => { if (event.key === 'Escape') event.stopPropagation(); }}>
    <span className="publish-result-icon" aria-hidden="true"><Send size={24} /></span>
    <p className="publish-result-eyebrow">EXAMINATION RESULT</p>
    <h2 id="publish-result-title">Publish reviewed result?</h2>
    <p id="publish-result-description">Publish this reviewed score and outcome to the applicant dashboard?</p>
    <dl className="publish-result-summary"><div><dt>Applicant</dt><dd>{result.name}</dd></div><div><dt>Score</dt><dd>{result.score ?? 'Not recorded'}</dd></div><div><dt>Outcome</dt><dd>{result.status}</dd></div></dl>
    <p className="publish-result-note">This publishes the examination result only. Passer List posting, initial verification and Scholar acceptance remain separate steps.</p>
    {error && <p className="publish-result-error" role="alert">{error}</p>}
    {busy && <p className="publish-result-progress" role="status">Publishing reviewed result. Please wait...</p>}
    <footer><button ref={cancelRef} type="button" disabled={busy} onClick={onCancel}>Cancel</button><button type="button" className="publish-result-confirm" disabled={busy} onClick={onConfirm}><Send size={15} aria-hidden="true" />{busy ? 'Publishing...' : 'Publish result'}</button></footer>
  </dialog>;
}
