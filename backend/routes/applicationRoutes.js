const express = require('express');
const { authenticate, authenticateOptional } = require('../middleware/auth');
const { checkRole } = require('../middleware/rbac');
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
  processBillingSelection,
  processPayrollSelection,
  getApplicationById,
  getMyApplication,
  uploadMyRequirement,
  createAnnouncement,
  getAnnouncementManagement,
  getLatestPublishedAnnouncement,
  updateAnnouncement,
  updateUserRole,
  getDashboardSummary,
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
  validateRoleUpdate,
} = require('../middleware/validators');

const router = express.Router();

router.get('/academic-periods/active', getActiveAcademicPeriod);
router.get('/academic-periods', authenticate, checkRole(['Moderator', 'SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), getAcademicPeriods);
router.post('/academic-periods', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), createAcademicPeriod);
router.put('/academic-periods/:id/activate', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), activateAcademicPeriod);

router.get('/dashboard/summary', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), getDashboardSummary);
router.put('/schools/classification', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), updateSchoolClassification);
router.get('/applicants/management', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), getApplicantManagement);
router.get('/examinations/management', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), getExaminationManagement);
router.put('/examinations/management', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), saveExaminationManagement);

// Public route to create a baseline application and optionally register a user
router.post('/applications', authenticateOptional, validateCreateApplication, createApplication);

// Get application by ID (owner or privileged roles)
router.get('/applications/me', authenticate, checkRole(['Applicant', 'Scholar']), getMyApplication);
router.put('/applications/me/requirements', authenticate, checkRole(['Scholar']), uploadMyRequirement);
router.get('/applications/:id', authenticate, checkRole(['SuperAdmin', 'BillingPayrollAdmin', 'Applicant', 'Scholar']), getApplicationById);

// Super Admin only route to input exam results
router.put('/applications/:id/exam', authenticate, checkRole(['SuperAdmin']), validateExamInput, inputExamScore);
router.post('/applications/me/exam-result', authenticate, checkRole(['Applicant', 'Scholar']), submitOnlineExam);

// Applicant / Scholar route to upload baseline requirements
router.put('/applications/:id/requirements', authenticate, checkRole(['Scholar']), validateRequirements, submitRequirements);

// Super Admin route to activate a scholar as eligible
router.put('/applications/:id/activate', authenticate, checkRole(['SuperAdmin']), activateScholar);

// Billing/Payroll Admin route to mark scholar payout compliance
router.put('/applications/:id/payout-compliant', authenticate, checkRole(['BillingPayrollAdmin']), markPayoutCompliant);

// Billing/Payroll Admin route to mark an individual scholar as paid
router.put('/applications/:id/paid', authenticate, checkRole(['BillingPayrollAdmin']), markPaid);

// Billing/Payroll Admin route to create a payroll batch from compliant scholars
router.post('/payroll/billing-batch', authenticate, checkRole(['BillingPayrollAdmin']), validatePayrollBatch, createPayrollBatch);

// Billing/Payroll Admin route to release a payroll batch and finalize payouts
router.put('/payroll/billing-batch/:id/release', authenticate, checkRole(['BillingPayrollAdmin']), releasePayrollBatch);

// List eligible scholars for payroll or review
router.get('/scholars/eligible', authenticate, checkRole(['SuperAdmin', 'BillingPayrollAdmin']), getEligibleScholars);

// List scholars by workflow status
router.get('/scholars', authenticate, checkRole(['SuperAdmin', 'BillingPayrollAdmin', 'Moderator']), getScholarsByStatus);
router.get('/scholars/management', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), getScholarManagement);
router.post('/billing/process', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), processBillingSelection);
router.post('/payroll/process', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), processPayrollSelection);
router.post('/scholars/:applicantId/accept', authenticate, checkRole(['SuperAdmin', 'BillingPayrollAdmin']), acceptApplicantAsScholar);
router.put('/results/:applicantId/re-evaluate', authenticate, checkRole(['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), reevaluateExamResult);

router.get('/announcements/latest', authenticate, checkRole(['Applicant', 'Scholar', 'Moderator', 'SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), getLatestPublishedAnnouncement);
router.get('/announcements/management', authenticate, checkRole(['Moderator', 'SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), getAnnouncementManagement);
router.post('/announcements', authenticate, checkRole(['Moderator', 'SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), validateAnnouncement, createAnnouncement);
router.put('/announcements/:id', authenticate, checkRole(['Moderator', 'SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']), validateAnnouncement, updateAnnouncement);

// Super Admin route to update a user's role
router.put('/users/:id/role', authenticate, checkRole(['SuperAdmin']), validateRoleUpdate, updateUserRole);

module.exports = router;
