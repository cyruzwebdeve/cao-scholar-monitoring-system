const assert = require('node:assert/strict');
const test = require('node:test');

// Inject an in-memory database facade before loading the real controllers.
// These tests cannot connect to a local or hosted database or send mail.
const prisma = {};
const prismaPath = require.resolve('../config/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
const { getScholarManagement, getMyApplication, processPayrollSelection, processBillingSelection } = require('../controllers/applicationController');

const setup = ({ schoolType = 'public', applicantSchoolId = 1, periodSchoolId = 999, plannedSchool = '  TEST   PUBLIC SCHOOL  ', alreadyProcessed = false, gradeStatus = 'approved', tuitionReceipt = false, schoolHistory = [] } = {}) => {
  const period = { id: 10, school_year: '2027-2028', semester: '1st Semester', is_active: true };
  const school = { id: 1, name: 'TEST PUBLIC SCHOOL', school_type: schoolType, is_active: true };
  const applicant = { id: 1, school_id: applicantSchoolId, first_name: 'TEST', last_name: 'SCHOLAR', email: 'scholar@example.com' };
  const initialDocs = { requirements: Object.fromEntries(['tax_exemption', 'indigency', 'valid_id', 'grades', 'registration_form'].map((key) => [key, { fileName: `${key}.pdf`, status: key === 'grades' ? gradeStatus : 'approved' }])) };
  if (tuitionReceipt) initialDocs.requirements.tuition_receipt = { fileName: 'tuition_receipt.pdf', status: 'approved' };
  const application = { id: 1, applicant_id: 1, school_plan: { school: plannedSchool }, initial_docs: initialDocs };
  const requirement = { applicant_id: 1, billing_period_id: 10, school_id: periodSchoolId };
  const claims = alreadyProcessed ? [{ applicant_id: 1, academic_period_id: 10, payroll_batch_id: 50, claim_status: 'listed', claim_amount: 3000 }] : [];
  const batches = alreadyProcessed ? [{ id: 50, billing_period_id: 10, batch_number: 'PAYROLL-EXISTING', status: 'generated' }] : [];
  const writes = [];
  Object.assign(prisma, {
    academic_periods: { findFirst: async () => period, findMany: async () => [period] },
    scholar_accounts: {
      findMany: async () => [{ id: 1, applicant_id: 1, scholar_id: 'TEST-001', is_active: true }],
      findFirst: async () => ({ id: 1, applicant_id: 1, scholar_id: 'TEST-001', is_active: true }),
    },
    applicants: { findMany: async () => [applicant], findUnique: async () => applicant },
    control_accounts: { findMany: async () => [{ applicant_id: 1, control_number: 'TEST-001' }] },
    application_submissions: { findMany: async () => [application], findFirst: async () => application },
    scholar_requirements: {
      findMany: async ({ where }) => where.billing_period_id ? [requirement] : schoolHistory,
      findFirst: async () => requirement,
    },
    results: { findFirst: async () => null },
    eligibility_assessments: { findFirst: async () => null },
    exam_slots: { findMany: async () => [] },
    application_settings: { findUnique: async () => null },
    schools: { findMany: async () => [school] },
    payroll_claims: { findMany: async () => claims, findFirst: async () => null },
    payroll_batches: { findMany: async () => batches },
    $transaction: async (callback) => callback({
      payroll_batches: { create: async ({ data }) => { writes.push({ type: 'batch', data }); return { id: 51, ...data }; } },
      payroll_claims: { createMany: async ({ data }) => { writes.push({ type: 'memberships', data }); return { count: data.length }; } },
      scholar_requirements: { updateMany: async () => ({ count: 1 }) },
    }),
  });
  return { writes };
};

const response = () => ({
  locals: {}, statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const generate = async () => {
  const res = response();
  await processPayrollSelection({ body: { academicPeriodId: 10, applicantIds: [1] }, user: { id: 99, role: 'SuperAdmin' } }, res);
  return res;
};

const list = async () => {
  const res = response();
  await getScholarManagement({ query: { academicPeriodId: 10 } }, res);
  assert.equal(res.statusCode, 200);
  return res.body.scholars[0];
};

test('actual Payroll controller generates PHP 3,000 for Public scholars with five files despite dangling period school ID', async () => {
  const { writes } = setup();
  const record = await list();
  assert.equal(record.schoolType, 'Public');
  assert.equal(record.schoolId, 1);
  assert.equal(record.processEligible, true);
  assert.equal(record.documentsTotal, 5);
  const res = await generate();
  assert.equal(res.statusCode, 201);
  assert.equal(writes[0].data.total_amount, 3000);
  assert.equal(writes[1].data[0].claim_amount, 3000);
  assert.equal(writes[1].data[0].claim_status, 'listed');
});

test('listing and generation both resolve a Public planned school when direct IDs are absent', async () => {
  setup({ applicantSchoolId: null, periodSchoolId: null });
  assert.equal((await list()).processEligible, true);
  assert.equal((await generate()).statusCode, 201);
});

test('the exact missing-classification failure returns school correction, never a tuition receipt request', async () => {
  const { writes } = setup({ applicantSchoolId: null, periodSchoolId: null, plannedSchool: 'UNKNOWN SCHOOL' });
  const record = await list();
  assert.equal(record.schoolType, 'Unclassified');
  assert.equal(record.processEligible, false);
  const res = await generate();
  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body.ineligible[0].reasons.map(({ code }) => code), ['SCHOOL_CLASSIFICATION_MISSING']);
  assert.deepEqual(record.billingEligibilityReasons, res.body.ineligible[0].reasons);
  assert.equal(JSON.stringify(res.body).includes('tuition_receipt'), false);
  assert.equal(writes.length, 0);
});

test('genuinely Private scholars still require tuition receipt and cannot generate Public payroll', async () => {
  const { writes } = setup({ schoolType: 'private', periodSchoolId: 1 });
  const record = await list();
  assert.equal(record.processRoute, 'billing');
  assert.equal(record.documentsTotal, 6);
  const res = await generate();
  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body.ineligible[0].reasons.map(({ code }) => code), ['REQUIREMENT_MISSING', 'PRIVATE_SCHOOL_BILLING_ROUTE']);
  assert.equal(res.body.ineligible[0].reasons[0].requirement, 'tuition_receipt');
  assert.equal(writes.length, 0);
});

test('both listing and generation block duplicate list membership for the processing period', async () => {
  const { writes } = setup({ alreadyProcessed: true });
  const record = await list();
  assert.equal(record.processEligible, false);
  const res = await generate();
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.ineligible[0].reasons[0].code, 'ALREADY_PROCESSED_FOR_PERIOD');
  assert.equal(writes.length, 0);
});

