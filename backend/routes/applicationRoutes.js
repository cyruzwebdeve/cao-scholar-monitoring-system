const express = require('express');
const { authenticate, authenticateOptional } = require('../middleware/auth');
const { auditSuccessfulMutation } = require('../middleware/activityAudit');
const { checkRole, checkSectionAccess } = require('../middleware/rbac');
const { getActivityLogs } = require('../controllers/activityController');
const { getApplicationSettings, updateApplicationSettings } = require('../controllers/applicationSettingsController');
const { getLifecycleReport } = require('../controllers/lifecycleReportController');
const { getMyNotifications, markMyNotificationRead } = require('../controllers/notificationController');
const { approvePendingDocuments, getDocumentReviews, reviewDocument, streamDocument, updatePhysicalFolder } = require('../controllers/documentReviewController');
const {
  changeStaffPassword,
  createStaffAccount,
  getStaffManagement,
  updateStaffAccount,
} = require('../controllers/staffController');
const {
  getActiveAcademicPeriod,
  getAcademicPeriods,
  createAcademicPeriod,
  activateAcademicPeriod,
  createApplication,
  inputExamScore,
  submitOnlineExam,
  submitRequirements,
  activateScholar,
  markPayoutCompliant,
  markPaid,
  createPayrollBatch,
  releasePayrollBatch,
  getEligibleScholars,
  getScholarsByStatus,
  getScholarManagement,
  updateScholarBillingDetails,
  processBillingSelection,
  processPayrollSelection,
  getApplicationById,
  getMyApplication,
  uploadMyRequirement,
  createAnnouncement,
  getAnnouncementManagement,
  getLatestPublishedAnnouncement,
  updateAnnouncement,
  getDashboardSummary,
  getSchoolCatalog,
  updateSchoolClassification,
  getApplicantManagement,
  getExaminationManagement,
  saveExaminationManagement,
  acceptApplicantAsScholar,
  reevaluateExamResult,
} = require('../controllers/applicationController');
const {
  validateCreateApplication,
  validateExamInput,
  validateRequirements,
  validatePayrollBatch,
  validateAnnouncement,
  validateStaffCreate,
  validateStaffPassword,
  validateStaffUpdate,
  validateScholarBillingDetails,
  validateDocumentReview,
} = require('../middleware/validators');
const {
  announcementWriteRateLimiter,
  applicationSubmissionRateLimiter,
  documentUploadRateLimiter,
  staffWriteRateLimiter,
  scholarshipDecisionRateLimiter,
  documentReviewRateLimiter,
  billingWriteRateLimiter,
} = require('../middleware/rateLimits');

const router = express.Router();

router.use(auditSuccessfulMutation);

