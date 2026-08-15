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
  const pendingCount = uploadableRequirements.length - submittedCount;
  const physicalFolderSubmitted = Boolean(portalData.scholarRequirements?.physicalFolderSubmitted);
  const onlineRequirementsComplete = pendingCount === 0;
  const requirementsComplete = onlineRequirementsComplete && physicalFolderSubmitted;
  const allowance = portalData.allowance;
  const allowanceComplete = Boolean(allowance?.claimedDate) || ['paid', 'claimed', 'released'].includes(String(allowance?.status || allowance?.batchStatus || '').toLowerCase());
  const milestoneProgress =
    (application ? 1 : 0) +
    (portalData.examination?.completed ? 1 : 0) +
    (portalData.scholar?.isActive ? 1 : 0) +
    ((submittedCount + (physicalFolderSubmitted ? 1 : 0)) / requirementItems.length) +
    (allowanceComplete ? 1 : 0);
  const progressPercent = Math.min(100, Math.round((milestoneProgress / 5) * 100));
  const allowanceStatus = formatAllowanceStatus(allowance);
  const allowanceAmount = allowance
    ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(allowance.amount)
    : 'Not scheduled';
  const notifications = [
    pendingCount > 0
      ? `${pendingCount} online requirement${pendingCount === 1 ? '' : 's'} still need to be uploaded.`
      : 'All online requirements have been uploaded.',
    physicalFolderSubmitted
      ? 'Your physical folder has been received by CAO.'
      : 'Submit your white long folder with fastener directly to CAO.',
    allowance ? `Allowance status: ${allowanceStatus}.` : 'No allowance release has been scheduled yet.',
  ];
  const hasActionNotifications = pendingCount > 0 || !physicalFolderSubmitted || !allowance;
  const timeline = [
    { label: 'Application submitted', date: formatPortalDate(application?.submitted_at), complete: Boolean(application) },
    { label: 'Qualifying examination', date: formatPortalDate(portalData.examination?.submittedAt), complete: Boolean(portalData.examination?.completed) },
    { label: 'Scholarship approval', date: formatPortalDate(portalData.scholar?.issuedAt), complete: Boolean(portalData.scholar?.isActive) },
    {
      label: 'Submit current requirements',
      date: requirementsComplete
        ? 'All requirements received'
        : onlineRequirementsComplete
          ? 'Online files complete — submit folder to CAO'
          : `${pendingCount} online file${pendingCount === 1 ? '' : 's'} remaining`,
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
        setNotice({ tone: 'success', message: `${file.name} was uploaded successfully.` });
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

  return (
    <div className="scholar-dashboard">
      {notice && (
        <div className={`app-toast ${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'} aria-live="polite">
          <span className="app-toast-icon">{notice.tone === 'success' ? <CheckCircle2 size={19} /> : <X size={18} />}</span>
          <div><strong>{notice.tone === 'success' ? 'Upload complete' : 'Unable to upload'}</strong><p>{notice.message}</p></div>
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
                {notifications.map((notification) => <p key={notification}>{notification}</p>)}
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
              <strong>{submittedCount} of {uploadableRequirements.length} files uploaded</strong>
              <small>{requirementsComplete ? 'Submit the physical folder to CAO' : `${pendingCount} online document${pendingCount === 1 ? '' : 's'} need your attention`}</small>
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
            <article className="scholar-panel scholar-announcement-panel"><div className="scholar-panel-heading"><div><p className="scholar-eyebrow">FROM CAO</p><h2>Latest announcement</h2></div><Bell size={20} className="scholar-heading-icon" /></div><h3>{latestAnnouncement?.title || (requirementsComplete ? 'Requirements submitted' : 'Complete your scholar requirements')}</h3><p>{latestAnnouncement?.content || (requirementsComplete ? 'Your required documents and physical folder are recorded. Watch this portal for allowance updates.' : 'Submit the remaining requirements so your scholar record can proceed to allowance processing.')}</p>{latestAnnouncement?.imageData && <img className="portal-announcement-image" src={latestAnnouncement.imageData} alt={latestAnnouncement.imageName || latestAnnouncement.title} />}<a href="#requirements">View requirements <ChevronRight size={15} /></a></article>
          </div>

          <div className="scholar-portal-column">
            <section className="scholar-panel scholar-action-panel" id="requirements">
            <div className="scholar-panel-heading"><div><p className="scholar-eyebrow">{requirementsComplete ? 'REQUIREMENTS COMPLETE' : 'ACTION NEEDED'}</p><h2>{requirementsComplete ? 'Requirements received' : 'Complete your requirements'}</h2></div><FileCheck2 size={21} className="scholar-heading-icon" /></div>
            <p className="scholar-panel-copy">{requirementsComplete ? 'All online files and the physical folder have been recorded.' : 'Upload the required documents to complete your scholar record and remain eligible for allowance processing.'}</p>
            {requirementsError && <div className="scholar-requirements-error"><span>{requirementsError}</span><button type="button" onClick={() => setRefreshRequest((request) => request + 1)}>Retry now</button></div>}
            <div className="scholar-requirements-list" aria-busy={loadingRequirements}>
              {requirementItems.map(({ key, label, note, physical }) => {
                const item = uploadedRequirements[key];
                const isUploading = uploadingRequirement === key;
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
                            : item?.fileName || note || 'No file uploaded'}
                      </small>
                    </span>
                    {physical ? (
                      <span className={`scholar-physical-badge ${physicalFolderSubmitted ? 'received' : ''}`}>{physicalFolderSubmitted ? 'Received' : 'Submit to CAO'}</span>
                    ) : (
                      <label className={`scholar-upload-button ${item?.fileName ? 'submitted' : ''}`}>
                        {isUploading ? 'Uploading…' : item?.fileName ? 'Replace' : 'Upload'}
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(event) => uploadRequirement(key, event.target.files?.[0])}
                          disabled={loadingRequirements || Boolean(uploadingRequirement)}
                        />
                      </label>
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