test('Public semester requirements still need approval before generating payroll', async () => {
  const { writes } = setup({ gradeStatus: 'pending' });
  assert.equal((await list()).processEligible, false);
  const res = await generate();
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.ineligible[0].reasons[0].requirement, 'grades');
  assert.equal(writes.length, 0);
});

test('actual Billing controller retains Private PHP 5,000 certification generation with all six approved files', async () => {
  const { writes } = setup({ schoolType: 'private', periodSchoolId: 1, tuitionReceipt: true });
  const res = response();
  await processBillingSelection({ body: { academicPeriodId: 10, applicantIds: [1] }, user: { id: 99, role: 'SuperAdmin' } }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(writes[0].data.total_amount, 5000);
  assert.equal(writes[0].data.status, 'billed');
  assert.equal(writes[1].data[0].claim_amount, 5000);
});

test('actual Billing controller refuses missing school classification even with a requested override', async () => {
  const { writes } = setup({ applicantSchoolId: null, periodSchoolId: null, plannedSchool: 'UNKNOWN SCHOOL' });
  const res = response();
  await processBillingSelection({ body: { academicPeriodId: 10, applicantIds: [1], billingOverrides: [{ applicantId: 1, reason: 'Attempted school lookup bypass.' }] }, user: { id: 99, role: 'SuperAdmin' } }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.ineligible[0].reasons[0].code, 'SCHOOL_CLASSIFICATION_MISSING');
  assert.equal(writes.length, 0);
});

test('actual listing and Payroll generation automatically reuse a Public school from existing scholar history', async () => {
  setup({ applicantSchoolId: null, periodSchoolId: null, plannedSchool: '', schoolHistory: [{ applicant_id: 1, school_id: 1 }] });
  const record = await list();
  assert.equal(record.schoolId, 1);
  assert.equal(record.schoolType, 'Public');
  assert.equal(record.processEligible, true);
  assert.equal((await generate()).statusCode, 201);
});

test('Scholar Portal uses the same existing historical Public school without requiring re-entry', async () => {
  setup({ applicantSchoolId: null, periodSchoolId: null, plannedSchool: '', schoolHistory: [{ applicant_id: 1, school_id: 1 }] });
  const res = response();
  await getMyApplication({ user: { id: 1, email: 'scholar@example.com' } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.school, { name: 'TEST PUBLIC SCHOOL', schoolType: 'Public' });
});

test('Scholar Portal retains a valid current-period Private school instead of older Public history', async () => {
  setup({ schoolType: 'private', periodSchoolId: 1, applicantSchoolId: null, schoolHistory: [{ applicant_id: 1, school_id: 999 }] });
  const res = response();
  await getMyApplication({ user: { id: 1, email: 'scholar@example.com' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.school.schoolType, 'Private');
});
