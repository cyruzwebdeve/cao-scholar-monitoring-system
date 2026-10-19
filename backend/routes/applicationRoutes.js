const potentialScholars = require('../controllers/potentialScholarController');
const { getDashboardDetails } = require('../controllers/dashboardDetailsController');
const payoutSchedules = require('../controllers/payoutScheduleController');
const { sendToPayroll } = require('../controllers/payrollPreparationController');
const grantPreparation = require('../controllers/grantPreparationController');
const passerLists = require('../controllers/passerListController');
const phoneCapture = require('../controllers/phoneCaptureController');
const { rateLimit } = require('express-rate-limit');
const { getContinuingSchedule, saveContinuingSchedule } = require('../controllers/continuingScheduleController');
const { examinationResultController } = require('../controllers/examinationResultController');
const express = require('express');
const { onlineExamConfigurationController } = require('../controllers/onlineExamConfigurationController');
const { authenticate, authenticateOptional } = require('../middleware/auth');
const { auditSuccessfulMutation } = require('../middleware/activityAudit');
const { checkRole, checkSectionAccess } = require('../middleware/rbac');
const { getActivityLogs } = require('../controllers/activityController');
const { getApplicationSettings, updateApplicationSettings, getExaminationSettingsController, updateExaminationSettings } = require('../controllers/applicationSettingsController');
const { getLifecycleReport } = require('../controllers/lifecycleReportController');
const { getMyNotifications, markMyNotificationRead } = require('../controllers/notificationController');
const { approvePendingDocuments, getDocumentReviews, reviewDocument, streamDocument, streamMyDocument } = require('../controllers/documentReviewController');
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
  updateAcademicPeriodRequirementsDeadline,
  setPrimaryAcademicPeriod,
  deactivateAcademicPeriod,
  createApplication,
  getOnlineExamQuestions,
  submitOnlineExam,
  submitRequirements,
  activateScholar,
  getScholarManagement,
  updateScholarBillingDetails,
  updateScholarBillingMetadata,
  processBillingSelection,
  processPayrollSelection,
  getApplicationById,
  getMyApplication,
  uploadMyRequirement,
  uploadScholarRequirementByAdmin,
  openContinuingRequirements,
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
  updateExaminationAttendance,
  acceptApplicantAsScholar,
} = require('../controllers/applicationController');
const {
  validateCreateApplication,
  validateRequirements,
  validateAnnouncement,
  validateStaffCreate,
  validateStaffPassword,
  validateStaffUpdate,
  validateScholarBillingDetails,
  validateScholarBillingMetadata,
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
const privateResponse = (req, res, next) => { res.set('Cache-Control', 'no-store, private'); next(); };

router.use(auditSuccessfulMutation);

const phoneCaptureWriteLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 180, message: { message: 'Too many capture changes. Wait before retrying.' } });
const phoneCaptureAccess = [authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('scholars', 'examination'), privateResponse];
router.post('/phone-capture/sessions', ...phoneCaptureAccess, phoneCaptureWriteLimit, phoneCapture.create);
router.get('/phone-capture/sessions/:id', ...phoneCaptureAccess, phoneCapture.get);
router.post('/phone-capture/sessions/:id/pages', ...phoneCaptureAccess, phoneCaptureWriteLimit, phoneCapture.send);
router.post('/phone-capture/sessions/:id/freeze', ...phoneCaptureAccess, phoneCaptureWriteLimit, phoneCapture.freeze);
router.post('/phone-capture/sessions/:id/received', ...phoneCaptureAccess, phoneCaptureWriteLimit, phoneCapture.acknowledge);
router.delete('/phone-capture/sessions/:id', ...phoneCaptureAccess, phoneCaptureWriteLimit, phoneCapture.close);

