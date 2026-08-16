import {
  Bell,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  FileText,
  LogOut,
  MessageCircleQuestion,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { API_BASE, authHeaders } from "./services/api";
import './styles/applicant-prelude.css';
import './styles/scholar-portal.css';
import './styles/applicant-portal.css';
import './styles/portal-responsive.css';

const formatApplicantExamRange = (startValue, endValue) => {
  if (!startValue) return "Schedule not set";
  if (!endValue || endValue === startValue) return startValue;
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return `${startValue} – ${endValue}`;
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return `${start.toLocaleDateString("en-US", { month: "long" })} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`;
  }
  return `${startValue} – ${endValue}`;
};

const formatApplicantDate = (value) => {
  if (!value) return "Not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const eligibilityLabels = {
  graduatedHonors: "Graduated with honors",
  championContest: "Contest champion",
  alsPasser: "ALS passer",
  pwd: "Person with disability",
  childOfPwd: "Child of a person with disability",
  soloParent: "Solo parent / child of a solo parent",
  indigenousGroup: "Member of an indigenous group",
  siblingRuleAccepted: "No-sibling scholarship rule acknowledged",
};

function ApplicantDashboard({ token, user, onLogout, onUserUpdate }) {
  const [profile, setProfile] = useState(user);
  const [application, setApplication] = useState(null);
  const [examination, setExamination] = useState(null);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [examActivated, setExamActivated] = useState(false);
  const [examMode, setExamMode] = useState(() => localStorage.getItem('examDeliveryMode') || 'online');
  const [examDetails, setExamDetails] = useState(null);
  const [latestAnnouncement, setLatestAnnouncement] = useState(null);
  useEffect(() => {
    const syncExamStatus = () => { try { const activeMunicipalities = JSON.parse(localStorage.getItem('activeExamMunicipalities') || '[]'); const applicantMunicipality = application?.address?.municipality; setExamActivated(applicantMunicipality ? activeMunicipalities.includes(applicantMunicipality) : false); } catch { setExamActivated(false); } };
    window.addEventListener('storage', syncExamStatus);
    window.addEventListener('exam-activation-changed', syncExamStatus);
    const syncExamMode = () => setExamMode(localStorage.getItem('examDeliveryMode') || 'online');
    const syncExamDetails = () => {
      try {
        const active = JSON.parse(localStorage.getItem('activeExamDetails') || 'null');
        const exams = JSON.parse(localStorage.getItem('examVenueData') || '[]');
        const activeMunicipalities = JSON.parse(localStorage.getItem('activeExamMunicipalities') || '[]');
        const applicantMunicipality = application?.address?.municipality;
        if (!applicantMunicipality || !activeMunicipalities.includes(applicantMunicipality)) {
          setExamDetails(null);
          return;
        }
        const assigned = exams.find((exam) => exam.municipality === applicantMunicipality)
          || (active?.municipality === applicantMunicipality ? active : null);
        setExamDetails(assigned ? { municipality: assigned.municipality, venue: assigned.venue, date: assigned.date, endDate: assigned.endDate || assigned.date } : null);
      } catch { setExamDetails(null); }
    };
    syncExamStatus();
    syncExamMode();
    syncExamDetails();
    window.addEventListener('storage', syncExamMode);
    window.addEventListener('exam-mode-changed', syncExamMode);
    window.addEventListener('storage', syncExamDetails);
    window.addEventListener('exam-activation-changed', syncExamDetails);
    window.addEventListener('exam-schedule-changed', syncExamDetails);
    return () => { window.removeEventListener('storage', syncExamStatus); window.removeEventListener('exam-activation-changed', syncExamStatus); window.removeEventListener('storage', syncExamMode); window.removeEventListener('exam-mode-changed', syncExamMode); window.removeEventListener('storage', syncExamDetails); window.removeEventListener('exam-activation-changed', syncExamDetails); window.removeEventListener('exam-schedule-changed', syncExamDetails); };
  }, [application, profile]);
  useEffect(() => {
    let active = true;
    fetch(`${API_BASE}/auth/me`, { headers: authHeaders(token) })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (active && body?.user) {
          setProfile(body.user);
          if (body.user.role !== user?.role) onUserUpdate?.(body.user);
        }
      })
      .catch(() => {});
    fetch(`${API_BASE}/applications/me`, { headers: authHeaders(token) })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (active && body?.application) {
          setApplication(body.application);
          setExamination(body.examination || null);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [token, onUserUpdate, user?.role]);

  useEffect(() => {
    let active = true;
    const loadAnnouncement = () => fetch(`${API_BASE}/announcements/latest`, { headers: authHeaders(token), cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!active) return;
        const announcement = body?.announcement || null;
        const expiresAt = announcement?.expiresAt ? new Date(announcement.expiresAt).getTime() : null;
        setLatestAnnouncement(Number.isFinite(expiresAt) && expiresAt <= Date.now() ? null : announcement);
      })
      .catch(() => {});
    loadAnnouncement();
    const timer = window.setInterval(loadAnnouncement, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [token]);

  useEffect(() => {
    const expirationTime = latestAnnouncement?.expiresAt
      ? new Date(latestAnnouncement.expiresAt).getTime()
      : Number.NaN;
    if (!Number.isFinite(expirationTime)) return undefined;

    let expirationTimer;
    const scheduleExpiration = () => {
      const remaining = expirationTime - Date.now();
      expirationTimer = window.setTimeout(() => {
        if (expirationTime <= Date.now()) {
          setLatestAnnouncement((current) => current?.id === latestAnnouncement.id ? null : current);
          return;
        }
        scheduleExpiration();
      }, Math.max(0, Math.min(remaining, 2_147_483_647)));
    };
    scheduleExpiration();
    return () => window.clearTimeout(expirationTimer);
  }, [latestAnnouncement]);

  useEffect(() => {
    if (!profileOpen) return undefined;
    const closeProfile = (event) => {
      if (event.key === "Escape") setProfileOpen(false);
    };
    window.addEventListener("keydown", closeProfile);
    return () => window.removeEventListener("keydown", closeProfile);
  }, [profileOpen]);

  const displayName =
    [profile?.firstName, profile?.middleName, profile?.lastName]
      .filter(Boolean)
      .join(" ") || "Applicant";
  const firstName = profile?.firstName || displayName.split(" ")[0];
  const controlNumber = profile?.controlNumber || "PGCEAP-APP-021";
  const examCompleted = Boolean(examination?.completed);
  const waitingForResults = examCompleted && !examination?.isScholar;
  const applicationStatus = waitingForResults
    ? "Waiting for results"
    : examination?.isScholar
      ? "Accepted as scholar"
      : application?.status || "Not submitted";
  const eligibilitySummary = Object.entries(application?.eligibility || {})
    .filter(([, value]) => value === "Yes" || value === true)
    .map(([key]) => eligibilityLabels[key] || key)
    .join(", ") || "None declared";

  return (
    <div className="applicant-dashboard">
      <header className="scholar-header applicant-header">
        <div className="scholar-brand">
          <div className="scholar-brand-mark applicant-brand-mark">
            <ClipboardList size={21} />
          </div>
          <div>
            <span>PGCEAP</span>
            <strong>Applicant Portal</strong>
          </div>
        </div>
        <div className="scholar-header-actions">
          <div className="applicant-notification-menu">
            <button
              type="button"
              className="scholar-icon-button"
              aria-label="Notifications"
              onClick={() => setNotificationOpen((open) => !open)}
            >
              <Bell size={19} />
              <i />
            </button>
            {notificationOpen && (
              <div className="applicant-notification-dropdown">
                {waitingForResults ? (
                  <>
                    <strong>Examination completed</strong>
                    <span>Your answers were submitted. Please wait for the Scholarship Office to release your result.</span>
                  </>
                ) : application ? (
                  <>
                    <strong>Application submitted</strong>
                    <span>Your application is complete and under review.</span>
                  </>
                ) : (
                  <span>No new notifications.</span>
                )}
              </div>
            )}
          </div>
          <div className="scholar-user-chip">
            <span>{firstName.charAt(0).toUpperCase()}</span>
            <div>
              <strong>{firstName}</strong>
              <small>Applicant</small>
            </div>
          </div>
          <button type="button" className="scholar-logout" onClick={onLogout}>
            <LogOut size={16} /> Log out
          </button>
        </div>
      </header>

      <main className="applicant-dashboard-main">
        {profileOpen && (
          <div className="scholar-profile-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setProfileOpen(false); }}>
            <section className="scholar-profile-dialog applicant-profile-dialog" role="dialog" aria-modal="true" aria-labelledby="applicant-profile-title">
              <div className="scholar-panel-heading">
                <div><p className="applicant-eyebrow">APPLICANT PROFILE</p><h2 id="applicant-profile-title">Application information</h2></div>
                <button type="button" className="scholar-dialog-close" onClick={() => setProfileOpen(false)} aria-label="Close profile"><X size={18} /></button>
              </div>
              <div className="scholar-profile-grid applicant-profile-grid">
                <h3>Account information</h3>
                <div><span>Email address</span><strong>{profile?.email || "Not provided"}</strong></div>
                <div><span>Control number</span><strong>{controlNumber}</strong></div>
                <div><span>Account status</span><strong className="applicant-status">Active</strong></div>
                <div><span>Application status</span><strong>{applicationStatus}</strong></div>
                {application && (
                  <>
                    <h3>Personal information</h3>
                    <div><span>Full name</span><strong>{displayName}</strong></div>
                    <div><span>Mobile number</span><strong>{application.identity?.mobile || "Not provided"}</strong></div>
                    <div><span>Birthday</span><strong>{formatApplicantDate(application.identity?.birthday)}</strong></div>
                    <div><span>Sex</span><strong>{application.identity?.sex || "Not provided"}</strong></div>
                    <div><span>Birthplace</span><strong>{application.identity?.birthplace || "Not provided"}</strong></div>
                    <div><span>Civil status</span><strong>{application.identity?.civilStatus || "Not provided"}</strong></div>

                    <h3>Address</h3>
                    <div><span>House / street</span><strong>{application.address?.houseNumber || "Not specified"}</strong></div>
                    <div><span>Barangay</span><strong>{application.address?.barangay || "Not specified"}</strong></div>
                    <div><span>Municipality</span><strong>{application.address?.municipality || "Not specified"}</strong></div>

                    <h3>Education</h3>
                    <div><span>School</span><strong>{application.school_plan?.school || "Not specified"}</strong></div>
                    <div><span>Course</span><strong>{application.school_plan?.course || "Not specified"}</strong></div>
                    <div><span>Year level</span><strong>{application.school_plan?.incomingYearLevel || "Not specified"}</strong></div>
                    <div><span>GWA</span><strong>{application.family?.gwa || "Not specified"}</strong></div>

                    <h3>Family information</h3>
                    <div><span>Father</span><strong>{[application.family?.fatherName, application.family?.fatherOccupation].filter(Boolean).join(" · ") || "Not provided"}</strong></div>
                    <div><span>Mother</span><strong>{[application.family?.motherName, application.family?.motherOccupation].filter(Boolean).join(" · ") || "Not provided"}</strong></div>
                    <div><span>Guardian</span><strong>{[application.family?.guardianName, application.family?.guardianOccupation].filter(Boolean).join(" · ") || "Not provided"}</strong></div>
                    <div><span>Family income</span><strong>{application.family?.familyIncome || "Not specified"}</strong></div>
                    <div><span>Brothers</span><strong>{application.family?.brothersCount ?? "Not specified"}</strong></div>
                    <div><span>Sisters</span><strong>{application.family?.sistersCount ?? "Not specified"}</strong></div>

                    <h3>Eligibility</h3>
                    <div className="applicant-profile-wide"><span>Declared qualifications</span><strong>{eligibilitySummary}</strong></div>
                  </>
                )}
              </div>
            </section>
          </div>
        )}
        {application && (
          <div className="applicant-notification">
            <Bell size={17} />
            <span>
              <strong>Application submitted</strong> Your application is
              complete and currently under review.
            </span>
          </div>
        )}
        {application && (
          <section className="applicant-completion-banner applicant-completion-panel">
            <p>YOUR APPLICATION</p>
            <h2>{waitingForResults ? "Examination completed" : "Application completed"}</h2>
            <strong>100% complete</strong>
            <span>
              {waitingForResults
                ? "Your examination was submitted successfully. Please wait for the official result."
                : "Your application was submitted and is currently under review."}
            </span>
          </section>
        )}
        <section className="applicant-welcome-card">
          <div>
            <p className="applicant-eyebrow">APPLICANT ACCOUNT</p>
            <h1>Welcome, {displayName}!</h1>
            <p>
              Complete your application and stay updated on your PGCEAP
              scholarship journey.
            </p>
          </div>
          <div className="applicant-welcome-icon">
            <ClipboardList size={40} />
          </div>
        </section>

        <section className="applicant-stat-grid">
          <article className="applicant-stat-card">
            <div className="applicant-stat-icon green">
              <FileText size={21} />
            </div>
            <div>
              <span>Application status</span>
              <strong>{applicationStatus}</strong>
              <small>
                {waitingForResults
                  ? "Examination completed"
                  : application
                  ? "Application received"
                  : "Complete your application"}
              </small>
            </div>
          </article>
          <article className="applicant-stat-card">
            <div className="applicant-stat-icon gold">
              <CalendarDays size={21} />
            </div>
            <div>
              <span>Submitted date</span>
              <strong>
                {application
                  ? new Date(application.submitted_at).toLocaleDateString()
                  : "—"}
              </strong>
              <small>Latest application record</small>
            </div>
          </article>
        </section>

        <div className="applicant-content-grid">
          <section className="applicant-panel applicant-continue-panel">
            <div className="applicant-panel-heading">
              <div>
                <p className="applicant-eyebrow">YOUR APPLICATION</p>
                <h2>Continue your application</h2>
              </div>
              <span className="applicant-progress-badge">40% complete</span>
            </div>
            <p className="applicant-panel-copy">
              You’ve completed your personal information. Continue with your
              academic and family details to submit your application.
            </p>
            <div className="applicant-progress-track">
              <span />
            </div>
            <div className="applicant-step-list">
              <div className="applicant-step done">
                <span>✓</span>
                <div>
                  <strong>Personal information</strong>
                  <small>Completed</small>
                </div>
              </div>
              <div className="applicant-step active">
                <span>2</span>
                <div>
                  <strong>Academic information</strong>
                  <small>Next step</small>
                </div>
              </div>
              <div className="applicant-step">
                <span>3</span>
                <div>
                  <strong>Family and financial information</strong>
                  <small>Not started</small>
                </div>
              </div>
              <div className="applicant-step">
                <span>4</span>
                <div>
                  <strong>Review and submit</strong>
                  <small>Not started</small>
                </div>
              </div>
            </div>
            <button type="button" className="applicant-primary-button">
              Continue application <ChevronRight size={17} />
            </button>
          </section>
          <section className="applicant-panel applicant-info-panel">
            <div className="applicant-panel-heading">
              <div>
                <p className="applicant-eyebrow">ACCOUNT INFORMATION</p>
                <h2>Your details</h2>
              </div>
              <UserRound size={20} className="applicant-heading-icon" />
            </div>
            <div className="applicant-detail">
              <span>Control number</span>
              <strong>{controlNumber}</strong>
            </div>
            <div className="applicant-detail">
              <span>Email address</span>
              <strong>{user?.email || "applicant@example.com"}</strong>
            </div>
            <div className="applicant-detail">
              <span>Account status</span>
              <strong className="applicant-status">Active</strong>
            </div>
            <button type="button" className="applicant-text-button" onClick={() => setProfileOpen(true)}>
              View profile <ChevronRight size={15} />
            </button>
          </section>
        </div>

        <section className="applicant-bottom-grid">
          <article className="applicant-panel applicant-guidance-panel">
            <div className="applicant-panel-heading">
              <div>
                <p className="applicant-eyebrow">APPLICATION GUIDANCE</p>
                <h2>What happens next?</h2>
              </div>
              <MessageCircleQuestion
                size={20}
                className="applicant-heading-icon"
              />
            </div>
            <p className="applicant-panel-copy">
              {waitingForResults
                ? "Your qualifying examination has been recorded. The Scholarship Office will review and release the official result before scholar acceptance."
                : "After submitting your application, the admin will review your information and notify you about the qualifying examination schedule."}
            </p>
            {!examCompleted && examActivated && examMode === 'face-to-face' && examDetails && (
              <div className="applicant-exam-details">
                <div><span>Schedule</span><strong>{formatApplicantExamRange(examDetails.date, examDetails.endDate)}</strong></div>
                <div><span>Venue</span><strong>{examDetails.venue}</strong></div>
              </div>
            )}
            {waitingForResults
              ? <span className="applicant-exam-pending waiting">Examination completed · Waiting for results</span>
              : examActivated && examMode === 'online'
                ? <a className="applicant-primary-button" href="/examination">Take examination <ChevronRight size={15} /></a>
                : <span className="applicant-exam-pending">{examActivated ? 'Face-to-face examination' : 'Waiting for examination schedule'}</span>}
          </article>
          <article className="applicant-panel applicant-notice-panel">
            <div className="applicant-panel-heading">
              <div>
                <p className="applicant-eyebrow">ANNOUNCEMENT</p>
                <h2>Latest from CAO</h2>
              </div>
              <FileText size={20} className="applicant-heading-icon" />
            </div>
            {latestAnnouncement ? (
              <div className="applicant-announcement-content">
                <div className="applicant-announcement-meta">
                  <span className={`applicant-announcement-priority ${latestAnnouncement.priority || 'normal'}`}>
                    {latestAnnouncement.priority || 'normal'} priority
                  </span>
                  <time>{formatApplicantDate(latestAnnouncement.publishAt || latestAnnouncement.publishedAt)}</time>
                </div>
                <h3>{latestAnnouncement.title}</h3>
                <p>{latestAnnouncement.content}</p>
                {latestAnnouncement.imageData && (
                  <img
                    className="portal-announcement-image"
                    src={latestAnnouncement.imageData}
                    alt={latestAnnouncement.imageName || latestAnnouncement.title}
                  />
                )}
              </div>
            ) : (
              <div className="applicant-announcement-empty">
                <FileText size={22} />
                <div>
                  <strong>No new announcements</strong>
                  <span>Official notices from CAO will appear here.</span>
                </div>
              </div>
            )}
          </article>
        </section>
        <footer className="scholar-footer">
          <CalendarDays size={14} /> Need help? Contact the Community Affairs
          Office for assistance.
        </footer>
      </main>
    </div>
  );
}

export default ApplicantDashboard;
