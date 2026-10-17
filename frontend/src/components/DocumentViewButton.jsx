import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, X } from 'lucide-react';
import { API_BASE, authHeaders } from '../services/api';
import '../styles/document-viewer.css';

export default function DocumentViewButton({ token, endpoint, label }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const dialog = useRef(null);
  const trigger = useRef(null);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let active = true, url;
    dialog.current?.focus();
    const triggerElement = trigger.current;
    (async () => {
      try {
        const response = await fetch(`${API_BASE}${endpoint}`, { headers: authHeaders(token), signal: controller.signal, cache: 'no-store' });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.message || 'Unable to open this document.');
        }
        const blob = await response.blob();
        if (!['application/pdf', 'image/jpeg', 'image/png'].includes(blob.type)) throw new Error('This file type cannot be previewed safely.');
        if (!active) return;
        url = URL.createObjectURL(blob); setPreview({ url, type: blob.type });
      } catch (failure) { if (active && failure.name !== 'AbortError') setError(failure.message || 'Unable to open this document.'); }
    })();
    return () => { active = false; controller.abort(); if (url) URL.revokeObjectURL(url); triggerElement?.focus(); };
  }, [open, endpoint, token]);
  const trapKeys = event => {
    if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); }
    if (event.key === 'Tab') {
      const controls = [...dialog.current.querySelectorAll('button, a[href], iframe')];
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  };
  return <><button ref={trigger} type="button" className="document-view-button" onClick={() => { setPreview(null); setError(''); setOpen(true); }} aria-label={`View ${label}`}><Eye size={14} aria-hidden="true" />View</button>{open && createPortal(
    <div className="document-view-overlay" onKeyDown={trapKeys}>
      <section ref={dialog} className="document-view-dialog" role="dialog" aria-modal="true" aria-label={`Document preview: ${label}`} tabIndex={-1}>
        <header><h2>{label}</h2><button type="button" onClick={() => setOpen(false)} aria-label="Close document preview"><X size={20} /></button></header>
        {error ? <p role="alert">{error}</p> : !preview ? <p role="status">Loading document...</p> : <>
          <a href={preview.url} target="_blank" rel="noopener noreferrer">Open file in a new tab</a>
          {preview.type === 'application/pdf' ? <iframe title={`${label} PDF preview`} src={preview.url} /> : <img src={preview.url} alt={`${label} uploaded document`} />}
        </>}
      </section>
    </div>, document.body)}</>;
}
