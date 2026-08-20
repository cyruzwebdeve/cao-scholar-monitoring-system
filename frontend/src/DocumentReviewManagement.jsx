import {
  CheckCircle2,
  ChevronDown,
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

const emptyData = { stats: { total: 0, pending: 0, approved: 0, rejected: 0 }, reviews: [], physicalFolders: [] };

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
          <section className="review-preview-column">
            <header className="review-preview-toolbar">
              <div><i><FileText size={16} /></i><span><small>SECURE DOCUMENT PREVIEW</small><strong title={review.fileName}>{review.fileName}</strong></span></div>
              {preview && !previewLoading && !previewError && <a href={preview} target="_blank" rel="noreferrer"><ExternalLink size={14} />Open original</a>}
            </header>
            <div className={`review-preview ${isPdf ? 'pdf' : ''}`}>
            {previewLoading && <div className="review-preview-state"><span className="review-loader" /><strong>Opening secure document…</strong></div>}
            {previewError && <div className="review-preview-state error"><TriangleAlert size={25} /><strong>Preview unavailable</strong><p>{previewError}</p></div>}
            {!previewLoading && !previewError && preview && isImage && <img src={preview} alt={review.fileName} />}
            {!previewLoading && !previewError && preview && isPdf && <iframe src={preview} title={review.fileName} />}
            {!previewLoading && !previewError && preview && !isImage && !isPdf && <div className="review-preview-state"><FileText size={30} /><strong>{review.fileName}</strong><a href={preview} target="_blank" rel="noreferrer"><ExternalLink size={14} />Open file</a></div>}
            </div>
          </section>
          <aside className="review-details">
            <header><div><span>REVIEW DETAILS</span><h4>Submission information</h4></div><strong className={`review-status ${review.status}`}>{titleCase(review.status)}</strong></header>
            <dl>
              <div><dt>File name</dt><dd>{review.fileName}</dd></div>
              <div><dt>File type</dt><dd>{review.fileType}</dd></div>
              <div><dt>Uploaded</dt><dd>{formatDate(review.uploadedAt)}</dd></div>
              <div><dt>Municipality</dt><dd>{review.municipality}</dd></div>
              {review.reviewedAt && <div><dt>Last reviewed</dt><dd>{formatDate(review.reviewedAt)}{review.reviewerName ? ` by ${review.reviewerName}` : ''}</dd></div>}
            </dl>
            {review.reviewNotes && <div className="review-existing-note"><span>Review notes</span><p>{review.reviewNotes}</p></div>}
            <div className="review-guidance"><ShieldCheck size={18} /><div><strong>Reviewer checklist</strong><p>Confirm that the document is readable, current, and matches the scholar record before approval.</p></div></div>
          </aside>
        </div>
        <footer>
          <div className="review-decision-helper"><ShieldCheck size={16} /><span><strong>Ready to decide?</strong><small>Your decision and notes will be recorded in Activity Logs.</small></span></div>
          <div className="review-modal-actions"><button type="button" className="review-reject" onClick={() => onDecision('rejected')}><XCircle size={16} />Reject document</button><button type="button" className="review-approve" onClick={() => onDecision('approved')}><CheckCircle2 size={16} />Approve document</button></div>
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

function BulkApprovalModal({ group, saving, error, onClose, onConfirm }) {
  return (
    <div className="review-decision-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}>
      <section className="review-decision bulk-approval-dialog" role="dialog" aria-modal="true" aria-label="Approve all pending documents">
        <header><i className="approved"><CheckCircle2 size={22} /></i><div><span>BULK DOCUMENT REVIEW</span><h3>Approve all pending files?</h3></div></header>
        <p>This will approve <strong>{group.pendingTotal}</strong> pending {group.pendingTotal === 1 ? 'requirement' : 'requirements'} uploaded by <strong>{group.scholarName}</strong>. Rejected files will remain unchanged.</p>
        <div className="bulk-approval-summary"><ShieldCheck size={18} /><span><strong>One recorded decision</strong><small>The complete batch will be saved together and added to Activity Logs.</small></span></div>
        {error && <div className="review-decision-error"><TriangleAlert size={16} />{error}</div>}
        <footer><button type="button" onClick={onClose} disabled={saving}>Cancel</button><button type="button" className="success" onClick={onConfirm} disabled={saving}>{saving ? 'Approving…' : `Approve ${group.pendingTotal} pending`}</button></footer>
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
  const [expandedScholar, setExpandedScholar] = useState(null);
  const [selected, setSelected] = useState(null);
  const [preview, setPreview] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [decision, setDecision] = useState('');
  const [decisionError, setDecisionError] = useState('');
  const [bulkGroup, setBulkGroup] = useState(null);
  const [bulkError, setBulkError] = useState('');
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
      && (!query || [item.scholarName, item.email, item.controlNumber, item.fileName, item.requirementLabel]
        .some((value) => String(value || '').toLowerCase().includes(query))));
  }, [data.reviews, requirement, search, status]);
  const groupedReviews = useMemo(() => {
    const pendingByGroup = new Map();
    data.reviews.forEach((item) => {
      if (item.status !== 'pending') return;
      const key = String(item.applicationId || item.applicantId || `${item.controlNumber}-${item.email}`);
      pendingByGroup.set(key, (pendingByGroup.get(key) || 0) + 1);
    });
    const groups = new Map();
    visibleReviews.forEach((item) => {
      const key = String(item.applicationId || item.applicantId || `${item.controlNumber}-${item.email}`);
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          scholarName: item.scholarName,
          controlNumber: item.controlNumber,
          email: item.email,
          items: [],
        });
      }
      groups.get(key).items.push(item);
    });
    return [...groups.values()].map((group) => ({
      ...group,
      pendingTotal: pendingByGroup.get(group.key) || 0,
      counts: group.items.reduce((totals, item) => ({
        ...totals,
        [item.status]: (totals[item.status] || 0) + 1,
      }), { pending: 0, approved: 0, rejected: 0 }),
    }));
  }, [data.reviews, visibleReviews]);

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

  const updatePhysicalFolder = async (item) => {
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/document-reviews/${item.applicantId}/physical-folder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ received: !item.received }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Unable to update the physical folder.');
      setNotice({ tone: 'success', message: payload.message });
      await loadReviews();
    } catch (saveError) {
      setNotice({ tone: 'error', message: saveError.message || 'Unable to update the physical folder.' });
    } finally {
      setSaving(false);
    }
  };

  const approvePendingForScholar = async () => {
    if (!bulkGroup) return;
    setSaving(true);
    setBulkError('');
    try {
      const response = await fetch(`${API_BASE}/document-reviews/${bulkGroup.key}/approve-pending`, {
        method: 'PUT',
        headers: authHeaders(token),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Unable to approve the pending documents.');
      setNotice({ tone: 'success', message: payload.message });
      setBulkGroup(null);
      await loadReviews();
    } catch (approvalError) {
      setBulkError(approvalError.message || 'Unable to approve the pending documents.');
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
      {notice && <div className={`document-review-notice ${notice.tone}`} role="status">{notice.tone === 'success' ? <CheckCircle2 size={18} /> : <TriangleAlert size={18} />}<span>{notice.message}</span><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss"><X size={16} /></button></div>}
      {error && <div className="document-review-notice error" role="status"><TriangleAlert size={18} /><span>{error}</span><button type="button" onClick={loadReviews}>Retry</button></div>}
      <section className="document-review-directory">
        <div className="document-review-toolbar"><div><i><ClipboardCheck size={19} /></i><section><h3>Review queue</h3><p>{groupedReviews.length} {groupedReviews.length === 1 ? 'scholar' : 'scholars'} · {visibleReviews.length} of {data.reviews.length} files shown</p></section></div><div className="document-review-filters"><label><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Scholar, control number, or file" /></label><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter review status"><option value="pending">Pending review</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="">All statuses</option></select><select value={requirement} onChange={(event) => setRequirement(event.target.value)} aria-label="Filter requirement"><option value="">All requirements</option>{requirementOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div></div>
        <div className="document-review-groups">
          {loading && !data.reviews.length && <div className="document-review-group-empty"><span className="review-loader" />Loading secure document queue…</div>}
          {!loading && !visibleReviews.length && <div className="document-review-group-empty"><ClipboardCheck size={27} /><strong>{status === 'pending' ? 'Review queue is clear' : 'No documents found'}</strong><span>{status === 'pending' ? 'New scholar uploads will appear here automatically.' : 'Try changing the current filters.'}</span></div>}
          {groupedReviews.map((group) => {
            const expanded = expandedScholar === group.key;
            const panelId = `scholar-review-${group.key.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
            const initials = group.scholarName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('');
            return (
              <article className={`document-review-scholar ${expanded ? 'expanded' : ''}`} key={group.key}>
                <button type="button" className="document-review-scholar-trigger" onClick={() => setExpandedScholar(expanded ? null : group.key)} aria-expanded={expanded} aria-controls={panelId}>
                  <span className="document-review-scholar-avatar" aria-hidden="true">{initials}</span>
                  <span className="document-review-scholar-identity"><strong>{group.scholarName}</strong><small>{[group.controlNumber, group.email].filter(Boolean).join(' · ')}</small></span>
                  <span className="document-review-scholar-summary">
                    {group.counts.pending > 0 && <span className="pending">{group.counts.pending} pending</span>}
                    {group.counts.approved > 0 && <span className="approved">{group.counts.approved} approved</span>}
                    {group.counts.rejected > 0 && <span className="rejected">{group.counts.rejected} rejected</span>}
                  </span>
                  <span className="document-review-scholar-total"><strong>{group.items.length}</strong><small>{group.items.length === 1 ? 'file' : 'files'}</small></span>
                  <ChevronDown className="document-review-chevron" size={19} aria-hidden="true" />
                </button>
                {expanded && (
                  <div className="document-review-requirements" id={panelId}>
                    {group.pendingTotal > 0 && <div className="document-review-bulk-bar"><span><strong>{group.pendingTotal} pending {group.pendingTotal === 1 ? 'file' : 'files'}</strong><small>Approve this scholar's pending uploads together.</small></span><button type="button" onClick={() => { setBulkError(''); setBulkGroup(group); }}><CheckCircle2 size={15} />Approve all pending</button></div>}
                    <div className="document-review-requirement-head"><span>Requirement</span><span>Uploaded</span><span>Status</span><span>Reviewed by</span><span>Action</span></div>
                    {group.items.map((item) => (
                      <div className="document-review-requirement" key={item.id}>
                        <div className="document-review-requirement-name"><strong>{item.requirementLabel}</strong><small title={item.fileName}>{item.fileName}</small></div>
                        <div data-label="Uploaded">{formatDate(item.uploadedAt)}</div>
                        <div data-label="Status"><span className={`review-status ${item.status}`}>{titleCase(item.status)}</span></div>
                        <div data-label="Reviewed by"><span>{item.reviewerName || '—'}</span>{item.reviewedAt && <small>{formatDate(item.reviewedAt)}</small>}</div>
                        <div data-label="Action"><button type="button" className="document-review-open" onClick={() => openReview(item)}><Eye size={15} />Review file</button></div>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
      <section className="document-review-directory physical-folder-directory">
        <div className="document-review-toolbar"><div><i><FileCheck2 size={19} /></i><section><h3>Physical folder receipts</h3><p>Record the white long folder before a scholar becomes eligible for Billing.</p></section></div><span className="physical-folder-count">{(data.physicalFolders || []).filter(({ received }) => received).length} of {(data.physicalFolders || []).length} received</span></div>
        <div className="physical-folder-list">
          {(data.physicalFolders || []).map((item) => <article key={item.applicantId}><div><strong>{item.scholarName}</strong><small>{item.controlNumber || `Scholar #${item.applicantId}`}</small></div><span className={item.received ? 'received' : 'missing'}>{item.received ? `Received ${formatDate(item.receivedAt)}` : 'Not received'}</span><button type="button" className={item.received ? 'remove' : 'receive'} disabled={saving} onClick={() => updatePhysicalFolder(item)}>{item.received ? 'Undo receipt' : 'Mark received'}</button></article>)}
          {!loading && !(data.physicalFolders || []).length && <div className="document-review-group-empty"><FileCheck2 size={25} /><strong>No active scholars</strong><span>Accepted scholars will appear here.</span></div>}
        </div>
      </section>
      {selected && <ReviewModal review={selected} preview={preview} previewLoading={previewLoading} previewError={previewError} onClose={closeReview} onDecision={(value) => { setDecisionError(''); setDecision(value); }} />}
      {decision && selected && <DecisionModal review={selected} decision={decision} saving={saving} error={decisionError} onClose={() => !saving && setDecision('')} onConfirm={saveDecision} />}
      {bulkGroup && <BulkApprovalModal group={bulkGroup} saving={saving} error={bulkError} onClose={() => !saving && setBulkGroup(null)} onConfirm={approvePendingForScholar} />}
    </div>
  );
}

export default DocumentReviewManagement;
