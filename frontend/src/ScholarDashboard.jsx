import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  FileCheck2,
  GraduationCap,
  LogOut,
  UserRound,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { API_BASE, authHeaders } from './services/api';
import './styles/scholar-portal.css';
import './styles/portal-responsive.css';

const requirementItems = [
  { key: 'tax_exemption', label: 'Certificate of Tax Exemption' },
  { key: 'indigency', label: 'Barangay Indigency' },
  { key: 'valid_id', label: 'Photocopy of ID (any valid ID)' },
  { key: 'grades', label: 'Certificate of Grades (previous semester attended)' },
  { key: 'registration_form', label: 'Registration Form (1st semester of current school year)' },
  { key: 'tuition_receipt', label: 'Official Receipt of Tuition Fee', note: 'For scholars enrolled in a private school' },
  { key: 'white_folder', label: 'White Long Folder with Fastener', physical: true },
];

const formatPortalDate = (value, fallback = 'Not available') => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatAllowanceStatus = (allowance) => {
  if (!allowance) return 'No release scheduled';
  const status = allowance.claimedDate
    ? 'Claimed'
    : allowance.batchStatus || allowance.status || 'Pending';
  return String(status).replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const getRequirementReviewStatus = (item) => {
  if (!item?.fileName) return 'missing';
  const status = String(item.status || '').toLowerCase();
  if (['approved', 'complete', 'completed'].includes(status)) return 'approved';
  if (['rejected', 'declined'].includes(status)) return 'rejected';
  return 'pending';
};

function ScholarDashboard({ token, user, onLogout }) {
  const [application, setApplication] = useState(null);
  const [portalData, setPortalData] = useState({});
  const [loadingRequirements, setLoadingRequirements] = useState(true);
  const [requirementsError, setRequirementsError] = useState('');
  const [uploadingRequirement, setUploadingRequirement] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [refreshRequest, setRefreshRequest] = useState(0);
  const [notice, setNotice] = useState(null);
  const [latestAnnouncement, setLatestAnnouncement] = useState(null);
  const [scholarNotifications, setScholarNotifications] = useState([]);
  const displayName =
    [user?.firstName, user?.middleName, user?.lastName].filter(Boolean).join(' ') ||
    user?.email?.split('@')[0]?.replace(/[._-]/g, ' ') ||
    'Scholar';

  useEffect(() => {
    let active = true;

    const loadApplication = async (showLoading = false) => {
      if (showLoading) setLoadingRequirements(true);
      try {
        const response = await fetch(`${API_BASE}/applications/me`, {
          headers: authHeaders(token),
          cache: 'no-store',
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || 'Unable to load requirements.');
        if (active) {
          setApplication(body.application);
          setPortalData(body);
          setRequirementsError('');
        }
      } catch (error) {
        if (active) {
          const message = error instanceof TypeError
            ? 'Unable to reach the server. Reconnecting automatically…'
            : error.message || 'Unable to load scholar records.';
          setRequirementsError(message);
        }
      } finally {
        if (active && showLoading) setLoadingRequirements(false);
      }
    };

    loadApplication(true);
    const refreshPortal = () => loadApplication(false);
    const refreshInterval = window.setInterval(refreshPortal, 15000);
    window.addEventListener('focus', refreshPortal);
    window.addEventListener('online', refreshPortal);
    return () => {
      active = false;
      window.clearInterval(refreshInterval);
      window.removeEventListener('focus', refreshPortal);
      window.removeEventListener('online', refreshPortal);
    };
  }, [refreshRequest, token]);

  useEffect(() => {
    let active = true;
    const loadAnnouncement = async () => {
      try {
        const response = await fetch(`${API_BASE}/announcements/latest`, { headers: authHeaders(token), cache: 'no-store' });
        const body = response.ok ? await response.json() : null;
        if (active) {
          const announcement = body?.announcement || null;
          const expiresAt = announcement?.expiresAt ? new Date(announcement.expiresAt).getTime() : null;
          setLatestAnnouncement(Number.isFinite(expiresAt) && expiresAt <= Date.now() ? null : announcement);
        }
      } catch {
        // Keep the contextual fallback notice when the announcement service is unavailable.
      }
    };
    loadAnnouncement();
    const timer = window.setInterval(loadAnnouncement, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [token]);

  useEffect(() => {
    let active = true;
    const loadNotifications = async () => {
      try {
        const response = await fetch(`${API_BASE}/notifications/me`, { headers: authHeaders(token), cache: 'no-store' });
        const body = response.ok ? await response.json() : null;
        if (active && body) setScholarNotifications(body.notifications || []);
      } catch {
        // Allowance data remains available if the notification service is temporarily unavailable.
      }
    };
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 30000);
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
    if (!profileOpen && !notificationsOpen) return undefined;
    const closeOverlays = (event) => {
      if (event.key === 'Escape') {
        setProfileOpen(false);
        setNotificationsOpen(false);
      }
    };
    window.addEventListener('keydown', closeOverlays);
    return () => window.removeEventListener('keydown', closeOverlays);
  }, [notificationsOpen, profileOpen]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const uploadedRequirements = application?.initial_docs?.requirements || {};
  const uploadableRequirements = requirementItems.filter(({ physical }) => !physical);
  const submittedCount = uploadableRequirements.filter(
    ({ key }) => uploadedRequirements[key]?.fileName,
  ).length;
  const approvedCount = uploadableRequirements.filter(({ key }) => getRequirementReviewStatus(uploadedRequirements[key]) === 'approved').length;
  const pendingReviewCount = uploadableRequirements.filter(({ key }) => getRequirementReviewStatus(uploadedRequirements[key]) === 'pending').length;
  const rejectedCount = uploadableRequirements.filter(({ key }) => getRequirementReviewStatus(uploadedRequirements[key]) === 'rejected').length;
  const missingCount = uploadableRequirements.length - submittedCount;
  const attentionCount = missingCount + rejectedCount;
  const physicalFolderSubmitted = Boolean(portalData.scholarRequirements?.physicalFolderSubmitted);
  const onlineRequirementsComplete = approvedCount === uploadableRequirements.length;
  const requirementsComplete = onlineRequirementsComplete && physicalFolderSubmitted;
  const allowance = portalData.allowance;
  const allowanceComplete = Boolean(allowance?.claimedDate) || ['paid', 'claimed', 'released'].includes(String(allowance?.status || allowance?.batchStatus || '').toLowerCase());
  const milestoneProgress =
    (application ? 1 : 0) +
    (portalData.examination?.completed ? 1 : 0) +
    (portalData.scholar?.isActive ? 1 : 0) +
    ((approvedCount + (physicalFolderSubmitted ? 1 : 0)) / requirementItems.length) +
    (allowanceComplete ? 1 : 0);
  const progressPercent = Math.min(100, Math.round((milestoneProgress / 5) * 100));
  const allowanceStatus = formatAllowanceStatus(allowance);
  const allowanceAmount = allowance
    ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(allowance.amount)
    : 'Not scheduled';
  const summaryNotifications = [
    rejectedCount > 0
      ? `${rejectedCount} requirement${rejectedCount === 1 ? ' was' : 's were'} returned for correction.`
      : attentionCount > 0
        ? `${attentionCount} online requirement${attentionCount === 1 ? '' : 's'} still need your attention.`
        : pendingReviewCount > 0
          ? `${pendingReviewCount} uploaded document${pendingReviewCount === 1 ? ' is' : 's are'} awaiting moderator review.`
          : 'All online requirements are approved.',
    physicalFolderSubmitted
      ? 'Your physical folder has been received by CAO.'
      : 'Submit your white long folder with fastener directly to CAO.',
    allowance ? `Allowance status: ${allowanceStatus}.` : 'No allowance release has been scheduled yet.',
  ];
  const unreadScholarNotifications = scholarNotifications.filter(({ isRead }) => !isRead);
  const latestScholarNotification = scholarNotifications[0] || null;
  const hasActionNotifications = unreadScholarNotifications.length > 0 || attentionCount > 0 || pendingReviewCount > 0 || !physicalFolderSubmitted || !allowance;
  const timeline = [
    { label: 'Application submitted', date: formatPortalDate(application?.submitted_at), complete: Boolean(application) },
    { label: 'Qualifying examination', date: formatPortalDate(portalData.examination?.submittedAt), complete: Boolean(portalData.examination?.completed) },
    { label: 'Scholarship approval', date: formatPortalDate(portalData.scholar?.issuedAt), complete: Boolean(portalData.scholar?.isActive) },
    {
      label: 'Submit current requirements',
      date: requirementsComplete
        ? 'All requirements received'
        : pendingReviewCount > 0 && attentionCount === 0
          ? `${pendingReviewCount} file${pendingReviewCount === 1 ? '' : 's'} awaiting review`
          : `${attentionCount} online file${attentionCount === 1 ? '' : 's'} need attention`,
      complete: requirementsComplete,
      active: !requirementsComplete,
    },
    { label: 'Allowance release', date: allowanceStatus, complete: allowanceComplete, active: requirementsComplete && !allowanceComplete },
  ];

  const uploadRequirement = (requirement, file) => {
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      setNotice({ tone: 'error', message: 'The selected file is too large. Please choose a file smaller than 6 MB.' });
      return;
    }

    setUploadingRequirement(requirement);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const response = await fetch(`${API_BASE}/applications/me/requirements`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(token),
          },
          body: JSON.stringify({
            requirement,
            fileName: file.name,
            fileType: file.type,
            fileData: reader.result,
          }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || 'Upload failed.');
        setApplication(body.application);
        setRequirementsError('');
        setNotice({ tone: 'success', message: `${file.name} was submitted for moderator review.` });
      } catch (error) {
        setNotice({ tone: 'error', message: error.message || 'Unable to upload this requirement.' });
      } finally {
        setUploadingRequirement('');
      }
    };
    reader.onerror = () => {
      setUploadingRequirement('');
      setNotice({ tone: 'error', message: 'The selected file could not be read. Please choose another file.' });
    };
    reader.readAsDataURL(file);
  };

  const markNotificationRead = async (notificationId) => {
    try {
      const response = await fetch(`${API_BASE}/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: authHeaders(token),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to update notification.');
      setScholarNotifications((current) => current.map((item) => item.id === notificationId ? body.notification : item));
    } catch (error) {
      setNotice({ tone: 'error', message: error.message || 'Unable to update the notification.' });
    }
  };

  return (
    <div className="scholar-dashboard">
      {notice && (
        <div className={`app-toast ${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'} aria-live="polite">
          <span className="app-toast-icon">{notice.tone === 'success' ? <CheckCircle2 size={19} /> : <X size={18} />}</span>
          <div><strong>{notice.tone === 'success' ? 'Submitted for review' : 'Unable to upload'}</strong><p>{notice.message}</p></div>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss notification"><X size={15} /></button>
        </div>
      )}
      <header className="scholar-header">
        <div className="scholar-brand">
          <div className="scholar-brand-mark"><GraduationCap size={22} /></div>
          <div><span>PGCEAP</span><strong>Scholar Portal</strong></div>
        </div>
        <div className="scholar-header-actions">
          <div className="scholar-notification-menu">
            <button
              type="button"
              className="scholar-icon-button"
              aria-label="Notifications"
              aria-expanded={notificationsOpen}
              onClick={() => setNotificationsOpen((open) => !open)}
            >
              <Bell size={19} />{hasActionNotifications && <i />}
            </button>
            {notificationsOpen && (
              <div className="scholar-notification-dropdown">
                <div><strong>Notifications</strong><button type="button" onClick={() => setNotificationsOpen(false)} aria-label="Close notifications"><X size={15} /></button></div>
                {scholarNotifications.map((notification) => <article className={notification.isRead ? 'read' : 'unread'} key={notification.id}><strong>{notification.title}</strong><p>{notification.message}</p>{notification.reference && <small>Reference: {notification.reference}</small>}{!notification.isRead && <button type="button" onClick={() => markNotificationRead(notification.id)}>Mark as read</button>}</article>)}
                {summaryNotifications.map((notification) => <p key={notification}>{notification}</p>)}
              </div>
            )}
          </div>
          <div className="scholar-user-chip"><span>{displayName.charAt(0).toUpperCase()}</span><div><strong>{displayName}</strong><small>Scholar</small></div></div>
          <button type="button" className="scholar-logout" onClick={onLogout}><LogOut size={16} /> Log out</button>
        </div>
      </header>

      <main className="scholar-dashboard-main">
        {profileOpen && (
          <div className="scholar-profile-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setProfileOpen(false); }}>
            <section className="scholar-profile-dialog" role="dialog" aria-modal="true" aria-labelledby="scholar-profile-title">
              <div className="scholar-panel-heading">
                <div><p className="scholar-eyebrow">SCHOLAR PROFILE</p><h2 id="scholar-profile-title">Scholar information</h2></div>
                <button type="button" className="scholar-dialog-close" onClick={() => setProfileOpen(false)} aria-label="Close profile"><X size={18} /></button>
              </div>
              <div className="scholar-profile-grid scholar-profile-sectioned">
                <h3>Account information</h3>
                <div><span>Scholar ID</span><strong>{portalData.scholar?.scholarId || 'Not assigned'}</strong></div>
                <div><span>Control number</span><strong>{user?.controlNumber || 'Not assigned'}</strong></div>
                <div><span>Email address</span><strong>{portalData.applicant?.email || user?.email || 'Not provided'}</strong></div>
                <div><span>Scholarship status</span><strong>{portalData.scholar?.isActive ? 'Active Scholar' : 'Inactive'}</strong></div>
                <div><span>Approval date</span><strong>{formatPortalDate(portalData.scholar?.issuedAt)}</strong></div>

                <h3>Personal information</h3>
                <div><span>Full name</span><strong>{displayName}</strong></div>
                <div><span>Phone number</span><strong>{portalData.applicant?.phone || application?.identity?.mobile || 'Not provided'}</strong></div>
                <div><span>Birthday</span><strong>{formatPortalDate(portalData.applicant?.date_of_birth || application?.identity?.birthday)}</strong></div>
                <div><span>Sex</span><strong>{portalData.applicant?.gender || application?.identity?.sex || 'Not provided'}</strong></div>

                <h3>Education</h3>
                <div><span>School</span><strong>{application?.school_plan?.school || 'Not specified'}</strong></div>
                <div><span>Course</span><strong>{application?.school_plan?.course || 'Not specified'}</strong></div>
                <div><span>Year level</span><strong>{application?.school_plan?.incomingYearLevel || 'Not specified'}</strong></div>
                <div><span>School year</span><strong>{portalData.activePeriod?.schoolYear || portalData.applicant?.school_year || portalData.examination?.academicYear || '2026-2027'}</strong></div>

                <h3>Address</h3>
                <div><span>House / street</span><strong>{application?.address?.houseNumber || portalData.applicant?.street || 'Not specified'}</strong></div>
                <div><span>Municipality</span><strong>{application?.address?.municipality || portalData.applicant?.municipality || 'Not specified'}</strong></div>
                <div><span>Barangay</span><strong>{application?.address?.barangay || portalData.applicant?.barangay || 'Not specified'}</strong></div>
              </div>
            </section>
          </div>
        )}
        <section className="scholar-welcome-card">
          <div><p className="scholar-eyebrow">SCHOLAR ACCOUNT</p><h1>Good morning, {displayName}!</h1><p>Here’s a quick look at your scholarship progress and next steps.</p></div>
          <div className="scholar-welcome-icon"><GraduationCap size={42} /></div>
        </section>

        <section className="scholar-stat-grid">
          <article className="scholar-stat-card"><div className="scholar-stat-icon green"><CheckCircle2 size={21} /></div><div><span>Scholarship status</span><strong>{portalData.scholar?.isActive ? 'Active Scholar' : 'Scholar record unavailable'}</strong><small>{portalData.scholar?.issuedAt ? `Approved ${formatPortalDate(portalData.scholar.issuedAt)}` : 'Approval date unavailable'}</small></div></article>
          <article className="scholar-stat-card"><div className="scholar-stat-icon gold"><CircleDollarSign size={21} /></div><div><span>Allowance</span><strong>{allowanceAmount}</strong><small>{allowanceStatus}</small></div></article>
          <article className="scholar-stat-card">
            <div className="scholar-stat-icon blue"><FileCheck2 size={21} /></div>
            <div>
              <span>Requirements</span>
              <strong>{approvedCount} of {uploadableRequirements.length} files approved</strong>
              <small>{requirementsComplete ? 'All requirements cleared' : onlineRequirementsComplete ? 'Submit the physical folder to CAO' : rejectedCount > 0 ? `${rejectedCount} returned for correction` : pendingReviewCount > 0 ? `${pendingReviewCount} awaiting moderator review` : `${missingCount} still need to be uploaded`}</small>
            </div>
          </article>
        </section>

        <div className="scholar-portal-columns">
          <div className="scholar-portal-column">
            <section className="scholar-panel scholar-progress-panel">
            <div className="scholar-panel-heading"><div><p className="scholar-eyebrow">YOUR JOURNEY</p><h2>Scholarship progress</h2></div><span className="scholar-progress-percent">{progressPercent}%</span></div>
            <div className="scholar-progress-track"><span style={{ width: `${progressPercent}%` }} /></div>
            <div className="scholar-timeline">
              {timeline.map((item) => <div className={`scholar-timeline-item ${item.active ? 'active' : ''}`} key={item.label}><span className="scholar-timeline-dot">{item.complete ? <CheckCircle2 size={15} /> : item.active ? <span /> : null}</span><div><strong>{item.label}</strong><small>{item.date}</small></div></div>)}
            </div>
            </section>
            <article className={`scholar-panel scholar-announcement-panel ${latestScholarNotification ? 'personal-notice' : ''}`}><div className="scholar-panel-heading"><div><p className="scholar-eyebrow">{latestScholarNotification ? 'PERSONAL PAYROLL UPDATE' : 'FROM CAO'}</p><h2>{latestScholarNotification ? 'Your latest update' : 'Latest announcement'}</h2></div><Bell size={20} className="scholar-heading-icon" /></div><h3>{latestScholarNotification?.title || latestAnnouncement?.title || (requirementsComplete ? 'Requirements submitted' : 'Complete your scholar requirements')}</h3><p>{latestScholarNotification?.message || latestAnnouncement?.content || (requirementsComplete ? 'Your required documents and physical folder are recorded. Watch this portal for allowance updates.' : 'Submit the remaining requirements so your scholar record can proceed to allowance processing.')}</p>{latestScholarNotification && <div className="scholar-payroll-notice-details"><span><small>Payment reference</small><strong>{latestScholarNotification.reference || 'Not assigned'}</strong></span><span><small>Amount</small><strong>{new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(latestScholarNotification.amount || 0)}</strong></span><span><small>Processed</small><strong>{formatPortalDate(latestScholarNotification.createdAt)}</strong></span></div>}{latestScholarNotification && !latestScholarNotification.isRead && <button type="button" className="scholar-text-button" onClick={() => markNotificationRead(latestScholarNotification.id)}>Mark as read <ChevronRight size={15} /></button>}{!latestScholarNotification && latestAnnouncement?.imageData && <img className="portal-announcement-image" src={latestAnnouncement.imageData} alt={latestAnnouncement.imageName || latestAnnouncement.title} />}{!latestScholarNotification && <a href="#requirements">View requirements <ChevronRight size={15} /></a>}</article>
          </div>

          <div className="scholar-portal-column">
            <section className="scholar-panel scholar-action-panel" id="requirements">
            <div className="scholar-panel-heading"><div><p className="scholar-eyebrow">{requirementsComplete ? 'REQUIREMENTS COMPLETE' : rejectedCount > 0 ? 'CORRECTION REQUIRED' : 'ACTION NEEDED'}</p><h2>{requirementsComplete ? 'Requirements approved' : rejectedCount > 0 ? 'Review returned documents' : 'Complete your requirements'}</h2></div><FileCheck2 size={21} className="scholar-heading-icon" /></div>
            <p className="scholar-panel-copy">{requirementsComplete ? 'All online files and the physical folder have been approved and recorded.' : 'Uploaded files are checked by a Moderator before they count as completed requirements.'}</p>
            {requirementsError && <div className="scholar-requirements-error"><span>{requirementsError}</span><button type="button" onClick={() => setRefreshRequest((request) => request + 1)}>Retry now</button></div>}
            <div className="scholar-requirements-list" aria-busy={loadingRequirements}>
              {requirementItems.map(({ key, label, note, physical }) => {
                const item = uploadedRequirements[key];
                const isUploading = uploadingRequirement === key;
                const reviewStatus = physical ? null : getRequirementReviewStatus(item);
                return (
                  <div className="scholar-requirement-row" key={key}>
                    <span className="scholar-requirement-copy">
                      <strong>{label}</strong>
                      <small>
                        {physical
                          ? physicalFolderSubmitted
                            ? `Received by CAO${portalData.scholarRequirements?.physicalFolderSubmittedAt ? ` on ${formatPortalDate(portalData.scholarRequirements.physicalFolderSubmittedAt)}` : ''}`
                            : 'Physical requirement — submit directly to the Community Affairs Office'
                          : loadingRequirements
                            ? 'Checking submission…'
                            : reviewStatus === 'approved'
                              ? `${item.fileName} · Approved${item.reviewedAt ? ` ${formatPortalDate(item.reviewedAt)}` : ''}`
                              : reviewStatus === 'rejected'
                                ? `Returned: ${item.reviewNotes || 'Please upload a clearer or corrected document.'}`
                                : reviewStatus === 'pending'
                                  ? `${item.fileName} · Pending moderator review`
                                  : note || 'No file uploaded'}
                      </small>
                    </span>
                    {physical ? (
                      <span className={`scholar-physical-badge ${physicalFolderSubmitted ? 'received' : ''}`}>{physicalFolderSubmitted ? 'Received' : 'Submit to CAO'}</span>
                    ) : (
                      <span className="scholar-requirement-actions">
                        {reviewStatus !== 'missing' && <span className={`scholar-review-badge ${reviewStatus}`}>{reviewStatus === 'approved' ? 'Approved' : reviewStatus === 'rejected' ? 'Rejected' : 'Pending'}</span>}
                        {reviewStatus !== 'approved' && <label className={`scholar-upload-button ${item?.fileName ? 'submitted' : ''}`}>
                          {isUploading ? 'Uploading…' : reviewStatus === 'rejected' ? 'Upload again' : item?.fileName ? 'Replace' : 'Upload'}
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(event) => uploadRequirement(key, event.target.files?.[0])}
                            disabled={loadingRequirements || Boolean(uploadingRequirement)}
                          />
                        </label>}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            </section>
            <article className="scholar-panel scholar-profile-panel"><div className="scholar-panel-heading"><div><p className="scholar-eyebrow">ACCOUNT DETAILS</p><h2>My profile</h2></div><UserRound size={20} className="scholar-heading-icon" /></div><div className="scholar-profile-detail"><span>Scholar ID</span><strong>{portalData.scholar?.scholarId || 'Not assigned'}</strong></div><div className="scholar-profile-detail"><span>Control number</span><strong>{user?.controlNumber || 'Not assigned'}</strong></div><div className="scholar-profile-detail"><span>Email address</span><strong>{user?.email || 'Not provided'}</strong></div><button type="button" className="scholar-text-button" onClick={() => setProfileOpen(true)}>View profile <ChevronRight size={15} /></button></article>
          </div>
        </div>
        <footer className="scholar-footer"><CalendarDays size={14} /> Need help? Contact the Community Affairs Office for assistance.</footer>
      </main>
    </div>
  );
}

export default ScholarDashboard;