router.get('/academic-periods/active', getActiveAcademicPeriod);
router.get('/application-settings', getApplicationSettings);
router.put('/application-settings', authenticate, checkRole(['SuperAdmin', 'RegularAdmin']), checkSectionAccess('settings'), updateApplicationSettings);
router.get('/academic-periods', authenticate, checkRole(['Moderator', 'SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('settings'), getAcademicPeriods);
router.post('/academic-periods', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('settings'), createAcademicPeriod);
router.put('/academic-periods/:id/activate', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('settings'), activateAcademicPeriod);

router.get('/dashboard/summary', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('dashboard'), getDashboardSummary);
router.get('/schools/catalog', authenticate, checkRole(['SuperAdmin']), getSchoolCatalog);
router.get('/activity-logs', authenticate, checkRole(['SuperAdmin']), getActivityLogs);
router.get('/reports/lifecycle', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('reports'), getLifecycleReport);
router.get('/staff/management', authenticate, checkRole(['SuperAdmin']), getStaffManagement);
router.post('/staff', authenticate, staffWriteRateLimiter, checkRole(['SuperAdmin']), validateStaffCreate, createStaffAccount);
router.put('/staff/:id', authenticate, staffWriteRateLimiter, checkRole(['SuperAdmin']), validateStaffUpdate, updateStaffAccount);
router.put('/staff/:id/password', authenticate, staffWriteRateLimiter, checkRole(['SuperAdmin']), validateStaffPassword, changeStaffPassword);
router.get('/document-reviews', authenticate, checkRole(['Moderator', 'SuperAdmin']), checkSectionAccess('documentReviews'), getDocumentReviews);
router.get('/document-reviews/:applicationId/:requirementKey/file', authenticate, checkRole(['Moderator', 'SuperAdmin']), checkSectionAccess('documentReviews'), streamDocument);
router.put('/document-reviews/:applicantId/physical-folder', authenticate, documentReviewRateLimiter, checkRole(['Moderator', 'SuperAdmin']), checkSectionAccess('documentReviews'), updatePhysicalFolder);
router.put('/document-reviews/:applicationId/approve-pending', authenticate, documentReviewRateLimiter, checkRole(['Moderator', 'SuperAdmin']), checkSectionAccess('documentReviews'), approvePendingDocuments);
router.put('/document-reviews/:applicationId/:requirementKey', authenticate, documentReviewRateLimiter, checkRole(['Moderator', 'SuperAdmin']), checkSectionAccess('documentReviews'), validateDocumentReview, reviewDocument);
router.put('/schools/classification', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), updateSchoolClassification);
router.get('/applicants/management', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('applicants'), getApplicantManagement);
router.get('/examinations/management', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('examination'), getExaminationManagement);
router.put('/examinations/management', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('examination'), saveExaminationManagement);

// Public route to create a baseline application and optionally register a user
router.post('/applications', applicationSubmissionRateLimiter, authenticateOptional, validateCreateApplication, createApplication);

// Get application by ID (owner or privileged roles)
router.get('/applications/me', authenticate, checkRole(['Applicant', 'Scholar']), getMyApplication);
router.get('/notifications/me', authenticate, checkRole(['Applicant', 'Scholar']), getMyNotifications);
router.put('/notifications/:id/read', authenticate, checkRole(['Applicant', 'Scholar']), markMyNotificationRead);
router.put('/applications/me/requirements', authenticate, documentUploadRateLimiter, checkRole(['Scholar']), uploadMyRequirement);
router.get('/applications/:id', authenticate, checkRole(['SuperAdmin', 'BillingPayrollAdmin', 'Applicant', 'Scholar']), checkSectionAccess('applicants', 'billing', 'scholars'), getApplicationById);

// Super Admin only route to input exam results
router.put('/applications/:id/exam', authenticate, checkRole(['SuperAdmin']), validateExamInput, inputExamScore);
router.post('/applications/me/exam-result', authenticate, checkRole(['Applicant', 'Scholar']), submitOnlineExam);

// Applicant / Scholar route to upload baseline requirements
router.put('/applications/:id/requirements', authenticate, documentUploadRateLimiter, checkRole(['Scholar']), validateRequirements, submitRequirements);

// Super Admin route to activate a scholar as eligible
router.put('/applications/:id/activate', authenticate, checkRole(['SuperAdmin']), activateScholar);

// Billing/Payroll Admin route to mark scholar payout compliance
router.put('/applications/:id/payout-compliant', authenticate, checkRole(['BillingPayrollAdmin']), checkSectionAccess('billing'), markPayoutCompliant);

// Billing/Payroll Admin route to mark an individual scholar as paid
router.put('/applications/:id/paid', authenticate, checkRole(['BillingPayrollAdmin']), checkSectionAccess('payroll'), markPaid);

// Billing/Payroll Admin route to create a payroll batch from compliant scholars
router.post('/payroll/billing-batch', authenticate, checkRole(['BillingPayrollAdmin']), checkSectionAccess('payroll'), validatePayrollBatch, createPayrollBatch);

// Billing/Payroll Admin route to release a payroll batch and finalize payouts
router.put('/payroll/billing-batch/:id/release', authenticate, checkRole(['BillingPayrollAdmin']), checkSectionAccess('payroll'), releasePayrollBatch);

// List eligible scholars for payroll or review
router.get('/scholars/eligible', authenticate, checkRole(['SuperAdmin', 'BillingPayrollAdmin']), checkSectionAccess('payroll'), getEligibleScholars);

// List scholars by workflow status
router.get('/scholars', authenticate, checkRole(['SuperAdmin', 'BillingPayrollAdmin', 'Moderator']), checkSectionAccess('scholars'), getScholarsByStatus);
router.get('/scholars/management', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('scholars', 'billing', 'payroll'), getScholarManagement);
router.put('/scholars/:applicantId/billing-details', authenticate, billingWriteRateLimiter, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('billing'), validateScholarBillingDetails, updateScholarBillingDetails);
router.post('/billing/process', authenticate, billingWriteRateLimiter, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('billing'), processBillingSelection);
router.post('/payroll/process', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('payroll'), processPayrollSelection);
router.post('/scholars/:applicantId/accept', authenticate, scholarshipDecisionRateLimiter, checkRole(['SuperAdmin', 'BillingPayrollAdmin']), checkSectionAccess('examination'), acceptApplicantAsScholar);
router.put('/results/:applicantId/re-evaluate', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('examination'), reevaluateExamResult);

router.get('/announcements/latest', authenticate, checkRole(['Applicant', 'Scholar', 'Moderator', 'SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), getLatestPublishedAnnouncement);
router.get('/announcements/management', authenticate, checkRole(['Moderator', 'SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('announcements'), getAnnouncementManagement);
router.post('/announcements', authenticate, announcementWriteRateLimiter, checkRole(['Moderator', 'SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('announcements'), validateAnnouncement, createAnnouncement);
router.put('/announcements/:id', authenticate, announcementWriteRateLimiter, checkRole(['Moderator', 'SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('announcements'), validateAnnouncement, updateAnnouncement);

module.exports = router;
