const assert = require('node:assert/strict');
const test = require('node:test');

const {
  ONLINE_REQUIREMENTS,
  evaluateBillingEligibility,
  evaluateListEligibility,
  getSchoolProcessRoute,
  getRequirementSnapshot,
  isPayableClaim,
} = require('../services/lifecycleIntegrity');

test('[SUCCESS] school classification selects its applicable requirement set', () => {
  assert.equal(getSchoolProcessRoute('Private'), 'billing');
  assert.equal(getSchoolProcessRoute(' private '), 'billing');
  assert.equal(getSchoolProcessRoute('Public'), 'payroll');
  assert.equal(getSchoolProcessRoute(undefined), 'payroll');
});

test('[SUCCESS] public-school payroll readiness does not require a private tuition receipt', () => {
  const documents = approvedDocuments();
  delete documents.requirements.tuition_receipt;
  const result = evaluateBillingEligibility({
    isActive: true,
    alreadyBilled: false,
    initialDocs: documents,
    requirement: { folder_physical_submitted: true },
    schoolType: 'Public',
  });

  assert.equal(result.eligible, true);
  assert.equal(result.snapshot.onlineTotal, 4);
});

const approvedDocuments = () => ({
  requirements: Object.fromEntries(ONLINE_REQUIREMENTS.map(({ key }) => [key, { fileName: `${key}.pdf`, status: 'Approved' }])),
});

test('[SUCCESS] an active scholar with all applicable online files is billable', () => {
  const result = evaluateBillingEligibility({
    isActive: true,
    alreadyBilled: false,
    initialDocs: approvedDocuments(),
    requirement: { folder_physical_submitted: true },
    schoolType: 'Private',
  });
  assert.equal(result.eligible, true);
  assert.equal(result.snapshot.onlineApproved, 5);
});

test('[FAILED] pending or missing Billing staff decisions block billing', () => {
  const documents = approvedDocuments();
  documents.requirements.grades.status = 'Pending';
  delete documents.requirements.valid_id;
  const result = evaluateBillingEligibility({
    isActive: true,
    alreadyBilled: false,
    initialDocs: documents,
    requirement: { folder_physical_submitted: true },
  });
  assert.equal(result.eligible, false);
  assert.deepEqual(new Set(result.reasons.map(({ code }) => code)), new Set(['REQUIREMENT_NOT_APPROVED', 'REQUIREMENT_MISSING']));
});

test('[SUCCESS] legacy physical-folder state no longer affects billing eligibility', () => {
  const result = evaluateBillingEligibility({
    isActive: true,
    alreadyBilled: false,
    initialDocs: approvedDocuments(),
    requirement: { folder_physical_submitted: false },
  });
  assert.equal(result.eligible, true);
  assert.equal(result.reasons.some(({ code }) => code === 'PHYSICAL_FOLDER_MISSING'), false);
});

test('[FAILED] an inactive or previously billed scholar cannot re-enter billing', () => {
  const result = evaluateBillingEligibility({
    isActive: false,
    alreadyBilled: true,
    initialDocs: approvedDocuments(),
    requirement: { folder_physical_submitted: true },
  });
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.some(({ code }) => code === 'SCHOLAR_INACTIVE'));
  assert.ok(result.reasons.some(({ code }) => code === 'ALREADY_BILLED'));
});

test('[SUCCESS] legacy requirement columns remain compatible with the clean eligibility rule', () => {
  const requirement = { folder_physical_submitted: true };
  ONLINE_REQUIREMENTS.forEach(({ fileField, statusField }) => {
    requirement[fileField] = 'legacy-file.pdf';
    requirement[statusField] = 'approved';
  });
  const snapshot = getRequirementSnapshot({ initialDocs: {}, requirement });
  assert.equal(snapshot.onlineApproved, snapshot.onlineTotal);
});

test('[FAILED] only a pending billed claim can enter payroll', () => {
  assert.equal(isPayableClaim({ claim_status: 'pending', claimed_date: null }), true);
  assert.equal(isPayableClaim({ claim_status: 'paid', claimed_date: new Date() }), false);
  assert.equal(isPayableClaim(null), false);
});

test('list generation treats missing and unapproved documents as warnings without approving them', () => {
  for (const schoolType of ['Private', 'Public']) {
    const documents = approvedDocuments();
    delete documents.requirements.valid_id;
    documents.requirements.grades.status = 'Pending';
    const result = evaluateListEligibility({ isActive: true, schoolType, initialDocs: documents, requireSchoolClassification: true });
    assert.equal(result.eligible, true);
    assert.deepEqual(result.reasons, []);
    assert.deepEqual(result.warnings.map(({ code }) => code), ['REQUIREMENT_MISSING', 'REQUIREMENT_NOT_APPROVED']);
    assert.equal(documents.requirements.grades.status, 'Pending');
  }
});

test('list generation retains hard blockers even when every document is missing', () => {
  const result = evaluateListEligibility({ isActive: false, alreadyProcessedForPeriod: true, schoolType: 'Unknown', requireSchoolClassification: true });
  assert.equal(result.eligible, false);
  assert.deepEqual(result.reasons.map(({ code }) => code), ['SCHOOL_CLASSIFICATION_MISSING', 'SCHOLAR_INACTIVE', 'ALREADY_PROCESSED_FOR_PERIOD']);
  assert.equal(result.warnings.length, 4);
});

test('a missing classification never invents a Private tuition requirement and blocks list generation', () => {
  const documents = approvedDocuments();
  delete documents.requirements.tuition_receipt;
  for (const schoolType of [undefined, null, '', 'unknown']) {
    const result = evaluateBillingEligibility({ isActive: true, initialDocs: documents, schoolType, requireSchoolClassification: true });
    assert.equal(result.eligible, false);
    assert.equal(result.snapshot.onlineTotal, 4);
    assert.deepEqual(result.reasons.map(({ code }) => code), ['SCHOOL_CLASSIFICATION_MISSING']);
    assert.equal(evaluateListEligibility({ isActive: true, initialDocs: documents, schoolType, requireSchoolClassification: true }).eligible, false);
  }
});

test('explicit Private classification still requires an approved tuition receipt', () => {
  const documents = approvedDocuments();
  delete documents.requirements.tuition_receipt;
  const result = evaluateBillingEligibility({ isActive: true, initialDocs: documents, schoolType: 'Private', requireSchoolClassification: true });
  assert.equal(result.snapshot.onlineTotal, 5);
  assert.deepEqual(result.reasons.map(({ requirement }) => requirement), ['tuition_receipt']);
});

test('strict Public list eligibility uses four required documents plus optional Indigency', () => {
  const documents = approvedDocuments();
  delete documents.requirements.tuition_receipt;
  const result = evaluateBillingEligibility({ isActive: true, initialDocs: documents, schoolType: ' PUBLIC ', requireSchoolClassification: true });
  assert.equal(result.eligible, true);
  assert.equal(result.snapshot.onlineTotal, 4);
});

test('already processed records are blocked by the shared eligibility check', () => {
  const result = evaluateBillingEligibility({ isActive: true, initialDocs: approvedDocuments(), schoolType: 'Public', alreadyProcessedForPeriod: true, requireSchoolClassification: true });
  assert.deepEqual(result.reasons.map(({ code }) => code), ['ALREADY_PROCESSED_FOR_PERIOD']);
});
