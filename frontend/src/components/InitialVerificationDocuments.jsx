import DocumentViewButton from './DocumentViewButton';
import '../styles/initial-verification-documents.css';

const statusClass = document => {
  if (!document.submitted) return 'not-submitted';
  const status = String(document.status || '').toLowerCase();
  if (['approved', 'complete', 'completed'].includes(status)) return 'approved';
  if (['rejected', 'declined'].includes(status)) return 'rejected';
  return 'pending';
};

export default function InitialVerificationDocuments({ intake, token }) {
  return <section className="initial-verification-documents" aria-label="Initial document submissions">
    <h4>Document submissions{intake.schoolYear ? ` · ${intake.schoolYear}` : ''}{intake.semester ? ` · ${intake.semester}` : ''}</h4>
    <div className="scholars-document-list">{intake.initialDocuments.map(document => <div key={document.requirementKey} className="scholars-document-entry">
      <span className="initial-verification-document-copy">{document.label}<small>Initial · CAO upload{document.submitted ? ' · Attached' : ''}</small></span>
      <div className="scholars-document-actions"><strong className={statusClass(document)}>{document.submitted ? document.status || 'Pending' : 'Not Submitted'}</strong>{document.submitted && document.applicationId && document.requirementKey && <DocumentViewButton token={token} label={document.label} endpoint={`/document-reviews/${document.applicationId}/${document.requirementKey}/file?academicPeriodId=${document.academicPeriodId}&submissionWave=initial`} />}</div>
    </div>)}</div>
  </section>;
}
