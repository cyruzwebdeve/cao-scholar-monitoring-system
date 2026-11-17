const assert = require('node:assert/strict');
const { test, beforeEach } = require('node:test');
const { dataUrl } = require('./fixtures/documentFiles');

const prisma = {};
let emails;
for (const [modulePath, exports] of [
  ['../config/prisma', prisma],
  ['../services/mailer', { sendApplicantAccountEmail: async () => { emails += 1; return { sent: false }; } }],
  ['../services/activityLog', { recordActivitySafely: async () => {} }],
]) {
  const filename = require.resolve(modulePath);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}
delete require.cache[require.resolve('../controllers/applicationController')];
const { createApplication, getApplicantManagement, getMyApplication, getScholarManagement, processBillingSelection, processPayrollSelection,
  uploadMyRequirement, uploadScholarRequirementByAdmin, openContinuingRequirements, updateScholarBillingDetails, updateScholarBillingMetadata, submitRequirements } = require('../controllers/applicationController');
const response = () => ({ locals: {}, statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const period = (id, year, active = false) => ({ id, school_year: year, semester: '1st Semester', is_active: active, is_primary: active,
  status: active ? 'active' : 'upcoming', created_at: new Date('2026-01-01'), updated_at: new Date('2026-01-01') });
const applicant = (id, year) => ({ id, school_year: year, first_name: `Synthetic${id}`, last_name: 'Applicant', municipality: 'North',
  email: `synthetic${id}@example.test`, status: 'pending', deleted_at: null, created_at: new Date('2026-01-01') });
const application = id => ({ id: id + 100, applicant_id: id, email: `synthetic${id}@example.test`, status: 'Applied',
  school_plan: { school: 'Synthetic public school', incomingYearLevel: '1st Year' }, identity: {}, address: {}, family: {},
  eligibility: {}, initial_docs: {}, submitted_at: new Date('2026-01-01') });
const exam = (id, year) => ({ id, academic_year: year, municipality: 'North', title: 'Synthetic exam', venue: 'Synthetic hall',
  exam_date: new Date(`${year.slice(0, 4)}-07-20`), exam_end_date: new Date(`${year.slice(0, 4)}-07-20`), is_active: true });
let state, intakeId, writes, beforeTransaction;

beforeEach(t => {
  t.mock.method(console, 'error', () => {});
  intakeId = 2;
  writes = [];
  emails = 0;
  beforeTransaction = null;
  state = {
    periods: [period(1, '2026-2027', true), period(2, '2027-2028'), period(3, '2028-2029'), period(4, '2025-2026')],
    applicants: [applicant(5, '2027-2028'), applicant(6, '2026-2027'), applicant(7, '2025-2026')],
    applications: [application(5), application(6), application(7)],
    exams: [exam(20, '2027-2028'), exam(10, '2026-2027'), exam(9, '2025-2026')],
    results: [
      { id: 200, applicant_id: 5, exam_id: 20, score: 18, passing_score: 14, passed: true, published_at: new Date('2027-07-21'), updated_at: new Date('2027-07-21') },
      { id: 100, applicant_id: 6, exam_id: 10, score: 15, passing_score: 14, passed: true, published_at: new Date('2026-07-21'), updated_at: new Date('2026-07-21') },
    ],
    slots: [{ id: 50, applicant_id: 5, exam_id: 20, appeared: true }, { id: 60, applicant_id: 6, exam_id: 10, appeared: true }],
    scholar: null,
    requirements: [],
    schools: [{ id: 1, name: 'Synthetic public school', school_type: 'public' }],
  };
  const idsMatch = (row, where) => !where?.applicant_id?.in || where.applicant_id.in.includes(row.applicant_id);
  Object.assign(prisma, {
    intake_settings: { findUnique: async () => ({ id: 1, academic_period_id: intakeId, revision: 0 }) },
    academic_periods: {
      findUnique: async ({ where }) => state.periods.find(row => row.id === where.id) || null,
      findFirst: async ({ where }) => state.periods.find(row => (!where.id || row.id === where.id)
        && (!where.school_year || row.school_year === where.school_year)
        && (!where.is_active || row.is_active) && (!where.is_primary || row.is_primary)) || null,
      findMany: async ({ where } = {}) => state.periods.filter(row => !where?.is_active || row.is_active),
    },
    application_settings: { findUnique: async () => ({ is_enabled: true, examination_enabled: true, exam_delivery_mode: 'online' }) },
    applicants: {
      findFirst: async ({ where }) => state.applicants.find(row => row.email === where.email) || null,
      findUnique: async ({ where }) => state.applicants.find(row => row.id === where.id) || null,
      findMany: async ({ where } = {}) => state.applicants.filter(row => !where?.id?.in || where.id.in.includes(row.id)),
      create: async ({ data }) => { const row = { id: 99, ...data }; writes.push('applicant'); state.applicants.push(row); return row; },
    },
    control_accounts: {
      findMany: async () => state.applicants.map(row => ({ applicant_id: row.id, control_number: `SYN-${row.id}`, username: row.email })),
      create: async ({ data }) => { writes.push('account'); return { id: 99, ...data }; },
    },
    application_submissions: {
      findFirst: async ({ where }) => state.applications.find(row => where.email ? row.email === where.email
        : where.applicant_id ? row.applicant_id === where.applicant_id : where.OR?.some(filter => filter.applicant_id === row.applicant_id)) || null,
      findMany: async ({ where }) => state.applications.filter(row => idsMatch(row, where)),
      findUnique: async ({ where }) => state.applications.find(row => row.id === where.id) || null,
      updateMany: async ({ where, data }) => {
        const row = state.applications.find(row => row.id === where.id);
        if (!row) return { count: 0 };
        writes.push('requirements'); Object.assign(row, data); return { count: 1 };
      },
      create: async ({ data }) => { writes.push('application'); const row = { id: 199, ...data }; state.applications.push(row); return row; },
    },
    exams: {
      findFirst: async ({ where }) => state.exams.find(row => row.academic_year === where.academic_year && (!where.id || row.id === where.id)) || null,
      findMany: async () => state.exams,
      findUnique: async ({ where }) => state.exams.find(row => row.id === where.id) || null,
    },
    results: {
      findMany: async ({ where }) => state.results.filter(row => idsMatch(row, where)),
      findFirst: async ({ where }) => state.results.find(row => (!where.id || row.id === where.id)
        && row.applicant_id === where.applicant_id && (!where.exam_id || row.exam_id === where.exam_id)) || null,
    },
    exam_slots: {
      findMany: async ({ where }) => state.slots.filter(row => idsMatch(row, where)),
      findUnique: async ({ where }) => state.slots.find(row => row.applicant_id === where.applicant_id_exam_id?.applicant_id
        && row.exam_id === where.applicant_id_exam_id?.exam_id) || null,
      createMany: async ({ data }) => { writes.push('assignment'); state.slots.push(...data); return { count: data.length }; },
      upsert: async ({ where, create }) => {
        const existing = state.slots.find(row => row.applicant_id === where.applicant_id_exam_id.applicant_id && row.exam_id === where.applicant_id_exam_id.exam_id);
        if (existing) return existing;
        const row = { id: 99, ...create }; writes.push('assignment'); state.slots.push(row); return row;
      },
    },
    scholar_accounts: { findFirst: async () => state.scholar, findMany: async () => state.scholar ? [state.scholar] : [] },
    scholar_requirements: {
      findFirst: async ({ where }) => state.requirements.find(row => row.applicant_id === where.applicant_id && row.billing_period_id === where.billing_period_id) || null,
      findUnique: async ({ where }) => state.requirements.find(row => row.applicant_id === where.applicant_id_billing_period_id.applicant_id && row.billing_period_id === where.applicant_id_billing_period_id.billing_period_id) || null,
      findMany: async ({ where } = {}) => state.requirements.filter(row => (!where?.billing_period_id || row.billing_period_id === where.billing_period_id) && idsMatch(row, where)),
      upsert: async ({ where, create, update }) => {
        const key = where.applicant_id_billing_period_id;
        let row = state.requirements.find(item => item.applicant_id === key.applicant_id && item.billing_period_id === key.billing_period_id);
        if (row) Object.assign(row, update);
        else { row = { ...create }; state.requirements.push(row); }
        writes.push('period-metadata'); return row;
      },
    },
    payroll_batches: { findMany: async () => [], findUnique: async () => null },
    payroll_claims: { findFirst: async () => null, findMany: async () => [] },
    eligibility_assessments: { findFirst: async () => null },
    schools: { findMany: async () => state.schools, findFirst: async () => state.schools[0] || null },
    passer_list_members: { findMany: async () => [] },
    $queryRaw: async strings => { assert.match(strings.join('?'), /FROM intake_settings WHERE id = 1 FOR SHARE/); writes.push('intake-lock'); return [{ id: 1 }]; },
    $transaction: async callback => { if (beforeTransaction) beforeTransaction(); return callback(prisma); },
  });
});
const request = overrides => ({ body: { email: 'synthetic-new@example.test', password: 'synthetic-password', academicPeriodId: 2, academicYear: '2027-2028',
  personalInfo: { identity: { firstName: 'Synthetic', familyName: 'New', birthday: '2008-01-01' }, address: { municipality: 'North' },
    schoolPlan: { school: 'Synthetic public school', incomingYearLevel: '1st Year' },
    family: { fatherName: 'Synthetic New Father', motherName: 'Synthetic New Mother' }, eligibility: { siblingRuleAccepted: true } }, ...overrides } });

test('registration uses the independent intake and leaves processing periods and accounts unchanged', async () => {
  const periods = structuredClone(state.periods);
  const res = response();
  await createApplication(request(), res);
  assert.equal(res.statusCode, 201);
  assert.equal(state.applicants.at(-1).school_year, '2027-2028');
  assert.equal(state.applications.at(-1).initial_docs.initialRequirementPeriodId, 2);
  assert.equal(state.slots.at(-1).exam_id, 20);
  assert.deepEqual(state.periods, periods);
  assert.equal(emails, 1);
});

test('registration rejects a missing or mismatched displayed intake before writing records', async () => {
  for (const scope of [{ academicPeriodId: undefined }, { academicYear: undefined }, { academicPeriodId: 1, academicYear: '2026-2027' }]) {
    const res = response();
    await createApplication(request(scope), res);
    assert.ok([400, 409].includes(res.statusCode));
  }
  assert.equal(writes.length, 0);
  assert.equal(emails, 0);
});

test('registration rereads a changed intake inside its transaction and creates no wrong-year records', async () => {
  beforeTransaction = () => { intakeId = 3; };
  const res = response();
  await createApplication(request(), res);
  assert.equal(res.statusCode, 409);
  assert.deepEqual(writes, ['intake-lock']);
  assert.equal(state.applicants.length, 3);
  assert.equal(emails, 0);
});

test('existing account reapplication remains rejected without resetting the account', async () => {
  const original = structuredClone(state.applicants[0]);
  const res = response();
  await createApplication(request({ email: state.applicants[0].email }), res);
  assert.equal(res.statusCode, 409);
  assert.deepEqual(state.applicants[0], original);
  assert.equal(writes.length, 0);
});

test('Applicant management defaults to intake year and scopes cards, rows and dates together', async () => {
  const res = response();
  await getApplicantManagement({}, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.intakePeriod.id, 2);
  assert.equal(res.body.intakePeriod.isActive, false);
  assert.deepEqual(res.body.applicants.map(row => row.id), [5]);
  assert.deepEqual(res.body.stats, { total: 1, scheduled: 1, completed: 1, passed: 1 });
  assert.equal(res.body.metricRecords.completed.length, 1);
  assert.equal(res.body.applicants[0].academicYear, '2027-2028');
  assert.equal(res.body.applicants[0].readOnly, false);
  assert.equal(writes.length, 0);
});

test('historical and all-year Applicant views retain saved labels and stay read-only', async () => {
  const historic = response();
  await getApplicantManagement({ query: { schoolYear: '2025-2026' } }, historic);
  assert.deepEqual(historic.body.applicants.map(row => row.id), [7]);
  assert.equal(historic.body.applicants[0].schoolYear, '2025-2026');
  assert.equal(historic.body.scope.isCurrentIntake, false);
  assert.equal(historic.body.applicants[0].readOnly, true);
  const all = response();
  await getApplicantManagement({ query: { schoolYear: 'all' } }, all);
  assert.equal(all.body.applicants.length, 3);
  assert.deepEqual(all.body.stats, { total: 3, scheduled: 3, completed: 2, passed: 2 });
  assert.ok(all.body.applicants.every(row => row.readOnly));
  assert.equal(writes.length, 0);
});

test('unknown recorded intake years are not silently assigned to the current intake', async () => {
  state.applicants = [applicant(8, null)]; state.applications = [application(8)]; state.results = []; state.slots = [];
  const current = response();
  await getApplicantManagement({}, current);
  assert.equal(current.body.stats.total, 0);
  const all = response();
  await getApplicantManagement({ query: { schoolYear: 'all' } }, all);
  assert.equal(all.body.applicants[0].schoolYear, null);
  assert.equal(all.body.applicants[0].academicPeriodId, null);
});

test('Applicant portal preserves the original historical result without granting new intake access', async () => {
  const res = response();
  await getMyApplication({ user: { id: 6 }, query: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.intakePeriod.schoolYear, '2027-2028');
  assert.equal(res.body.intakeScope.schoolYear, '2026-2027');
  assert.equal(res.body.intakeScope.archived, true);
  assert.equal(res.body.examination.score, 15);
  assert.equal(res.body.examination.academicYear, '2026-2027');
  assert.equal(res.body.examination.access.allowed, false);
  assert.equal(res.body.guidance.actions.length, 0);
  assert.match(res.body.guidance.description, /original academic year/);
  assert.doesNotMatch(res.body.guidance.description, /intake/i);
  assert.equal(writes.length, 0);
});

test('changing intake leaves an accepted Scholar portal on its original processing period and result', async () => {
  state.scholar = { id: 1, applicant_id: 6, scholar_id: 'SYN-SCHOLAR', is_active: true, result_id: 100 };
  const res = response();
  await getMyApplication({ user: { id: 6 }, query: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.intakePeriod.id, 2);
  assert.equal(res.body.intakePeriod.schoolYear, '2027-2028');
  assert.equal(res.body.intakePeriod.isActive, false);
  assert.equal(res.body.intakePeriodUnavailable, false);
  assert.equal(res.body.activePeriod.id, 1);
  assert.equal(res.body.activePeriod.schoolYear, '2026-2027');
  assert.equal(res.body.scholar.scholarId, 'SYN-SCHOLAR');
  assert.equal(res.body.examination.score, 15);
  assert.equal(res.body.requirementWave.academicPeriodId, 1);
  assert.deepEqual(res.body.continuingPeriods.map(row => row.id), [1]);
  intakeId = 3;
  const refreshed = response();
  await getMyApplication({ user: { id: 6 }, query: {} }, refreshed);
  assert.equal(refreshed.statusCode, 200);
  assert.equal(refreshed.body.intakePeriod.schoolYear, '2028-2029');
  assert.equal(refreshed.body.activePeriod.id, 1);
  assert.equal(refreshed.body.requirementWave.academicPeriodId, 1);
  assert.equal(refreshed.body.examination.academicYear, '2026-2027');
  assert.equal(refreshed.body.examination.score, 15);
  assert.equal(writes.length, 0);
});

test('Scholar current academic year is independent of the selected continuing-requirements period', async () => {
  state.scholar = { id: 1, applicant_id: 6, scholar_id: 'SYN-SCHOLAR', is_active: true, result_id: 100 };
  state.periods.find(row => row.id === 3).is_active = true;
  const periods = structuredClone(state.periods);
  const applicationRecord = structuredClone(state.applications.find(row => row.applicant_id === 6));
  const res = response();
  await getMyApplication({ user: { id: 6 }, query: { requirementPeriodId: '3' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.intakePeriod.schoolYear, '2027-2028');
  assert.equal(res.body.intakePeriodUnavailable, false);
  assert.equal(res.body.activePeriod.schoolYear, '2026-2027');
  assert.equal(res.body.requirementWave.academicPeriodId, 3);
  assert.equal(res.body.requirementWave.periodLabel, '2028-2029 · 1st Semester');
  assert.deepEqual(res.body.continuingPeriods.map(row => row.id), [1, 3]);
  assert.equal(res.body.examination.score, 15);
  assert.deepEqual(state.periods, periods);
  assert.deepEqual(state.applications.find(row => row.applicant_id === 6), applicationRecord);
  assert.equal(writes.length, 0);
});

test('unconfigured current academic year does not fall back to Scholar processing or original records', async () => {
  state.scholar = { id: 1, applicant_id: 6, scholar_id: 'SYN-SCHOLAR', is_active: true, result_id: 100 };
  for (const configuredId of [null, 999]) {
    intakeId = configuredId;
    const res = response();
    await getMyApplication({ user: { id: 6 }, query: {} }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.intakePeriod, null);
    assert.equal(res.body.intakePeriodUnavailable, false);
    assert.equal(res.body.activePeriod.schoolYear, '2026-2027');
    assert.equal(res.body.examination.score, 15);
    assert.equal(res.body.requirementWave.academicPeriodId, 1);
  }
  assert.equal(writes.length, 0);
});

test('a failed current academic year lookup leaves Scholar records and processing available', async () => {
  state.scholar = { id: 1, applicant_id: 6, scholar_id: 'SYN-SCHOLAR', is_active: true, result_id: 100 };
  for (const lookup of [
    null,
    { findUnique: async () => { throw Object.assign(new Error('Synthetic missing table'), { code: 'P2021' }); } },
    { findUnique: async () => { throw Object.assign(new Error('Synthetic database read failure'), { code: 'P1001' }); } },
  ]) {
    prisma.intake_settings = lookup;
    const res = response();
    await getMyApplication({ user: { id: 6 }, query: {} }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.intakePeriod, null);
    assert.equal(res.body.intakePeriodUnavailable, true);
    assert.equal(res.body.scholar.scholarId, 'SYN-SCHOLAR');
    assert.equal(res.body.activePeriod.id, 1);
    assert.equal(res.body.requirementWave.academicPeriodId, 1);
    assert.equal(res.body.examination.score, 15);
  }
  assert.equal(writes.length, 0);
});

const acceptFutureScholar = (schoolType = 'public') => {
  state.applicants = [applicant(5, '2027-2028')];
  state.applicants[0].school_id = 1;
  state.applications = [application(5)];
  state.scholar = { id: 1, applicant_id: 5, scholar_id: 'SYN-FUTURE', is_active: true, result_id: 200 };
  state.schools[0].school_type = schoolType;
  state.requirements = [{ applicant_id: 5, billing_period_id: 1, school_id: 1,
    ...(schoolType === 'private' ? { tuition_fee_assistance: 3500, grant_prepared_at: new Date(), grant_prepared_by: 99 } : {}) }];
  state.applications[0].initial_docs = { initialRequirementPeriodId: 2, requirementSets: {
    '2:initial': { academicPeriodId: 2, wave: 'initial', requirements: Object.fromEntries(
      ['tax_exemption', 'valid_id', 'grades', 'report_card', 'registration_form', ...(schoolType === 'private' ? ['tuition_receipt'] : [])]
        .map(key => [key, { fileName: `${key}.pdf`, status: 'Approved' }])) },
  } };
};
const scholarRequest = (periodId = 1) => ({ user: { id: 5, role: 'Scholar' }, body: {
  academicPeriodId: periodId, requirement: 'grades', fileName: 'synthetic-grades.pdf', fileData: dataUrl() }, query: {} });
const adminRequest = (periodId = 1) => ({ user: { id: 99, role: 'SuperAdmin' }, params: { applicantId: '5', requirementKey: 'grades' },
  body: { ...scholarRequest(periodId).body, applicantIds: [5], schoolId: 1, yearLevel: '1st Year', course: 'Synthetic course', major: '', billingNotes: '', billingStatus: 'Not billed' }, query: {} });

const firstSemesterReuseScholar = () => {
  acceptFutureScholar();
  state.periods.forEach(row => { row.is_primary = row.id === 2; row.is_active = [2, 3].includes(row.id); });
  const files = state.applications[0].initial_docs.requirementSets['2:initial'].requirements;
  for (const key of ['grades', 'registration_form']) Object.assign(files[key], {
    fileData: dataUrl(), versionId: `synthetic-initial-${key}`, revision: 2,
    reviewedAt: '2027-07-22T00:00:00.000Z', reviewHistory: [{ status: 'Approved', revision: 2 }],
  });
};

test('Scholar portal reuses approved academic files only in their original first-semester period without writing copies', async () => {
  firstSemesterReuseScholar();
  const originalDocs = structuredClone(state.applications[0].initial_docs);
  const read = response();
  await getMyApplication({ ...scholarRequest(2), query: { requirementPeriodId: '2' } }, read);
  assert.equal(read.statusCode, 200);
  assert.equal(read.body.requirementWave.academicPeriodId, 2);
  assert.equal(read.body.requirementWave.continuingOpen, true);
  for (const key of ['grades', 'registration_form']) {
    const file = read.body.requirementWave.continuing[key];
    assert.equal(file.fileName, `${key}.pdf`);
    assert.equal(file.status, 'Approved');
    assert.equal(file.reusedFromInitial, true);
    assert.equal(file.sourceAcademicPeriodId, 2);
    assert.equal(file.sourceSubmissionWave, 'initial');
    assert.equal(file.versionId, `synthetic-initial-${key}`);
    assert.equal(file.revision, 2);
  }
  assert.equal(read.body.requirementWave.continuing.report_card, undefined);
  const later = response();
  await getMyApplication({ ...scholarRequest(3), query: { requirementPeriodId: '3' } }, later);
  assert.equal(later.statusCode, 200);
  assert.equal(later.body.requirementWave.academicPeriodId, 3);
  assert.equal(later.body.requirementWave.continuing.grades, undefined);
  assert.equal(later.body.requirementWave.continuing.registration_form, undefined);
  assert.equal(later.body.requirementWave.initial.registration_form.fileName, 'registration_form.pdf');
  assert.deepEqual(state.applications[0].initial_docs, originalDocs);
  assert.equal(writes.length, 0);
});

test('admin continuing document rows point reused academic evidence to its exact initial scope and version', async () => {
  firstSemesterReuseScholar();
  const originalDocs = structuredClone(state.applications[0].initial_docs);
  const read = response();
  await getScholarManagement(adminRequest(2), read);
  assert.equal(read.statusCode, 200);
  const record = read.body.scholars[0];
  assert.equal(record.continuingOpen, true);
  for (const key of ['grades', 'registration_form']) {
    const file = record.continuingDocuments.find(row => row.requirementKey === key);
    assert.equal(file.submitted, true);
    assert.equal(file.status, 'Approved');
    assert.equal(file.academicPeriodId, 2);
    assert.equal(file.submissionWave, 'initial');
    assert.equal(file.versionId, `synthetic-initial-${key}`);
    assert.equal(file.revision, 2);
    assert.equal(file.reusedFromInitial, true);
  }
  assert.deepEqual(state.applications[0].initial_docs.requirementSets, originalDocs.requirementSets);
  assert.equal(state.applications[0].initial_docs.initialRequirementPeriodId, 2);
  assert.equal(state.applications[0].initial_docs.requirementSets['2:continuing'], undefined);
  assert.equal(writes.length, 0);
});

const postCurrentPasser = () => {
  const result = state.results.find(row => row.applicant_id === 5);
  prisma.passer_list_members.findMany = async () => [{
    applicant_id: 5, application_id: 105, result_id: result.id,
    snapshot: { resultUpdatedAt: result.updated_at.toISOString() },
  }];
};

test('posted passer uploads record the independent intake as the initial source', async () => {
  postCurrentPasser();
  const periods = structuredClone(state.periods);
  const res = response();
  await uploadScholarRequirementByAdmin(adminRequest(2), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.document.academicPeriodId, 2);
  assert.equal(res.body.document.status, 'Approved');
  const docs = state.applications[0].initial_docs;
  assert.equal(docs.initialRequirementPeriodId, 2);
  assert.equal(docs.requirementSets['2:initial'].requirements.grades.fileName, 'synthetic-grades.pdf');
  assert.equal(docs.requirementSets['1:initial'], undefined);
  assert.deepEqual(state.periods, periods);
  assert.deepEqual(writes, ['intake-lock', 'requirements']);
});

test('initial intake uploads remain inherited for later Scholar reads and continuing submissions', async () => {
  postCurrentPasser();
  for (const key of ['tax_exemption', 'valid_id', 'grades', 'report_card', 'registration_form']) {
    const req = adminRequest(2);
    req.params.requirementKey = key;
    req.body.fileName = `synthetic-${key}.pdf`;
    const res = response();
    await uploadScholarRequirementByAdmin(req, res);
    assert.equal(res.statusCode, 200);
  }
  const originalSet = structuredClone(state.applications[0].initial_docs.requirementSets['2:initial']);
  state.scholar = { id: 1, applicant_id: 5, scholar_id: 'SYN-CURRENT', is_active: true, result_id: 200 };
  state.periods.find(row => row.id === 3).is_active = true;
  const read = response();
  await getScholarManagement({ query: { academicPeriodId: 3 } }, read);
  assert.equal(read.statusCode, 200);
  assert.equal(read.body.scholars[0].continuingSubmission.initialApproved, true);
  const inherited = read.body.scholars[0].initialDocuments.find(file => file.requirementKey === 'tax_exemption');
  assert.equal(inherited.academicPeriodId, 2);
  assert.equal(inherited.fileName, 'synthetic-tax_exemption.pdf');
  const upload = response();
  await uploadMyRequirement(scholarRequest(3), upload);
  assert.equal(upload.statusCode, 200);
  const docs = state.applications[0].initial_docs;
  assert.equal(docs.initialRequirementPeriodId, 2);
  assert.deepEqual(docs.requirementSets['2:initial'], originalSet);
  assert.equal(docs.requirementSets['3:continuing'].requirements.grades.status, 'Pending');
  assert.equal(state.periods[0].is_primary, true);
});

test('later admin initial replacement preserves a valid original source and its files', async () => {
  acceptFutureScholar();
  state.periods.find(row => row.id === 3).is_active = true;
  const originals = structuredClone(state.applications[0].initial_docs.requirementSets['2:initial'].requirements);
  const res = response();
  await uploadScholarRequirementByAdmin(adminRequest(3), res);
  assert.equal(res.statusCode, 200);
  const docs = state.applications[0].initial_docs;
  assert.equal(docs.initialRequirementPeriodId, 2);
  Object.entries(originals).forEach(([key, file]) => {
    assert.equal(docs.requirementSets['2:initial'].requirements[key].fileName, file.fileName);
    assert.equal(docs.requirementSets['2:initial'].requirements[key].status, file.status);
  });
  assert.equal(docs.requirementSets['3:initial'].requirements.grades.status, 'Approved');
  assert.equal(state.periods[0].is_primary, true);
});

test('a changed intake rejects initial upload before saving source metadata', async () => {
  postCurrentPasser();
  const originalDocs = structuredClone(state.applications[0].initial_docs);
  beforeTransaction = () => { intakeId = 3; };
  const res = response();
  await uploadScholarRequirementByAdmin(adminRequest(2), res);
  assert.equal(res.statusCode, 409);
  assert.deepEqual(state.applications[0].initial_docs, originalDocs);
  assert.ok(writes.every(write => write === 'intake-lock'));
});

test('an existing wrong source is resolved for Scholar reads and normalized on continuing upload', async () => {
  acceptFutureScholar();
  state.applications[0].initial_docs.initialRequirementPeriodId = 1;
  state.periods.find(row => row.id === 3).is_active = true;
  const originalDocs = structuredClone(state.applications[0].initial_docs);
  const read = response();
  await getMyApplication({ user: { id: 5 }, query: { requirementPeriodId: 3 } }, read);
  assert.equal(read.statusCode, 200);
  assert.equal(read.body.requirementWave.academicPeriodId, 3);
  assert.equal(read.body.requirementWave.initial.tax_exemption.fileName, 'tax_exemption.pdf');
  assert.equal(read.body.requirementWave.submission.isOpen, true);
  assert.deepEqual(state.applications[0].initial_docs, originalDocs);
  assert.equal(writes.length, 0);
  const upload = response();
  await uploadMyRequirement(scholarRequest(3), upload);
  assert.equal(upload.statusCode, 200);
  const docs = state.applications[0].initial_docs;
  assert.equal(docs.initialRequirementPeriodId, 2);
  assert.equal(docs.requirementSets['2:initial'].requirements.tax_exemption.fileName, 'tax_exemption.pdf');
  assert.equal(docs.requirementSets['3:continuing'].requirements.grades.status, 'Pending');
});

test('historical Applicant portal uses the recorded initial source semester without rewriting data', async () => {
  intakeId = 3;
  state.periods.push({ ...period(5, '2027-2028'), semester: '2nd Semester' });
  state.applications[0].initial_docs = { initialRequirementPeriodId: 1, requirementSets: {
    '5:initial': { academicPeriodId: 5, wave: 'initial', requirements: {
      tax_exemption: { fileName: 'synthetic-original.pdf', status: 'Approved' },
    } },
  } };
  const originalDocs = structuredClone(state.applications[0].initial_docs);
  const res = response();
  await getMyApplication({ user: { id: 5 }, query: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.activePeriod.id, 5);
  assert.equal(res.body.activePeriod.semester, '2nd Semester');
  assert.equal(res.body.requirementWave.academicPeriodId, 5);
  assert.equal(res.body.requirementWave.initial.tax_exemption.fileName, 'synthetic-original.pdf');
  assert.equal(res.body.intakeScope.archived, true);
  assert.equal(res.body.examination.access.allowed, false);
  assert.deepEqual(state.applications[0].initial_docs, originalDocs);
  assert.equal(writes.length, 0);
});

test('first-year admin and portal projections require an approved report card and keep continuing COG required', async () => {
  acceptFutureScholar();
  state.periods.find(row => row.id === 2).is_active = true;
  for (const status of [null, 'Pending', 'Rejected']) {
    const initial = state.applications[0].initial_docs.requirementSets['2:initial'].requirements;
    if (status) initial.report_card = { fileName: 'synthetic-report.pdf', status };
    else delete initial.report_card;
    const read = response();
    await getScholarManagement({ query: { academicPeriodId: 2 } }, read);
    assert.equal(read.statusCode, 200);
    const record = read.body.scholars[0];
    assert.equal(record.continuingSubmission.initialApproved, false);
    assert.equal(record.continuingSubmission.isOpen, false);
    assert.equal(record.initialDocuments.find(item => item.requirementKey === 'report_card').optional, false);
    assert.equal(record.initialDocuments.find(item => item.requirementKey === 'grades').optional, true);
    assert.equal(record.initialDocuments.find(item => item.requirementKey === 'report_card').alternativeGroup, null);
    if (status) assert.equal(record.documents.find(item => item.requirementKey === 'report_card').status, status);
  }
  const request = adminRequest(2);
  request.params.requirementKey = 'report_card';
  request.body.fileName = 'synthetic-report.pdf';
  const saved = response();
  await uploadScholarRequirementByAdmin(request, saved);
  assert.equal(saved.statusCode, 200);
  const read = response();
  await getScholarManagement({ query: { academicPeriodId: 2 } }, read);
  assert.equal(read.body.scholars[0].continuingSubmission.initialApproved, true);
  assert.equal(read.body.scholars[0].continuingSubmission.isOpen, true);
  assert.equal(read.body.scholars[0].continuingDocuments.find(item => item.requirementKey === 'grades').optional, false);
});

test('a future-entry Scholar remains in the directory with processing and continuing access closed', async () => {
  acceptFutureScholar();
  const res = response();
  await getScholarManagement(adminRequest(), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.scholars.length, 1);
  const row = res.body.scholars[0];
  assert.equal(row.processingEligibility.eligible, false);
  assert.equal(row.processingEligibility.entrySchoolYear, '2027-2028');
  assert.equal(row.processingEligibility.schoolYear, '2026-2027');
  assert.equal(row.processEligible, false);
  assert.equal(row.billingEligible, false);
  assert.equal(row.canPreparePayroll, false);
  assert.ok(row.billingEligibilityReasons.some(reason => reason.code === 'SCHOLAR_ENTRY_YEAR'));
  assert.equal(row.continuingOpen, false);
  assert.equal(row.continuingSubmission.state, 'waiting_entry_year');
  assert.equal(row.initialDocuments.find(file => file.requirementKey === 'grades').fileName, 'grades.pdf');
  assert.equal(writes.length, 0);
});

test('future-entry Scholar portal preserves accepted result and original documents while waiting', async () => {
  acceptFutureScholar();
  const originalDocs = structuredClone(state.applications[0].initial_docs);
  const res = response();
  await getMyApplication(scholarRequest(), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.scholar.scholarId, 'SYN-FUTURE');
  assert.equal(res.body.examination.score, 18);
  assert.equal(res.body.examination.academicYear, '2027-2028');
  assert.equal(res.body.processingEligibility.eligible, false);
  assert.deepEqual(res.body.continuingPeriods, []);
  assert.equal(res.body.requirementWave.continuingOpen, false);
  assert.equal(res.body.requirementWave.submission.isOpen, false);
  assert.equal(res.body.requirementWave.submission.state, 'waiting_entry_year');
  assert.equal(res.body.requirementWave.initial.grades.fileName, 'grades.pdf');
  assert.equal(res.body.guidance.state, 'waiting');
  assert.match(res.body.guidance.headline, /2027-2028/);
  assert.deepEqual(res.body.guidance.actions, []);
  assert.deepEqual(state.applications[0].initial_docs, originalDocs);
  assert.equal(writes.length, 0);
});

test('Billing and Payroll reject pre-entry Scholars before generating list records', async () => {
  for (const [handler, type] of [[processPayrollSelection, 'public'], [processBillingSelection, 'private']]) {
    acceptFutureScholar(type);
    const res = response();
    await handler(adminRequest(), res);
    assert.equal(res.statusCode, 409);
    assert.ok(res.body.ineligible[0].reasons.some(reason => reason.code === 'SCHOLAR_ENTRY_YEAR'));
  }
  assert.equal(writes.length, 0);
});

test('list generation rereads the recorded entry year inside the transaction before writes', async () => {
  for (const [handler, type] of [[processPayrollSelection, 'public'], [processBillingSelection, 'private']]) {
    acceptFutureScholar(type);
    state.applicants[0].school_year = '2026-2027';
    beforeTransaction = () => { state.applicants[0].school_year = '2027-2028'; };
    const res = response();
    await handler(adminRequest(), res);
    assert.equal(res.statusCode, 409);
    assert.match(res.body.message, /enters in 2027-2028/);
  }
  assert.equal(writes.length, 0);
});

test('continuing, ordinary admin initial and open-continuing endpoints reject pre-entry writes', async () => {
  acceptFutureScholar();
  const originalDocs = structuredClone(state.applications[0].initial_docs);
  for (const [handler, req] of [[uploadMyRequirement, scholarRequest()], [uploadScholarRequirementByAdmin, adminRequest()], [openContinuingRequirements, adminRequest()]]) {
    const res = response();
    await handler(req, res);
    assert.equal(res.statusCode, 409);
    assert.match(res.body.message, /enters in 2027-2028/);
  }
  assert.deepEqual(state.applications[0].initial_docs, originalDocs);
  assert.equal(writes.length, 0);
});

test('future-entry Scholars cannot be assigned school or session metadata in an older processing period', async () => {
  acceptFutureScholar();
  for (const handler of [updateScholarBillingDetails, updateScholarBillingMetadata]) {
    const res = response();
    await handler(adminRequest(), res);
    assert.equal(res.statusCode, 409);
    assert.match(res.body.message, /enters in 2027-2028/);
  }
  assert.equal(writes.length, 0);
});

test('school and session metadata allow the recorded entry year without switching processing primary', async () => {
  for (const [entryYear, periodId] of [['2026-2027', 1], ['2027-2028', 2]]) {
    acceptFutureScholar();
    state.applicants[0].school_year = entryYear;
    state.periods.find(row => row.id === periodId).is_active = true;
    for (const handler of [updateScholarBillingDetails, updateScholarBillingMetadata]) {
      const res = response();
      await handler(adminRequest(periodId), res);
      assert.equal(res.statusCode, 200);
    }
    assert.equal(state.applicants[0].school_year, entryYear);
    assert.equal(state.periods[0].is_primary, true);
    assert.ok(state.requirements.some(row => row.billing_period_id === periodId && row.billing_school_year === entryYear));
  }
  assert.deepEqual(writes, Array(4).fill('period-metadata'));
});

test('requirement endpoints reread entry year before committing a document or opening', async () => {
  for (const [handler, req] of [[uploadMyRequirement, scholarRequest()], [uploadScholarRequirementByAdmin, adminRequest()], [openContinuingRequirements, adminRequest()]]) {
    acceptFutureScholar();
    state.applicants[0].school_year = '2026-2027';
    const originalDocs = structuredClone(state.applications[0].initial_docs);
    beforeTransaction = () => { state.applicants[0].school_year = '2027-2028'; };
    const res = response();
    await handler(req, res);
    assert.equal(res.statusCode, 409);
    assert.match(res.body.message, /enters in 2027-2028/);
    assert.deepEqual(state.applications[0].initial_docs, originalDocs);
  }
  assert.equal(writes.length, 0);
});

test('entry year and later active periods allow continuing submission while processing primary stays unchanged', async () => {
  acceptFutureScholar();
  for (const periodId of [2, 3]) {
    state.periods.find(row => row.id === periodId).is_active = true;
    const res = response();
    await uploadMyRequirement(scholarRequest(periodId), res);
    assert.equal(res.statusCode, 200);
    assert.equal(state.applications[0].initial_docs.requirementSets[`${periodId}:continuing`].requirements.grades.status, 'Pending');
  }
  assert.equal(state.periods[0].is_primary, true);
  assert.equal(state.applications[0].initial_docs.requirementSets['2:initial'].requirements.grades.status, 'Approved');
});

test('unknown legacy entry years retain processing access without guessing or backfilling', async () => {
  acceptFutureScholar();
  for (const recordedYear of [null, 'legacy intake']) {
    state.applicants[0].school_year = recordedYear;
    const res = response();
    await getMyApplication(scholarRequest(), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.processingEligibility.eligible, true);
    assert.deepEqual(res.body.continuingPeriods.map(row => row.id), [1]);
    assert.equal(state.applicants[0].school_year, recordedYear);
  }
  assert.equal(writes.length, 0);
});

test('the obsolete unscoped requirements endpoint returns Gone without reading or writing data', async () => {
  prisma.scholar = { findUnique: async () => { throw new Error('Legacy model must not be read'); }, update: async () => { throw new Error('Legacy model must not be written'); } };
  const res = response();
  await submitRequirements({ user: { id: 5, role: 'Scholar' }, params: { id: '5' }, body: { payoutComplianceDocs: ['synthetic'] } }, res);
  assert.equal(res.statusCode, 410);
  assert.match(res.body.message, /selected academic period/);
  assert.equal(writes.length, 0);
  delete prisma.scholar;
});