router.get('/academic-periods/active', getActiveAcademicPeriod);
router.get('/application-settings', getApplicationSettings);
router.put('/application-settings', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('settings'), updateApplicationSettings);
router.get('/examination-settings', authenticate, checkRole(['Applicant', 'Scholar', 'SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), getExaminationSettingsController);
router.put('/examination-settings', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('settings'), updateExaminationSettings);
router.get('/online-examination/configuration', authenticate, checkRole(['SuperAdmin', 'RegularAdmin']), checkSectionAccess('settings'), onlineExamConfigurationController.get);
router.put('/online-examination/configuration', authenticate, staffWriteRateLimiter, checkRole(['SuperAdmin', 'RegularAdmin']), checkSectionAccess('settings'), onlineExamConfigurationController.save);
router.get('/scholars/continuing-schedules/:id', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('scholars'), getContinuingSchedule);
router.put('/scholars/continuing-schedules/:id', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('scholars'), saveContinuingSchedule);

router.get('/academic-periods', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('settings'), getAcademicPeriods);
router.post('/academic-periods', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('settings'), createAcademicPeriod);
router.put('/academic-periods/:id/activate', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('settings'), activateAcademicPeriod);
router.put('/academic-periods/:id/requirements-deadline', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('settings'), updateAcademicPeriodRequirementsDeadline);
router.put('/academic-periods/:id/primary', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('settings'), setPrimaryAcademicPeriod);
router.put('/academic-periods/:id/deactivate', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('settings'), deactivateAcademicPeriod);

router.get('/dashboard/summary', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('dashboard'), privateResponse, getDashboardSummary);
router.get('/dashboard/metrics/:metric', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('dashboard'), privateResponse, getDashboardDetails);
router.get('/schools/catalog', authenticate, checkRole(['SuperAdmin']), getSchoolCatalog);
router.get('/activity-logs', authenticate, checkRole(['SuperAdmin']), getActivityLogs);
router.get('/reports/lifecycle', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('reports'), getLifecycleReport);
router.get('/staff/management', authenticate, checkRole(['SuperAdmin']), getStaffManagement);
router.post('/staff', authenticate, staffWriteRateLimiter, checkRole(['SuperAdmin']), validateStaffCreate, createStaffAccount);
router.put('/staff/:id', authenticate, staffWriteRateLimiter, checkRole(['SuperAdmin']), validateStaffUpdate, updateStaffAccount);
router.put('/staff/:id/password', authenticate, staffWriteRateLimiter, checkRole(['SuperAdmin']), validateStaffPassword, changeStaffPassword);
router.get('/document-reviews', authenticate, checkRole(['BillingPayrollAdmin', 'SuperAdmin']), checkSectionAccess('documentReviews'), getDocumentReviews);
router.get('/document-reviews/:applicationId/:requirementKey/file', authenticate, checkRole(['BillingPayrollAdmin', 'SuperAdmin', 'RegularAdmin']), checkSectionAccess('documentReviews', 'scholars', 'examination'), streamDocument);
router.put('/document-reviews/:applicationId/approve-pending', authenticate, documentReviewRateLimiter, checkRole(['BillingPayrollAdmin', 'SuperAdmin']), checkSectionAccess('documentReviews'), approvePendingDocuments);
router.put('/document-reviews/:applicationId/:requirementKey', authenticate, documentReviewRateLimiter, checkRole(['BillingPayrollAdmin', 'SuperAdmin']), checkSectionAccess('documentReviews'), validateDocumentReview, reviewDocument);
router.put('/schools/classification', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), updateSchoolClassification);
router.post('/potential-scholars/accept-batch', privateResponse, authenticate, scholarshipDecisionRateLimiter, checkRole(['SuperAdmin', 'BillingPayrollAdmin']), checkSectionAccess('applicants'), checkSectionAccess('examination'), potentialScholars.acceptBatch);
router.post('/potential-scholars/:applicantId', privateResponse, authenticate, staffWriteRateLimiter, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('examination'), potentialScholars.add);
router.get('/applicants/complete-requirements', privateResponse, authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('applicants'), potentialScholars.index);
router.get('/applicants/management', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('applicants'), getApplicantManagement);
router.get('/passer-lists', privateResponse, authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('examination'), passerLists.index);
router.post('/passer-lists', privateResponse, authenticate, staffWriteRateLimiter, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('examination'), passerLists.create);
router.post('/passer-lists/:id/post', privateResponse, authenticate, staffWriteRateLimiter, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('examination'), passerLists.post);
router.get('/passers/:applicantId/intake', privateResponse, authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('examination'), passerLists.intake);
router.put('/passers/:applicantId/requirements/:requirementKey', authenticate, documentUploadRateLimiter, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('examination'), uploadScholarRequirementByAdmin);
router.get('/results/management', privateResponse, authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('examination'), getApplicantManagement);
router.get('/examinations/management', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('examination'), getExaminationManagement);
router.put('/examinations/management', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('examination'), saveExaminationManagement);
router.put('/examinations/:examId/attendance/:applicantId', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('examination'), updateExaminationAttendance);

router.post('/examinations/:examId/results/:applicantId', privateResponse, authenticate, staffWriteRateLimiter, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('examination'), examinationResultController.record);
router.put('/examinations/:examId/results/:applicantId', privateResponse, authenticate, staffWriteRateLimiter, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('examination'), examinationResultController.correct);
router.post('/examinations/:examId/results/:applicantId/publish', privateResponse, authenticate, staffWriteRateLimiter, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('examination'), examinationResultController.publish);

// Public route to create a baseline application and optionally register a user
router.post('/applications', applicationSubmissionRateLimiter, authenticateOptional, validateCreateApplication, createApplication);

// Get application by ID (owner or privileged roles)
router.get('/applications/me/requirements/:requirementKey/file', privateResponse, authenticate, checkRole(['Applicant', 'Scholar']), streamMyDocument);
router.get('/applications/me', privateResponse, authenticate, checkRole(['Applicant', 'Scholar']), getMyApplication);
router.get('/notifications/me', authenticate, checkRole(['Applicant', 'Scholar']), getMyNotifications);
router.put('/notifications/:id/read', authenticate, checkRole(['Applicant', 'Scholar']), markMyNotificationRead);
router.put('/applications/me/requirements', authenticate, documentUploadRateLimiter, checkRole(['Scholar']), uploadMyRequirement);
router.get('/applications/:id', authenticate, checkRole(['SuperAdmin', 'BillingPayrollAdmin', 'Applicant', 'Scholar']), checkSectionAccess('applicants', 'billing', 'scholars'), getApplicationById);

// Super Admin only route to input exam results
router.put('/applications/:id/exam', authenticate, checkRole(['SuperAdmin']), (req, res) => res.status(410).json({ message: 'Use the examination-specific Record score action in Results Management.' }));
router.get('/applications/me/examination/questions', authenticate, checkRole(['Applicant']), getOnlineExamQuestions);
router.post('/applications/me/exam-result', authenticate, checkRole(['Applicant', 'Scholar']), submitOnlineExam);

// Applicant / Scholar route to upload baseline requirements
router.put('/applications/:id/requirements', authenticate, documentUploadRateLimiter, checkRole(['Scholar']), validateRequirements, submitRequirements);

// Super Admin route to activate a scholar as eligible
router.put('/applications/:id/activate', authenticate, checkRole(['SuperAdmin']), activateScholar);

// Retired legacy payout workflow. Preserve authorization without business writes.
// Supported list generation uses /billing/process and /payroll/process.
const retiredPayoutWorkflow = (req, res) => res.status(410).json({
  code: 'LEGACY_PAYOUT_WORKFLOW_RETIRED',
  message: 'This legacy payout workflow is retired. Use Billing or Payroll Management to generate official lists. The system ends at payroll-list generation.',
});
router.put('/applications/:id/payout-compliant', authenticate, checkRole(['BillingPayrollAdmin']), checkSectionAccess('billing'), retiredPayoutWorkflow);
router.put('/applications/:id/paid', authenticate, checkRole(['BillingPayrollAdmin']), checkSectionAccess('payroll'), retiredPayoutWorkflow);
router.post('/payroll/billing-batch', authenticate, checkRole(['BillingPayrollAdmin']), checkSectionAccess('payroll'), retiredPayoutWorkflow);
router.put('/payroll/billing-batch/:id/release', authenticate, checkRole(['BillingPayrollAdmin']), checkSectionAccess('payroll'), retiredPayoutWorkflow);
router.get('/scholars/eligible', authenticate, checkRole(['SuperAdmin', 'BillingPayrollAdmin']), checkSectionAccess('payroll'), retiredPayoutWorkflow);
router.get('/scholars', authenticate, checkRole(['SuperAdmin', 'BillingPayrollAdmin']), checkSectionAccess('scholars'), retiredPayoutWorkflow);
router.get('/scholars/management', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('scholars', 'billing', 'payroll'), getScholarManagement);
router.put('/scholars/:applicantId/continuing-requirements/open', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('scholars'), openContinuingRequirements);
router.put('/scholars/:applicantId/requirements/:requirementKey', authenticate, documentUploadRateLimiter, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('scholars'), uploadScholarRequirementByAdmin);
router.put('/scholars/:applicantId/grant-preparation', authenticate, billingWriteRateLimiter, checkRole(['SuperAdmin','RegularAdmin','BillingPayrollAdmin']), checkSectionAccess('billing','payroll'), grantPreparation.save);
router.get('/scholars/:applicantId/tuition-receipt', privateResponse, authenticate, checkRole(['SuperAdmin','RegularAdmin','BillingPayrollAdmin']), checkSectionAccess('billing','payroll'), grantPreparation.receipt);
router.put('/scholars/:applicantId/billing-details', authenticate, billingWriteRateLimiter, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('billing'), validateScholarBillingDetails, updateScholarBillingDetails);
router.put('/scholars/:applicantId/billing-metadata', authenticate, billingWriteRateLimiter, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('billing', 'payroll'), validateScholarBillingMetadata, updateScholarBillingMetadata);
router.post('/billing/process', authenticate, billingWriteRateLimiter, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('billing'), processBillingSelection);
router.post('/scholars/:applicantId/payroll-preparation', authenticate, billingWriteRateLimiter, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('payroll'), sendToPayroll);
router.post('/payroll/process', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('payroll'), processPayrollSelection);
router.post('/scholars/:applicantId/accept', authenticate, scholarshipDecisionRateLimiter, checkRole(['SuperAdmin', 'BillingPayrollAdmin']), checkSectionAccess('examination'), acceptApplicantAsScholar);
// Retired latest-result mutation: exact exam/result revision is now required.
router.put('/results/:applicantId/re-evaluate', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('examination'), (req, res) => res.status(410).json({ message: 'Reload Results Management and use the examination-specific Correct score action.' }));

const payoutScheduleAccess = [authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('payroll'), privateResponse];
router.get('/payroll/schedules/management', ...payoutScheduleAccess, payoutSchedules.management);
router.get('/payroll/schedule-batches/:id', ...payoutScheduleAccess, payoutSchedules.roster);
router.post('/payroll/schedules', ...payoutScheduleAccess, billingWriteRateLimiter, payoutSchedules.save);
router.put('/payroll/schedules/:id', ...payoutScheduleAccess, billingWriteRateLimiter, payoutSchedules.save);
router.get('/payout-schedules/me', authenticate, checkRole(['Scholar']), privateResponse, payoutSchedules.mine);

router.get('/announcements/latest', authenticate, checkRole(['Applicant', 'Scholar', 'SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), getLatestPublishedAnnouncement);
router.get('/announcements/management', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('announcements'), getAnnouncementManagement);
router.post('/announcements', authenticate, announcementWriteRateLimiter, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('announcements'), validateAnnouncement, createAnnouncement);
router.put('/announcements/:id', authenticate, announcementWriteRateLimiter, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), checkSectionAccess('announcements'), validateAnnouncement, updateAnnouncement);

module.exports = router;
