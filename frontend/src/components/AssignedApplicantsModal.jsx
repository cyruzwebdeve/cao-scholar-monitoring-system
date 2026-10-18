import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, Info, LockKeyhole, Search, X } from 'lucide-react';
import Notification from './Notification';
import { filterExamRoster } from '../utils/examinationUi';
import '../styles/examination-ui.css';

export default function AssignedApplicantsModal({ exam, dateLabel, applicants, active, applicantsLoadError, attendanceSaveError, attendanceSavingId, attendanceDownloading, onDownload, onToggleActivation, onAttendanceChange, onClose }) {
  const dialog = useRef(null);
  const [query, setQuery] = useState('');
  const [attendance, setAttendance] = useState('all');
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; element.showModal();
    element.querySelector('button')?.focus();
    return () => { element.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  const present = applicants.filter(row => row.attendanceStatus === 'Present').length;
  const visible = filterExamRoster(applicants, query, attendance);
  return <dialog ref={dialog} className="exam-applicant-modal exam-roster-modal" aria-labelledby="exam-applicant-modal-title" aria-describedby="exam-roster-description" aria-modal="true" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const bounds = dialog.current.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
  }}>
    <header className="exam-modal-header"><div><span>ASSIGNED APPLICANTS</span><h3 id="exam-applicant-modal-title">{exam.municipality}</h3><p>{exam.venue} · {dateLabel}</p></div><button type="button" className="exam-modal-close" onClick={onClose} aria-label="Close applicant list"><X size={19} /></button></header>
    <section className="exam-roster-toolbar" aria-label="Examination controls"><div className="exam-roster-activation"><strong>Exam activation</strong><span className={`exam-roster-state ${active ? 'active' : ''}`}>{active ? 'Active' : 'Inactive'}</span><p>{active ? 'Schedule active. Online questions still require Present attendance.' : 'Applicants cannot access this examination yet.'}</p></div><div className="exam-roster-actions">
      <button type="button" className="exam-attendance-button" disabled={attendanceDownloading || Boolean(applicantsLoadError)} onClick={onDownload}><Download size={16} aria-hidden="true" />{attendanceDownloading ? 'Preparing Word file...' : 'Download attendance (.docx)'}</button>
      <button type="button" className={`exam-activation-button ${active ? 'active' : ''}`} onClick={onToggleActivation}>{active ? 'Deactivate exam' : 'Activate exam'}</button>
    </div></section>
    <section className="exam-roster-attendance" aria-labelledby="exam-roster-attendance-title"><div><h4 id="exam-roster-attendance-title">Examination attendance</h4><span className="exam-roster-save-state" role="status"><CheckCircle2 size={14} aria-hidden="true" />{attendanceSavingId != null ? 'Saving attendance...' : 'Changes save automatically'}</span></div><p id="exam-roster-description"><Info size={15} aria-hidden="true" /><span>Present moves an applicant to For review unless a later outcome exists. It does not record completion or a passing result. Paper is primary; online access is optional.</span></p></section>
    {attendanceSaveError && <div className="exam-roster-error"><Notification tone="error" title="Attendance needs attention">{attendanceSaveError}</Notification></div>}
    <div className="exam-roster-filters"><label className="exam-roster-search"><Search size={17} aria-hidden="true" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, email or control no." aria-label="Search assigned applicants" /></label><label className="exam-roster-filter"><span>Attendance</span><select aria-label="Filter attendance" value={attendance} onChange={event => setAttendance(event.target.value)}><option value="all">All attendance</option><option value="Pending">Pending</option><option value="Present">Present</option></select></label></div>
    <div className="exam-applicant-list" aria-label="Assigned applicant records">
      {applicantsLoadError ? <Notification tone="error" title="Unable to load assigned applicants">{applicantsLoadError}</Notification> : visible.length ? visible.map(applicant => {
        const saving = attendanceSavingId === applicant.id;
        const locked = Number.isFinite(applicant.examScore);
        return <article className="exam-applicant-row" key={applicant.id}><span className="exam-applicant-avatar" aria-hidden="true">{applicant.initials || applicant.name?.slice(0, 2).toUpperCase() || 'AP'}</span><div className="exam-roster-person"><strong>{applicant.name || 'Unnamed applicant'}</strong><small>{applicant.email || applicant.controlNo || 'No contact information'}</small><span className="exam-roster-application-status">Application/review status: {applicant.status || 'Pending'}</span>{locked && <small className="exam-roster-lock"><LockKeyhole size={12} aria-hidden="true" />Attendance locked · Result recorded</small>}</div><label className="exam-attendance-control"><span>{saving ? 'Saving...' : 'Attendance'}</span><select value={applicant.attendanceStatus === 'Present' ? 'Present' : 'Pending'} disabled={saving || locked} onChange={event => onAttendanceChange(applicant, event.target.value)} aria-label={`Attendance for ${applicant.name || 'applicant'}`}><option value="Pending">Pending</option><option value="Present">Present</option></select></label></article>;
      }) : <p className="exam-roster-empty">{applicants.length ? 'No applicants match these filters.' : 'No applicants are currently assigned to this venue.'}</p>}
    </div>
    <footer className="exam-roster-footer"><span role="status">{applicantsLoadError ? 'Applicant records unavailable' : `${visible.length} of ${applicants.length} applicants shown`}</span>{!applicantsLoadError && <span>{present} Present · {applicants.length - present} Pending</span>}</footer>
  </dialog>;
}
