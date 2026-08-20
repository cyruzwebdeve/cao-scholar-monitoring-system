const prisma = require('../config/prisma');
const { recordActivitySafely } = require('../services/activityLog');

const ACTIONS = {
  'POST /academic-periods': ['ACADEMIC_PERIOD_CREATED', 'academic_periods', 'Created an academic period.'],
  'PUT /academic-periods/:id/activate': ['ACADEMIC_PERIOD_ACTIVATED', 'academic_periods', 'Activated an academic period.'],
  'PUT /schools/classification': ['SCHOOL_CLASSIFICATION_UPDATED', 'schools', 'Updated a school classification.'],
  'PUT /examinations/management': ['EXAMINATION_SCHEDULES_UPDATED', 'exams', 'Saved examination schedules and assignments.'],
  'PUT /applications/me/requirements': ['SCHOLAR_REQUIREMENT_UPLOADED', 'scholar_requirements', 'Uploaded a scholar requirement.'],
  'PUT /applications/:id/exam': ['EXAMINATION_RESULT_RECORDED', 'results', 'Recorded an examination result.'],
  'POST /applications/me/exam-result': ['EXAMINATION_SUBMITTED', 'results', 'Submitted a qualifying examination.'],
  'PUT /applications/:id/requirements': ['SCHOLAR_REQUIREMENTS_UPDATED', 'scholar_requirements', 'Updated scholar requirements.'],
  'PUT /applications/:id/activate': ['SCHOLAR_ACTIVATED', 'scholar_accounts', 'Activated a scholar account.'],
  'PUT /applications/:id/payout-compliant': ['PAYOUT_COMPLIANCE_UPDATED', 'scholar_accounts', 'Updated payout compliance.'],
  'PUT /applications/:id/paid': ['SCHOLAR_MARKED_PAID', 'payroll_claims', 'Marked a scholar payment as paid.'],
  'POST /payroll/billing-batch': ['PAYROLL_BATCH_CREATED', 'payroll_batches', 'Created a payroll batch.'],
  'PUT /payroll/billing-batch/:id/release': ['PAYROLL_BATCH_RELEASED', 'payroll_batches', 'Released a payroll batch.'],
  'POST /billing/process': ['BILLING_PROCESSED', 'payroll_batches', 'Processed scholars for billing.'],
  'POST /payroll/process': ['PAYROLL_PROCESSED', 'payroll_claims', 'Completed payroll processing.'],
  'POST /scholars/:applicantId/accept': ['APPLICANT_ACCEPTED_AS_SCHOLAR', 'scholar_accounts', 'Accepted an applicant as a scholar.'],
  'PUT /results/:applicantId/re-evaluate': ['EXAMINATION_RESULT_REEVALUATED', 'results', 'Re-evaluated an examination result.'],
  'POST /announcements': ['ANNOUNCEMENT_CREATED', 'announcements', 'Created an announcement.'],
  'PUT /announcements/:id': ['ANNOUNCEMENT_UPDATED', 'announcements', 'Updated an announcement.'],
  'POST /staff': ['STAFF_ACCOUNT_CREATED', 'admins', 'Created a staff account.'],
  'PUT /staff/:id': ['STAFF_ACCOUNT_UPDATED', 'admins', 'Updated a staff account.'],
  'PUT /staff/:id/password': ['STAFF_PASSWORD_CHANGED', 'admins', 'Changed a staff account password.'],
};

const resolveTargetId = (req) => {
  const rawId = req.params?.id || req.params?.applicantId;
  const targetId = Number(rawId);
  return Number.isInteger(targetId) && targetId > 0 ? targetId : null;
};

const createActivityAudit = ({ client = prisma, recorder = recordActivitySafely } = {}) => (req, res, next) => {
  res.once('finish', () => {
    if (!req.user || res.statusCode < 200 || res.statusCode >= 300) return;
    const routePath = req.route?.path;
    const definition = ACTIONS[`${req.method} ${routePath}`];
    if (!definition) return;
    const [action, targetTable, description] = definition;
    void recorder(client, {
      user: req.user,
      action,
      description,
      targetTable,
      targetId: res.locals?.auditTargetId || resolveTargetId(req),
      ipAddress: req.ip,
    });
  });
  next();
};

const auditSuccessfulMutation = createActivityAudit();

module.exports = { ACTIONS, auditSuccessfulMutation, createActivityAudit };
