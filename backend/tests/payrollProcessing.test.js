const assert = require('node:assert/strict');
const test = require('node:test');

// Inject an in-memory database facade before loading the real controllers.
// These tests cannot connect to a local or hosted database or send mail.
const prisma = {};
const prismaPath = require.resolve('../config/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
const { getSchoolCatalog, updateSchoolClassification, updateScholarBillingDetails, uploadMyRequirement, getScholarManagement, getMyApplication, processPayrollSelection, processBillingSelection } = require('../controllers/applicationController');

const setup = ({ schoolType = 'public', schoolName = 'TEST PUBLIC SCHOOL', applicantSchoolId = 1, periodSchoolId = 999, plannedSchool = '  TEST   PUBLIC SCHOOL  ', alreadyProcessed = false, gradeStatus = 'approved', tuitionReceipt = false, schoolHistory = [] } = {}) => {
  const period = { id: 10, school_year: '2027-2028', semester: '1st Semester', is_active: true };
  const school = { id: 1, name: schoolName, school_type: schoolType, is_active: true };
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
      findUnique: async () => requirement,
    },
    results: { findFirst: async () => null },
    eligibility_assessments: { findFirst: async () => null },
    exam_slots: { findMany: async () => [] },
    application_settings: { findUnique: async () => null },
    schools: { findMany: async () => [school], findFirst: async () => school, update: async ({ where, data }) => { writes.push({ type: 'school', id: where.id, data }); return { ...school, ...data }; } },
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

const generateWithOverride = async ({ role = 'SuperAdmin', overrides = [{ applicantId: 1, reason: 'Approved exception for pending requirements.' }] } = {}) => {
  const res = response();
  await processPayrollSelection({ body: { academicPeriodId: 10, applicantIds: [1], payrollOverrides: overrides }, user: { id: 99, role } }, res);
  return res;
};

test('all processing roles generate incomplete Payroll lists without override or document approval', async () => {
  for (const role of ['SuperAdmin', 'BillingPayrollAdmin', 'RegularAdmin']) {
    const { writes } = setup({ gradeStatus: 'pending' });
    const res = response();
    await processPayrollSelection({ body: { academicPeriodId: 10, applicantIds: [1] }, user: { id: 99, role } }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.incompleteRequirementsCount, 1);
    assert.equal(res.body.overrideCount, undefined);
    assert.equal(writes[0].data.status, 'generated');
    assert.equal(writes[1].data[0].claim_status, 'listed');
    assert.match(writes[1].data[0].notes, /Requirements incomplete at list generation/);
    assert.match(res.locals.auditDescription, /1 with incomplete requirements/);
    assert.equal((await prisma.application_submissions.findMany())[0].initial_docs.requirements.grades.status, 'pending');
  }
});

test('Payroll accepts missing requirements without creating approvals', async () => {
  const { writes } = setup();
  const [application] = await prisma.application_submissions.findMany();
  application.initial_docs.requirements = {};
  assert.equal((await generate()).statusCode, 201);
  assert.equal(writes.length, 2);
  assert.deepEqual(application.initial_docs.requirements, {});
});

test('retired Payroll overrides return reload guidance without writes', async () => {
  for (const overrides of [{}, [null], [{ applicantId: 1, reason: 'Old exception request.' }]]) {
    const { writes } = setup({ gradeStatus: 'pending' });
    const res = await generateWithOverride({ overrides });
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /overrides have been removed/);
    assert.equal(writes.length, 0);
  }
});

test('incomplete requirements never bypass account, classification, route, or duplicate blockers', async () => {
  for (const options of [{ schoolType: 'private', periodSchoolId: 1 }, { schoolType: 'unclassified', periodSchoolId: 1 }, { alreadyProcessed: true }, { inactive: true }, { unavailable: true }]) {
    const { writes } = setup({ gradeStatus: 'pending', ...options });
    if (options.inactive) prisma.scholar_accounts.findMany = async () => [{ applicant_id: 1, is_active: false }];
    if (options.unavailable) prisma.applicants.findMany = async () => [];
    const res = await generate();
    assert.equal(res.statusCode, 409);
    assert.ok(res.body.ineligible[0].reasons.length);
    assert.equal(writes.length, 0);
  }
});

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

