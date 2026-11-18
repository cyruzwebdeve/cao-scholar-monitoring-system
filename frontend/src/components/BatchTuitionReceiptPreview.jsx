import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, FileText, RefreshCw } from 'lucide-react';
import { API_BASE, authHeaders } from '../services/api';
import '../styles/batch-tuition-receipt.css';

const positiveId = value => {
  if (!(typeof value === 'number' || typeof value === 'string' && /^\d+$/.test(value))) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

export default function BatchTuitionReceiptPreview({ token, applicantId, periodId, label, active = true }) {
  const [view, setView] = useState(null);
  const [revision, setRevision] = useState(0);
  const [zoom, setZoom] = useState(null);
  const scopeRef = useRef(null);
  const scholarId = positiveId(applicantId), academicPeriodId = positiveId(periodId);
  const endpoint = scholarId && academicPeriodId ? `/scholars/${scholarId}/tuition-receipt?academicPeriodId=${academicPeriodId}` : '';
  const canLoad = Boolean(active && token && endpoint);
  const scope = useMemo(() => ({ endpoint, token, revision, canLoad }), [endpoint, token, revision, canLoad]);
  const currentView = canLoad && view?.scope === scope ? view : null;
  const currentZoom = zoom?.endpoint === endpoint && zoom?.token === token ? zoom.percent : 100;

  useLayoutEffect(() => {
    scopeRef.current = scope;
    return () => { scopeRef.current = null; };
  }, [scope]);

  useEffect(() => {
    if (!scope.canLoad) return undefined;
    const controller = new AbortController();
    let objectUrl;
    const isCurrent = () => scopeRef.current === scope && !controller.signal.aborted;
    (async () => {
      try {
        const response = await fetch(`${API_BASE}${scope.endpoint}`, { headers: authHeaders(scope.token), cache: 'no-store', signal: controller.signal });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.message || 'Unable to load the tuition receipt.');
        }
        const blob = await response.blob();
        if (!['application/pdf', 'image/jpeg', 'image/png'].includes(blob.type)) throw new Error('This file type cannot be previewed safely.');
        if (!isCurrent()) return;
        objectUrl = URL.createObjectURL(blob);
        setView({ scope, url: objectUrl, type: blob.type, error: '' });
      } catch (failure) {
        if (isCurrent() && failure.name !== 'AbortError') setView({ scope, error: failure.message || 'Unable to load the tuition receipt.' });
      }
    })();
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [scope]);

  const retryPreview = () => setRevision(current => current + 1);

  return <section className="batch-tuition-receipt" aria-label="Selected Scholar tuition receipt" aria-busy={canLoad && !currentView}>
    <header><div><span>RECEIPT PREVIEW</span><h4>{label || 'Tuition receipt'}</h4></div><FileText size={18} aria-hidden="true" /></header>
    {!canLoad ? <p className="batch-receipt-empty">Select a Scholar to review the tuition receipt beside their amount.</p>
      : !currentView ? <p className="batch-receipt-empty" role="status">Loading tuition receipt…</p>
        : currentView.error ? <div className="batch-receipt-error" role="alert"><p>{currentView.error}</p><button type="button" onClick={retryPreview}><RefreshCw size={14} aria-hidden="true" />Retry receipt</button></div>
          : <>
            <div className="batch-receipt-toolbar"><a href={currentView.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} aria-hidden="true" />Open original file</a>{currentView.type !== 'application/pdf' && <label>Image size<select value={currentZoom} onChange={event => setZoom({ endpoint, token, percent: Number(event.target.value) })}><option value={100}>Fit width</option><option value={150}>150%</option><option value={200}>200%</option></select></label>}</div>
            {currentView.type === 'application/pdf' ? <iframe title={`${label || 'Selected Scholar'} tuition receipt PDF`} src={currentView.url} />
              : <div className="batch-receipt-image"><img src={currentView.url} alt={`${label || 'Selected Scholar'} uploaded tuition receipt`} style={{ width: `${currentZoom}%` }} /></div>}
          </>}
  </section>;
}
