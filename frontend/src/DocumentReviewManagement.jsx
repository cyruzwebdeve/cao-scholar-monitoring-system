import {
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  RefreshCw,
  Search,
  ShieldCheck,
  TriangleAlert,
  X,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE, authHeaders } from './services/api';
import './styles/document-reviews.css';

const emptyData = { stats: { total: 0, pending: 0, approved: 0, rejected: 0 }, reviews: [] };

const formatDate = (value, fallback = 'Not available') => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const titleCase = (value) => `${String(value || '').charAt(0).toUpperCase()}${String(value || '').slice(1)}`;

function ReviewModal({ review, preview, previewLoading, previewError, onClose, onDecision }) {
  useEffect(() => {
    const close = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);

  const isImage = review.fileType.startsWith('image/');
  const isPdf = review.fileType === 'application/pdf' || review.fileName.toLowerCase().endsWith('.pdf');

  return (
    <div className="review-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="review-modal" role="dialog" aria-modal="true" aria-label={`Review ${review.requirementLabel}`}>
        <header>
          <div><span>DOCUMENT REVIEW</span><h3>{review.requirementLabel}</h3><p>{review.scholarName} · {review.controlNumber || review.email}</p></div>
          <button type="button" onClick={onClose} aria-label="Close review"><X size={19} /></button>
        </header>
        <div className="review-modal-body">
          <div className="review-preview">
            {previewLoading && <div className="review-preview-state"><span className="review-loader" /><strong>Opening secure document…</strong></div>}
            {previewError && <div className="review-preview-state error"><TriangleAlert size={25} /><strong>Preview unavailable</strong><p>{previewError}</p></div>}
            {!previewLoading && !previewError && preview && isImage && <img src={preview} alt={review.fileName} />}
            {!previewLoading && !previewError && preview && isPdf && <iframe src={preview} title={review.fileName} />}
            {!previewLoading && !previewError && preview && !isImage && !isPdf && <div className="review-preview-state"><FileText size={30} /><strong>{review.fileName}</strong><a href={preview} target="_blank" rel="noreferrer"><ExternalLink size={14} />Open file</a></div>}
          </div>
          <aside className="review-details">
            <div className="review-current-status"><span>Current status</span><strong className={`review-status ${review.status}`}>{titleCase(review.status)}</strong></div>
            <dl>
              <div><dt>File name</dt><dd>{review.fileName}</dd></div>
              <div><dt>File type</dt><dd>{review.fileType}</dd></div>
              <div><dt>Uploaded</dt><dd>{formatDate(review.uploadedAt)}</dd></div>
              <div><dt>Municipality</dt><dd>{review.municipality}</dd></div>
              {review.reviewedAt && <div><dt>Last reviewed</dt><dd>{formatDate(review.reviewedAt)}{review.reviewerName ? ` by ${review.reviewerName}` : ''}</dd></div>}
            </dl>
            {review.reviewNotes && <div className="review-existing-note"><span>Review notes</span><p>{review.reviewNotes}</p></div>}
            <div className="review-guidance"><ShieldCheck size={18} /><p>Confirm that the document is readable, current, and matches the scholar record before approval.</p></div>
          </aside>
        </div>
        <footer>
          <button type="button" className="review-reject" onClick={() => onDecision('rejected')}><XCircle size={16} />Reject document</button>
          <button type="button" className="review-approve" onClick={() => onDecision('approved')}><CheckCircle2 size={16} />Approve document</button>
        </footer>
      </section>
    </div>
  );
}

function DecisionModal({ review, decision, saving, error, onClose, onConfirm }) {
  const [notes, setNotes] = useState(decision === 'rejected' ? '' : review.reviewNotes || '');
  const rejected = decision === 'rejected';
  return (
    <div className="review-decision-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}>
      <section className="review-decision" role="dialog" aria-modal="true" aria-label={`${titleCase(decision)} document`}>
        <header><i className={decision}>{rejected ? <XCircle size={22} /> : <CheckCircle2 size={22} />}</i><div><span>{rejected ? 'RETURN FOR CORRECTION' : 'CONFIRM APPROVAL'}</span><h3>{rejected ? 'Reject this document?' : 'Approve this document?'}</h3></div></header>
        <p>{rejected ? 'The scholar will see your reason and can upload a corrected file.' : 'This file will count as an approved requirement across the scholar and administrative dashboards.'}</p>
        <label><span>{rejected ? 'Reason for rejection' : 'Review note (optional)'}</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength="500" placeholder={rejected ? 'Explain what needs to be corrected…' : 'Add an internal review note…'} /></label>
        {error && <div className="review-decision-error"><TriangleAlert size={16} />{error}</div>}
        <footer><button type="button" onClick={onClose} disabled={saving}>Cancel</button><button type="button" className={rejected ? 'danger' : 'success'} onClick={() => onConfirm(notes)} disabled={saving || (rejected && notes.trim().length < 3)}>{saving ? 'Saving…' : rejected ? 'Reject and return' : 'Confirm approval'}</button></footer>
      </section>
    </div>
  );
}

function DocumentReviewManagement({ token }) {
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('pending');
  const [requirement, setRequirement] = useState('');
  const [selected, setSelected] = useState(null);
  const [preview, setPreview] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [decision, setDecision] = useState('');
  const [decisionError, setDecisionError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchReviews = useCallback(async () => {
    const response = await fetch(`${API_BASE}/document-reviews`, { headers: authHeaders(token) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || 'Unable to load document reviews.');
    return payload;
  }, [token]);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchReviews());
      setError('');
    } catch (loadError) {
      setError(loadError.message || 'Document reviews could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [fetchReviews]);

  useEffect(() => {
    let active = true;
    const refresh = () => fetchReviews().then((payload) => { if (active) { setData(payload); setError(''); } })
      .catch((loadError) => { if (active) setError(loadError.message || 'Document reviews could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [fetchReviews]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const requirementOptions = useMemo(() => [...new Map(data.reviews.map((item) => [item.requirementKey, item.requirementLabel])).entries()], [data.reviews]);
  const visibleReviews = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.reviews.filter((item) => (!status || item.status === status)
      && (!requirement || item.requirementKey === requirement)
      && (!query || [item.scholarName, item.email, item.controlNumber, item.fileName].some((value) => String(value || '').toLowerCase().includes(query))));
  }, [data.reviews, requirement, search, status]);

  const closeReview = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview('');
    setSelected(null);
    setPreviewError('');
  }, [preview]);

  const openReview = async (review) => {
    if (preview) URL.revokeObjectURL(preview);
    setSelected(review);
    setPreview('');
    setPreviewError('');
    setPreviewLoading(true);
    try {
      const response = await fetch(`${API_BASE}/document-reviews/${review.applicationId}/${review.requirementKey}/file`, { headers: authHeaders(token) });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || 'Unable to open the document.');
      }
      setPreview(URL.createObjectURL(await response.blob()));
    } catch (openError) {
      setPreviewError(openError.message || 'Unable to open the document.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const saveDecision = async (notes) => {
    setSaving(true);
    setDecisionError('');
    try {
      const response = await fetch(`${API_BASE}/document-reviews/${selected.applicationId}/${selected.requirementKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ decision, notes }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Unable to save the review decision.');
      setNotice({ tone: 'success', message: payload.message });
      setDecision('');
      closeReview();
      await loadReviews();
    } catch (saveError) {
      setDecisionError(saveError.message || 'Unable to save the review decision.');
    } finally {
      setSaving(false);
    }
  };

  const metrics = [
    ['Pending review', data.stats.pending, Clock3, 'amber', 'Files waiting for a decision'],
    ['Approved', data.stats.approved, FileCheck2, 'green', 'Accepted scholar documents'],
    ['Rejected', data.stats.rejected, XCircle, 'red', 'Returned for correction'],
    ['Total uploads', data.stats.total, ClipboardCheck, 'blue', 'Documents in the review history'],
  ];

  return (
    <div className="document-reviews">
      <header className="document-review-heading"><div><span>CONTENT MODERATION</span><h2>Document Reviews</h2><p>Verify scholar uploads before they count toward completed requirements.</p></div><button type="button" onClick={loadReviews} disabled={loading}><RefreshCw size={16} className={loading ? 'spinning' : ''} />Refresh queue</button></header>
      <div className="document-review-metrics">{metrics.map(([label, value, Icon, tone, helper]) => <article className={tone} key={label}><div><span>{label}</span><strong>{value}</strong><small>{helper}</small></div><i><Icon size={21} /></i></article>)}</div>
      {notice && <div className="document-review-notice success" role="status"><CheckCircle2 size={18} /><span>{notice.message}</span><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss"><X size={16} /></button></div>}
      {error && <div className="document-review-notice error" role="status"><TriangleAlert size={18} /><span>{error}</span><button type="button" onClick={loadReviews}>Retry</button></div>}
      <section className="document-review-directory">
        <div className="document-review-toolbar"><div><i><ClipboardCheck size={19} /></i><section><h3>Review queue</h3><p>{visibleReviews.length} of {data.reviews.length} uploaded files shown</p></section></div><div className="document-review-filters"><label><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Scholar, control number, or file" /></label><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter review status"><option value="pending">Pending review</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="">All statuses</option></select><select value={requirement} onChange={(event) => setRequirement(event.target.value)} aria-label="Filter requirement"><option value="">All requirements</option>{requirementOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div></div>
        <div className="document-review-table-wrap"><table className="document-review-table"><thead><tr><th>Scholar</th><th>Requirement</th><th>Uploaded</th><th>Status</th><th>Reviewed by</th><th>Action</th></tr></thead><tbody>
          {loading && !data.reviews.length && <tr className="document-review-empty"><td colSpan="6"><span className="review-loader" />Loading secure document queue…</td></tr>}
          {!loading && !visibleReviews.length && <tr className="document-review-empty"><td colSpan="6"><ClipboardCheck size={27} /><strong>{status === 'pending' ? 'Review queue is clear' : 'No documents found'}</strong><span>{status === 'pending' ? 'New scholar uploads will appear here automatically.' : 'Try changing the current filters.'}</span></td></tr>}
          {visibleReviews.map((item) => <tr key={item.id}><td data-label="Scholar"><strong>{item.scholarName}</strong><small>{item.controlNumber || item.email}</small></td><td data-label="Requirement"><strong>{item.requirementLabel}</strong><small>{item.fileName}</small></td><td data-label="Uploaded"><span>{formatDate(item.uploadedAt)}</span></td><td data-label="Status"><span className={`review-status ${item.status}`}>{titleCase(item.status)}</span></td><td data-label="Reviewed by"><span>{item.reviewerName || '—'}</span>{item.reviewedAt && <small>{formatDate(item.reviewedAt)}</small>}</td><td data-label="Action"><button type="button" className="document-review-open" onClick={() => openReview(item)}><Eye size={15} />Review file</button></td></tr>)}
        </tbody></table></div>
      </section>
      {selected && <ReviewModal review={selected} preview={preview} previewLoading={previewLoading} previewError={previewError} onClose={closeReview} onDecision={(value) => { setDecisionError(''); setDecision(value); }} />}
      {decision && selected && <DecisionModal review={selected} decision={decision} saving={saving} error={decisionError} onClose={() => !saving && setDecision('')} onConfirm={saveDecision} />}
    </div>
  );
}

export default DocumentReviewManagement;