test('Payroll ignores client-supplied school overrides and uses the specific scholar database record', async () => {
  const { writes } = setup({ schoolType: 'private', periodSchoolId: 1, tuitionReceipt: true });
  const res = response();
  await processPayrollSelection({
    body: { academicPeriodId: 10, applicantIds: [1], schoolId: 999, schoolType: 'Public' },
    user: { id: 99, role: 'SuperAdmin' },
  }, res);
  assert.equal(res.statusCode, 409);
  assert.ok(res.body.ineligible[0].reasons.some(({ code }) => code === 'PRIVATE_SCHOOL_BILLING_ROUTE'));
  assert.equal(writes.length, 0);
});

test('automatic Payroll identification does not borrow another selected scholar school', async () => {
  const { writes } = setup();
  prisma.scholar_accounts.findMany = async () => [1, 2].map((applicant_id) => ({ applicant_id, is_active: true }));
  prisma.applicants.findMany = async () => [{ id: 1, school_id: 1 }, { id: 2, school_id: null }];
  const firstApplication = (await prisma.application_submissions.findMany())[0];
  prisma.application_submissions.findMany = async () => [firstApplication, { ...firstApplication, id: 2, applicant_id: 2, school_plan: {} }];
  const res = response();
  await processPayrollSelection({ body: { academicPeriodId: 10, applicantIds: [1, 2] }, user: { id: 99, role: 'SuperAdmin' } }, res);
  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body.ineligible.map(({ applicantId }) => applicantId), [2]);
  assert.ok(res.body.ineligible[0].reasons.some(({ code }) => code === 'SCHOOL_CLASSIFICATION_MISSING'));
  assert.equal(writes.length, 0);
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
  assert.deepEqual(res.body.ineligible[0].reasons.map(({ code }) => code), ['PRIVATE_SCHOOL_BILLING_ROUTE']);
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

test('management listing exposes incomplete requirements as warnings and permits normal processing', async () => {
  setup({ gradeStatus: 'pending' });
  const record = await list();
  assert.equal(record.processEligible, true);
  assert.equal(record.documentStatus, 'Review');
  assert.equal(record.processingWarnings[0].requirement, 'grades');
  assert.deepEqual(record.billingEligibilityReasons, []);
  assert.equal((await generate()).statusCode, 201);
});

test('Private certification accepts missing tuition receipt and pending grades without overrides', async () => {
  const { writes } = setup({ schoolType: 'private', periodSchoolId: 1, gradeStatus: 'pending' });
  const res = response();
  await processBillingSelection({ body: { academicPeriodId: 10, applicantIds: [1] }, user: { id: 99, role: 'RegularAdmin' } }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.incompleteRequirementsCount, 1);
  assert.equal(writes[0].data.total_amount, 5000);
  assert.match(writes[1].data[0].notes, /Receipt of Tuition Fee has not been uploaded/);
  assert.equal((await prisma.application_submissions.findMany())[0].initial_docs.requirements.grades.status, 'pending');
});

test('Billing retains all hard blockers even when requirements are missing', async () => {
  for (const options of [{ inactive: true }, { unavailable: true }, { alreadyProcessed: true }, { schoolType: 'public' }]) {
    const { writes } = setup({ schoolType: 'private', periodSchoolId: 1, gradeStatus: 'pending', ...options });
    if (options.inactive) prisma.scholar_accounts.findMany = async () => [{ applicant_id: 1, is_active: false }];
    if (options.unavailable) prisma.applicants.findMany = async () => [];
    const res = response();
    await processBillingSelection({ body: { academicPeriodId: 10, applicantIds: [1] }, user: { id: 99, role: 'SuperAdmin' } }, res);
    assert.equal(res.statusCode, 409);
    assert.equal(writes.length, 0);
  }
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

test('actual Billing controller refuses missing school classification', async () => {
  const { writes } = setup({ applicantSchoolId: null, periodSchoolId: null, plannedSchool: 'UNKNOWN SCHOOL' });
  const res = response();
  await processBillingSelection({ body: { academicPeriodId: 10, applicantIds: [1] }, user: { id: 99, role: 'SuperAdmin' } }, res);
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

test('UCN saved school name uses the same persisted Public classification in Catalog, listing, Portal and Payroll', async () => {
  const { writes } = setup({ schoolName: 'University of Camarines Norte, Main Campus', plannedSchool: '  university of camarines norte, main campus ', applicantSchoolId: null, periodSchoolId: null });
  const catalog = response();
  await getSchoolCatalog({}, catalog);
  assert.equal(catalog.body.schools[0].classification, 'public');
  const record = await list();
  assert.equal(record.schoolType, 'Public');
  assert.equal(record.processEligible, true);
  assert.equal(record.documentsTotal, 5);
  const portal = response();
  await getMyApplication({ user: { id: 1, email: 'scholar@example.com' } }, portal);
  assert.equal(portal.body.school.schoolType, 'Public');
  assert.equal((await generate()).statusCode, 201);
  assert.equal(writes[0].data.total_amount, 3000);
});

test('an actual unclassified catalog row remains Unclassified in listing and Portal, and blocks generation', async () => {
  const { writes } = setup({ schoolType: 'unclassified', periodSchoolId: 1 });
  assert.equal((await list()).schoolType, 'Unclassified');
  const portal = response();
  await getMyApplication({ user: { id: 1, email: 'scholar@example.com' } }, portal);
  assert.equal(portal.body.school.schoolType, 'Unclassified');
  const generated = await generate();
  assert.equal(generated.statusCode, 409);
  assert.equal(generated.body.ineligible[0].reasons[0].code, 'SCHOOL_CLASSIFICATION_MISSING');
  assert.equal(writes.length, 0);
});

test('catalog classification update matches normalized saved names without creating a duplicate school', async () => {
  const { writes } = setup({ schoolName: '  TEST   PUBLIC SCHOOL  ' });
  const res = response();
  await updateSchoolClassification({ body: { name: 'test public school', classification: 'public' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].id, 1);
  assert.equal(writes[0].type, 'school');
});

test('billing editor cannot bypass an unclassified saved catalog entry by spoofing Public classification', async () => {
  const { writes } = setup({ schoolType: 'unclassified' });
  const res = response();
  await updateScholarBillingDetails({ params: { applicantId: '1' }, body: { academicPeriodId: 10, schoolId: 1, schoolClassification: 'Public', yearLevel: '1st Year', course: 'TEST COURSE', major: '', billingNotes: '', billingAmount: 3000 }, user: { id: 99 } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /School Catalog/);
  assert.equal(writes.length, 0);
});

test('actual Scholar tuition upload rejects Public current-period catalog classification', async () => {
  const { writes } = setup({ periodSchoolId: 1 });
  const [application] = await prisma.application_submissions.findMany();
  application.initial_docs.requirementWaves = { 10: { continuingOpenedAt: '2026-10-13T00:00:00Z' } };
  const res = response();
  await uploadMyRequirement({ body: { academicPeriodId: 10, requirement: 'tuition_receipt', fileName: 'test.pdf', fileData: 'data:application/pdf;base64,JVBERi0xLjQK' }, user: { id: 1, email: 'scholar@example.com' } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /Only Private/);
  assert.equal(writes.length, 0);
});


test('Private list generation works without a requirement row and records missing documents without approvals', async () => {
  const { writes } = setup({ schoolType: 'private', periodSchoolId: 1 });
  prisma.scholar_requirements.findMany = async () => [];
  const [application] = await prisma.application_submissions.findMany();
  application.initial_docs.requirements = {};
  prisma.$transaction = async (callback) => callback({
    payroll_batches: { create: async ({ data }) => { writes.push({ type: 'batch', data }); return { id: 51, ...data }; } },
    payroll_claims: { createMany: async ({ data }) => { writes.push({ type: 'memberships', data }); return { count: data.length }; } },
    scholar_requirements: {
      updateMany: async () => ({ count: 0 }),
      createMany: async ({ data }) => { writes.push({ type: 'requirements', data }); return { count: data.length }; },
    },
  });
  const res = response();
  await processBillingSelection({ body: { academicPeriodId: 10, applicantIds: [1] }, user: { id: 99, role: 'SuperAdmin' } }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.incompleteRequirementsCount, 1);
  assert.match(writes[1].data[0].notes, /Requirements incomplete/);
  assert.deepEqual(Object.keys(writes[2].data[0]).sort(), ['applicant_id', 'billing_period_id', 'billing_reference', 'updated_by']);
  assert.deepEqual(application.initial_docs.requirements, {});
});

test('Billing rejects retired override requests without generating a list', async () => {
  const { writes } = setup({ schoolType: 'private', periodSchoolId: 1 });
  const res = response();
  await processBillingSelection({ body: { academicPeriodId: 10, applicantIds: [1], billingOverrides: [{ applicantId: 1, reason: 'Old override.' }] }, user: { id: 99, role: 'SuperAdmin' } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /overrides have been removed/);
  assert.equal(writes.length, 0);
});


test('continuing-wave readiness does not inherit initial grades from legacy period columns', async () => {
  setup();
  const [application] = await prisma.application_submissions.findMany();
  const initial = application.initial_docs.requirements;
  application.initial_docs.requirementSets = { '10:initial': { academicPeriodId: 10, wave: 'initial', requirements: initial, history: [] } };
  application.initial_docs.requirementWaves = { 10: { continuingOpenedAt: '2026-10-13T00:00:00Z' } };
  const requirement = await prisma.scholar_requirements.findFirst();
  requirement.grade_report_file = 'old-grades.pdf'; requirement.grade_report_review_status = 'approved';
  requirement.registration_form_file = 'old-registration.pdf'; requirement.registration_form_review_status = 'approved';
  const record = await list();
  assert.equal(record.continuingOpen, true);
  assert.equal(record.initialDocuments.find((item) => item.requirementKey === 'grades').status, 'approved');
  assert.equal(record.continuingDocuments.find((item) => item.requirementKey === 'grades').submitted, false);
  assert.equal(record.processingWarnings.filter(({ code }) => code === 'REQUIREMENT_MISSING').length, 2);
  assert.equal(record.processEligible, true);
  const generated = await generate();
  assert.equal(generated.statusCode, 201);
  assert.equal(generated.body.incompleteRequirementsCount, 1);
});

test('Scholar can select a still-active earlier submission period without moving primary payroll context', async () => {
  setup();
  const primary = { id:10, school_year:'2027-2028', semester:'2nd Semester', is_active:true, is_primary:true };
  const earlier = { ...primary, id:9, semester:'1st Semester', is_primary:false };
  prisma.academic_periods.findFirst = async ({where}) => where?.id ? where.id === 9 ? earlier : null : primary;
  prisma.academic_periods.findMany = async () => [primary,earlier];
  prisma.continuing_requirement_schedules = { findUnique:async()=>({opens_at:new Date(Date.now()-60000),closes_at:new Date(Date.now()+60000),late_scope:'all',late_applicant_ids:[]}) };
  const res = response(); await getMyApplication({query:{requirementPeriodId:'9'},user:{id:1,email:'scholar@example.com'}},res);
  assert.equal(res.statusCode,200);assert.equal(res.body.activePeriod.id,10);assert.equal(res.body.requirementWave.academicPeriodId,9);assert.equal(res.body.requirementWave.continuingOpen,true);assert.equal(res.body.continuingPeriods.length,2);
  const invalid = response();await getMyApplication({query:{requirementPeriodId:'99'},user:{id:1,email:'scholar@example.com'}},invalid);assert.equal(invalid.statusCode,400);
  delete prisma.continuing_requirement_schedules;
});
test('Public payroll generation keeps missing continuing files as warnings after schedule starts',async()=>{
 const {writes}=setup();prisma.continuing_requirement_schedules={findUnique:async()=>({opens_at:new Date(Date.now()-60000),closes_at:new Date(Date.now()+60000),late_scope:'all',late_applicant_ids:[]})};
 const res=await generate();assert.equal(res.statusCode,201);assert.equal(res.body.incompleteRequirementsCount,1);assert.match(writes.find((item)=>item.type==='memberships').data[0].notes,/Certificate of Grades/);delete prisma.continuing_requirement_schedules;
});
