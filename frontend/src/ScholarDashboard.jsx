import ScholarPayoutReceipts from './components/ScholarPayoutReceipts';
import ScholarGraduation from './components/ScholarGraduation';
import { validateDocumentFile, documentDataUrl, DOCUMENT_FILE_ACCEPT, DOCUMENT_FILE_HELP } from './utils/documentFilePolicy';
import ScholarDesktopNavigation from './components/ScholarDesktopNavigation';
import { containScholarProfileFocus } from './utils/scholarMobileLayout';
import ScholarMobileNavigation from './components/ScholarMobileNavigation';
import { initialRequirementItemsFor, initialRequirementProgress, isFirstYearEntry } from './utils/initialAcademicEvidence';
import DocumentViewButton from './components/DocumentViewButton';
import Notification from './components/Notification';
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileCheck2,
  GraduationCap,
  LogOut,
  UserRound,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ScholarNextStep from './components/ScholarNextStep';
import ScholarUpdates from './components/ScholarUpdates';
import ScholarRequirementsTabs from './components/ScholarRequirementsTabs';
import { buildScholarNextStep, getRequirementReviewStatus, requirementStatusLabels } from './utils/scholarPortalLayout';
import { API_BASE, authHeaders } from './services/api';
import { ROUTINE_DATA_REFRESH_MS, subscribeToVisibleRefresh, TIME_SENSITIVE_DATA_REFRESH_MS } from './utils/dataRefresh';
import './styles/scholar-portal.css';
import './styles/portal-responsive.css';
import './styles/scholar-portal-layout.css';
import './styles/scholar-mobile.css';

const requirementItems = [
  { key: 'grades', label: 'Certificate of Grades (previous semester attended)' },
  { key: 'registration_form', label: 'Registration Form (currently enrolled semester)' },
  { key: 'tuition_receipt', label: 'Official Receipt of Tuition Fee', note: 'Required only for Private-school scholars' },
];

const formatPortalDate = (value, fallback = 'Not available', timeZone) => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone,
  });
};

