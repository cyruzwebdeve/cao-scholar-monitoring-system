import { Eye, FileText } from 'lucide-react';
import '../styles/document-version-history.css';

export default function DocumentVersionHistory({ documents = [], onView, openingRequirement }) {
  if (!documents.length) return null;
  return <section className="scholars-detail-section scholar-document-history" aria-label="Previous document versions">
    <h4>Previous document versions</h4>
    <ul className="scholar-document-history-list">
      {documents.map((document, index) => {
        const status = String(document.status || 'Status unavailable');
        const normalized = status.toLowerCase();
        const tone = ['approved', 'complete', 'completed'].includes(normalized) ? 'approved' : ['rejected', 'declined'].includes(normalized) ? 'returned' : 'neutral';
        const wave = document.submissionWave === 'initial' ? 'Initial' : document.submissionWave === 'continuing' ? 'Continuing' : 'Earlier submission';
        return <li className="scholar-document-history-item" key={`${document.academicPeriodId}:${document.submissionWave}:${document.versionId || index}`}>
          <span className="scholar-document-history-icon" aria-hidden="true"><FileText size={18} /></span>
          <div className="scholar-document-history-copy">
            <strong className="scholar-document-history-name">{document.fileName || 'Document'}</strong>
            <div className="scholar-document-history-meta"><span>{wave}</span><span>{document.periodLabel || 'Earlier submission'}</span></div>
            <span className={`scholar-document-history-status ${tone}`}>{status}</span>
          </div>
          <button type="button" className="scholar-document-history-view" onClick={() => onView(document)} disabled={Boolean(openingRequirement)} aria-label={`View previous file: ${document.fileName || 'Document'}, ${wave}, ${document.periodLabel || 'Earlier submission'}`}><Eye size={14} aria-hidden="true" />{openingRequirement && openingRequirement === document.requirementKey ? 'Opening...' : 'View previous file'}</button>
        </li>;
      })}
    </ul>
  </section>;
}