function ScholarDashboard({ token, user, onLogout }) {
  const [application, setApplication] = useState(null);
  const [requirementPeriodId, setRequirementPeriodId] = useState('');
  const [requirementsTab, setRequirementsTab] = useState(null);
  const [portalData, setPortalData] = useState({});
  const [loadingRequirements, setLoadingRequirements] = useState(true);
  const [requirementsError, setRequirementsError] = useState('');
  const [announcementError, setAnnouncementError] = useState('');
  const [notificationsError, setNotificationsError] = useState('');
  const [uploadingRequirement, setUploadingRequirement] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileDialog = useRef(null);
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
        const response = await fetch(`${API_BASE}/applications/me${requirementPeriodId ? `?requirementPeriodId=${requirementPeriodId}` : ''}`, {
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
    const stopRefreshing = subscribeToVisibleRefresh(refreshPortal, { intervalMs: TIME_SENSITIVE_DATA_REFRESH_MS });
    window.addEventListener('online', refreshPortal);
    return () => {
      active = false;
      stopRefreshing();
      window.removeEventListener('online', refreshPortal);
    };
  }, [refreshRequest, token, requirementPeriodId]);

  useEffect(() => {
    let active = true;
    const loadAnnouncement = async () => {
      try {
        const response = await fetch(`${API_BASE}/announcements/latest`, { headers: authHeaders(token), cache: 'no-store' });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || 'Unable to load portal updates.');
        if (active) {
          const announcement = body?.announcement || null;
          const expiresAt = announcement?.expiresAt ? new Date(announcement.expiresAt).getTime() : null;
          setLatestAnnouncement(Number.isFinite(expiresAt) && expiresAt <= Date.now() ? null : announcement);
          setAnnouncementError('');
        }
      } catch (error) {
        if (active) setAnnouncementError(error.message || 'Unable to load announcements. Refresh this page to retry.');
      }
    };
    loadAnnouncement();
    const stopRefreshing = subscribeToVisibleRefresh(loadAnnouncement, { intervalMs: ROUTINE_DATA_REFRESH_MS });
    return () => { active = false; stopRefreshing(); };
  }, [refreshRequest, token]);

  useEffect(() => {
    let active = true;
    const loadNotifications = async () => {
      try {
        const response = await fetch(`${API_BASE}/notifications/me`, { headers: authHeaders(token), cache: 'no-store' });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || 'Unable to load portal updates.');
        if (active && body) { setScholarNotifications(body.notifications || []); setNotificationsError(''); }
      } catch (error) {
        if (active) setNotificationsError(error.message || 'Unable to load notifications. Refresh this page to retry.');
      }
    };
    loadNotifications();
    const stopRefreshing = subscribeToVisibleRefresh(loadNotifications, { intervalMs: ROUTINE_DATA_REFRESH_MS });
    return () => { active = false; stopRefreshing(); };
  }, [refreshRequest, token]);

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
    if (!profileOpen) return undefined;
    const dialog = profileDialog.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog?.querySelector('button')?.focus();
    const containFocus = event => containScholarProfileFocus(event, dialog, document.activeElement);
    window.addEventListener('keydown', containFocus);
    return () => { window.removeEventListener('keydown', containFocus); document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, [profileOpen]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const continuingOpen = portalData.requirementWave?.continuingOpen === true;
  const uploadedRequirements = portalData.requirementWave?.continuing || {};
  const initialRequirements = portalData.requirementWave?.initial || application?.initial_docs?.requirements || {};
  const isPrivateScholar = portalData.school?.schoolType === 'Private';
  const isPrivateRequirementPeriod = (portalData.requirementWave?.schoolType || portalData.school?.schoolType) === 'Private';
  const visibleRequirementItems = requirementItems.filter(({ key }) => key !== 'tuition_receipt' || isPrivateRequirementPeriod);
  const uploadableRequirements = visibleRequirementItems;
  const submittedCount = uploadableRequirements.filter(
    ({ key }) => uploadedRequirements[key]?.fileName,
  ).length;
  const approvedCount = uploadableRequirements.filter(({ key }) => getRequirementReviewStatus(uploadedRequirements[key]) === 'approved').length;
  const pendingReviewCount = uploadableRequirements.filter(({ key }) => getRequirementReviewStatus(uploadedRequirements[key]) === 'pending').length;
  const rejectedCount = uploadableRequirements.filter(({ key }) => getRequirementReviewStatus(uploadedRequirements[key]) === 'rejected').length;
  const missingCount = uploadableRequirements.length - submittedCount;
  const attentionCount = continuingOpen ? missingCount + rejectedCount : 0;
  const onlineRequirementsComplete = approvedCount === uploadableRequirements.length;
  const requirementsComplete = continuingOpen && onlineRequirementsComplete;
  const continuingSubmission = portalData.requirementWave?.submission || portalData.activePeriod?.requirementsSubmission;
  const requirementsDeadline = continuingSubmission ? continuingSubmission.deadline : portalData.activePeriod?.requirementsDeadline || null;
  const requirementsSubmissionClosed = loadingRequirements || Boolean(requirementsError) || (requirementPeriodId && Number(requirementPeriodId) !== portalData.requirementWave?.academicPeriodId) || !continuingOpen || continuingSubmission?.isOpen === false;
  const payrollList = portalData.payrollList;
  const useCertification = portalData.processingRoute === 'billing' || (!portalData.processingRoute && isPrivateScholar && !payrollList);
  const certificationDate = formatPortalDate(portalData.certificationCreatedAt, 'Not generated', 'Asia/Manila');
  const listDate = useCertification ? certificationDate : formatPortalDate(payrollList?.generatedAt, payrollList ? 'Date unavailable' : 'Not generated', 'Asia/Manila');
  const listSubtitle = useCertification
    ? certificationDate !== 'Not generated' ? 'Certification list generated' : 'Awaiting certification-list generation'
    : payrollList ? 'Included in payroll list' : 'Awaiting payroll-list generation';
  const summaryNotifications = application ? [
    !continuingOpen ? 'CAO is recording your initial requirements. Continuing submission is not open yet.' : rejectedCount > 0
      ? `${rejectedCount} requirement${rejectedCount === 1 ? ' was' : 's were'} returned for correction.`
      : attentionCount > 0
        ? `${attentionCount} scholar-managed requirement${attentionCount === 1 ? '' : 's'} still need your attention.`
        : pendingReviewCount > 0
          ? `${pendingReviewCount} uploaded document${pendingReviewCount === 1 ? ' is' : 's are'} awaiting Billing staff review.`
          : 'All scholar-managed requirements are approved.',
    listSubtitle + '.',
  ] : ['Scholar records are unavailable until loading succeeds.'];
  const unreadScholarNotifications = scholarNotifications.filter(({ isRead }) => !isRead);
  const latestScholarNotification = scholarNotifications[0] || null;
  const activeRequirementsTab = requirementsTab || (continuingOpen ? 'continuing' : 'initial');
  const entryYearLevel = portalData.requirementWave?.entryYearLevel || application?.school_plan?.incomingYearLevel;
  const initialRequirementItems = initialRequirementItemsFor(visibleRequirementItems, entryYearLevel, initialRequirements);
  const initialProgress = initialRequirementProgress(initialRequirementItems, initialRequirements, entryYearLevel, getRequirementReviewStatus);
  const initialApprovedCount = initialProgress.approved;
  const summaryApproved = continuingOpen ? approvedCount : initialApprovedCount;
  const summaryTotal = continuingOpen ? uploadableRequirements.length : initialProgress.total;
  const nextStep = buildScholarNextStep({ loading: loadingRequirements, error: requirementsError,
    continuingOpen, uploadsClosed: requirementsSubmissionClosed, rejectedCount, missingCount, pendingReviewCount,
    requirementsComplete, listed: useCertification ? certificationDate !== 'Not generated' : Boolean(payrollList), guidance: portalData.guidance });
  const openRequirements = (tab) => {
    setRequirementsTab(tab || 'initial');
    window.requestAnimationFrame(() => document.getElementById('scholar-requirements-title')?.focus({ preventScroll: true }));
  };
  const hasActionNotifications = unreadScholarNotifications.length > 0 || attentionCount > 0 || pendingReviewCount > 0 || (useCertification ? certificationDate === 'Not generated' : !payrollList);
  const uploadRequirement = async (requirement, file) => {
    if (!file) return;
    if (requirementsSubmissionClosed) {
      setNotice({ tone: 'error', message: continuingOpen ? 'The continuing-requirements deadline has passed. Contact CAO if a correction is required.' : 'CAO has not opened continuing submission yet.' });
      return;
    }
    setUploadingRequirement(requirement);
    try {
      const contentType = await validateDocumentFile(file);
      const fileData = await documentDataUrl(file, contentType);
      const response = await fetch(`${API_BASE}/applications/me/requirements`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token),
        },
        body: JSON.stringify({
          requirement,
          academicPeriodId: portalData.requirementWave?.academicPeriodId || portalData.activePeriod?.id,
          fileName: file.name,
          fileType: contentType,
          fileData,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Upload failed.');
      setApplication(body.application);
      setPortalData((current) => ({ ...current, requirementWave: { ...current.requirementWave, continuing: body.continuingRequirements || {} } }));
      setRequirementsError('');
      setNotice({ tone: 'success', message: `${file.name} was submitted for Billing staff review.` });
    } catch (error) {
      setNotice({ tone: 'error', message: error.message || 'Unable to upload this requirement.' });
    } finally {
      setUploadingRequirement('');
    }
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
              id="scholar-notifications-toggle"
              aria-label="Notifications"
              aria-expanded={notificationsOpen}
              aria-controls="scholar-notification-history"
              onClick={() => setNotificationsOpen((open) => !open)}
            >
              <Bell size={19} />{hasActionNotifications && <i />}
            </button>
            {notificationsOpen && (
              <div className="scholar-notification-dropdown" id="scholar-notification-history" role="region" aria-label="Scholar notifications">
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

      <div className="scholar-desktop-layout">
        {application && <ScholarDesktopNavigation />}
      <main className="scholar-dashboard-main">
        {profileOpen && (
          <div className="scholar-profile-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setProfileOpen(false); }}>
            <section ref={profileDialog} tabIndex={-1} className="scholar-profile-dialog" role="dialog" aria-modal="true" aria-labelledby="scholar-profile-title">
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
        <section className="scholar-welcome-card scholar-compact-welcome" id="scholar-overview" tabIndex={-1} aria-label="Scholar account overview">
          <div><p className="scholar-eyebrow">YOUR SCHOLAR WORKSPACE</p><h1>Welcome, {user?.firstName || displayName}</h1><div className="scholar-welcome-meta"><span>Scholar ID <strong>{portalData.scholar?.scholarId || 'Not assigned'}</strong></span><span><CalendarDays size={14} aria-hidden="true" />{portalData.activePeriod?.schoolYear || 'Academic period unavailable'}{portalData.activePeriod?.semester ? ' - ' + portalData.activePeriod.semester : ''}</span></div></div>
          <button type="button" className="scholar-profile-shortcut" onClick={() => setProfileOpen(true)}><UserRound size={17} aria-hidden="true" />My profile<ChevronRight size={15} aria-hidden="true" /></button>
        </section>
        {application && <ScholarMobileNavigation />}
        {(announcementError || notificationsError) && <Notification tone="error" title="Unable to refresh updates" action={<button type="button" onClick={() => setRefreshRequest((request) => request + 1)}>Retry updates</button>}>{announcementError || notificationsError} Announcements or notifications may be out of date.</Notification>}
        {requirementsError && <Notification tone="error" title="Unable to load scholar requirements" action={<button type="button" onClick={() => setRefreshRequest((request) => request + 1)}>Retry now</button>}>{requirementsError}</Notification>}
        {loadingRequirements && !application && <Notification tone="progress" title="Loading scholar records">Please wait while your records are loaded.</Notification>}
        {application && <>
          <section className="scholar-stat-grid scholar-summary-strip" id="scholar-summary" tabIndex={-1} aria-label="Scholarship summary">
            <article className="scholar-stat-card"><div className="scholar-stat-icon green"><CheckCircle2 size={21} aria-hidden="true" /></div><div><span>Scholarship status</span><strong>{portalData.scholar?.isActive ? 'Active Scholar' : 'Scholar record unavailable'}</strong><small>{portalData.scholar?.issuedAt ? 'Approved ' + formatPortalDate(portalData.scholar.issuedAt) : 'Approval date unavailable'}</small></div></article>
            <article className="scholar-stat-card"><div className="scholar-stat-icon blue"><FileCheck2 size={21} aria-hidden="true" /></div><div><span>{continuingOpen ? 'Continuing documents' : 'Initial documents'}</span><strong>{summaryApproved} of {summaryTotal} approved</strong><progress value={summaryApproved} max={summaryTotal || 1} aria-label="Approved documents" /><small>{continuingOpen ? 'Your uploads - selected submission period' : 'Managed by CAO - required document groups'}</small></div></article>
            <article className="scholar-stat-card"><div className="scholar-stat-icon gold"><ClipboardList size={21} aria-hidden="true" /></div><div><span>{useCertification ? 'Certification list' : 'Payroll list'}</span><strong>{listDate}</strong><small>{listSubtitle}</small></div></article>
          </section>
          <ScholarNextStep step={nextStep} timeline={portalData.guidance?.timeline} onOpenRequirements={openRequirements} />
          <div className="scholar-content-stack">
            <ScholarUpdates personal={latestScholarNotification} announcement={latestAnnouncement} onMarkRead={markNotificationRead} onOpenHistory={() => { setNotificationsOpen(true); document.getElementById('scholar-notifications-toggle')?.focus(); }} />
            <section className="scholar-panel scholar-requirements-panel" id="requirements" aria-labelledby="scholar-requirements-title">
              <div className="scholar-panel-heading"><div><p className="scholar-eyebrow">KEEP YOUR RECORD COMPLETE</p><h2 id="scholar-requirements-title" tabIndex={-1}>Requirements</h2><p className="scholar-panel-copy">Initial documents are managed by CAO. Continuing documents are your uploads.</p></div><FileCheck2 size={22} className="scholar-heading-icon" aria-hidden="true" /></div>
              <ScholarRequirementsTabs activeTab={activeRequirementsTab} onChange={setRequirementsTab} />
              <div role="tabpanel" id="scholar-panel-initial" aria-labelledby="scholar-tab-initial" hidden={activeRequirementsTab !== 'initial'}>
            <section className="scholar-panel"><div className="scholar-panel-heading"><div><p className="scholar-eyebrow">INITIAL SUBMISSION · CAO UPLOAD</p><h2>Initial requirements</h2></div></div><p className="scholar-panel-copy">CAO records these documents. You do not need to upload this initial set again.</p>{isFirstYearEntry(entryYearLevel) && <p className="scholar-panel-copy">For incoming/first-year college, either an approved COG or Grade 12 report card satisfies the initial academic record. You do not need both. Continuing submissions still require college grades.</p>}<div className="scholar-requirements-list">{initialRequirementItems.map(({ key, label, optional }) => <div key={key} className="scholar-requirement-item"><div><strong>{label}</strong><small>{initialRequirements[key]?.fileName || (optional ? 'Optional · provide if available' : 'Awaiting CAO upload')}</small></div><div className="initial-document-actions">{initialRequirements[key]?.fileName && <DocumentViewButton token={token} label={label} endpoint={`/applications/me/requirements/${key}/file?academicPeriodId=${portalData.requirementWave?.academicPeriodId}&submissionWave=initial`} />}
<span className={'scholar-review-badge ' + getRequirementReviewStatus(initialRequirements[key])}>{optional && !initialRequirements[key]?.fileName ? 'Optional' : requirementStatusLabels[getRequirementReviewStatus(initialRequirements[key])]}</span></div></div>)}</div></section>

              </div>
              <div role="tabpanel" id="scholar-panel-continuing" aria-labelledby="scholar-tab-continuing" hidden={activeRequirementsTab !== 'continuing'}>
            <section className="scholar-panel scholar-action-panel">
            {portalData.continuingPeriods?.length > 1 && <label className="scholar-continuing-period">Submission school year and semester<select value={requirementPeriodId || portalData.requirementWave?.academicPeriodId || ''} disabled={loadingRequirements || Boolean(uploadingRequirement)} onChange={(event) => setRequirementPeriodId(event.target.value)}>{portalData.continuingPeriods.map((period) => <option key={period.id} value={period.id}>{period.schoolYear} · {period.semester}</option>)}</select></label>}
            <p className="scholar-panel-copy">{portalData.requirementWave?.periodLabel}</p>
            <div className="scholar-panel-heading"><div><p className="scholar-eyebrow">{requirementsComplete ? 'REQUIREMENTS COMPLETE' : rejectedCount > 0 ? 'CORRECTION REQUIRED' : 'ACTION NEEDED'}</p><h2>{!continuingOpen ? 'Continuing requirements' : requirementsComplete ? 'Continuing requirements approved' : rejectedCount > 0 ? 'Review returned documents' : 'Upload continuing requirements'}</h2></div><FileCheck2 size={21} className="scholar-heading-icon" /></div>
            <div className={`scholar-requirements-deadline ${requirementsSubmissionClosed ? 'closed' : requirementsDeadline ? 'scheduled' : 'open'}`} role="status">
              <CalendarDays size={17} />
              <div><strong>{requirementsSubmissionClosed ? continuingSubmission?.state === 'waiting_initial' ? 'Waiting for initial verification' : 'Continuing uploads closed' : 'Continuing uploads open'}</strong><span>{continuingSubmission?.state === 'waiting_initial' ? 'CAO must approve all required initial documents first.' : requirementsSubmissionClosed ? 'CAO has closed continuing uploads for this academic period.' : 'You may upload continuing requirements until CAO closes submissions for this period.'}</span></div>
            </div>
            <p className="scholar-panel-copy">{requirementsComplete ? 'All continuing files have been approved for this academic period.' : continuingOpen ? `Upload your updated grades, registration form${isPrivateRequirementPeriod ? ', and Private-school tuition receipt' : ''} for this continuing submission. Initial files are preserved.` : 'CAO uploads all initial documents, including grades, registration form, and applicable tuition receipt. Your continuing upload controls open in the second wave.'}</p>
            <div className="scholar-requirements-list" aria-busy={loadingRequirements}>
              {visibleRequirementItems.map(({ key, label, note }) => {
                const item = uploadedRequirements[key];
                const isUploading = uploadingRequirement === key;
                const reviewStatus = getRequirementReviewStatus(item);
                return (
                  <div className="scholar-requirement-row" key={key}>
                    <span className="scholar-requirement-copy">
                      <strong>{label}</strong>
                      <small>
                        {loadingRequirements
                          ? 'Checking submission…'
                          : reviewStatus === 'approved'
                            ? `${item.fileName} · Approved${item.reviewedAt ? ` ${formatPortalDate(item.reviewedAt)}` : ''}`
                            : reviewStatus === 'rejected'
                              ? `Returned: ${item.reviewNotes || 'Please upload a clearer or corrected document.'}`
                              : reviewStatus === 'pending'
                                ? `${item.fileName} · Pending Billing staff review`
                                : note || 'No file uploaded'}
                      </small>
                      <small id={`scholar-file-policy-${key}`} className="scholar-file-policy">{DOCUMENT_FILE_HELP}</small>
                    </span>
                    <span className="scholar-requirement-actions">
                      {item?.fileName && <DocumentViewButton token={token} label={label} endpoint={`/applications/me/requirements/${key}/file?academicPeriodId=${portalData.requirementWave?.academicPeriodId}&submissionWave=continuing`} />}
                      {reviewStatus !== 'missing' && <span className={`scholar-review-badge ${reviewStatus}`}>{requirementStatusLabels[reviewStatus]}</span>}
                      {reviewStatus !== 'approved' && <label className={`scholar-upload-button ${item?.fileName ? 'submitted' : ''} ${requirementsSubmissionClosed ? 'closed' : ''}`}>
                        {requirementsSubmissionClosed ? 'Closed' : isUploading ? 'Uploading…' : reviewStatus === 'rejected' ? 'Upload again' : item?.fileName ? 'Replace' : 'Upload'}
                        <input
                          type="file"
                          aria-label={"Upload " + label}
                          aria-describedby={`scholar-file-policy-${key}`}
                          accept={DOCUMENT_FILE_ACCEPT}
                          onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; uploadRequirement(key, file); }}
                          disabled={requirementsSubmissionClosed || loadingRequirements || Boolean(uploadingRequirement)}
                        />
                      </label>}
                    </span>
                  </div>
                );
              })}
            </div>
            </section>

              </div>
            </section>
          </div>
        </>}
        <footer className="scholar-footer"><CalendarDays size={14} /> Need help? Contact the Community Affairs Office for assistance.</footer>
        <ScholarPayoutReceipts token={token} />
        <ScholarGraduation token={token} />
      </main>
      </div>
    </div>
  );
}

export default ScholarDashboard;
