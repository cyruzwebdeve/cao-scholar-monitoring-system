const assert = require('node:assert/strict');
const test = require('node:test');

const {
  ONLINE_REQUIREMENTS,
  evaluateBillingEligibility,
  getRequirementSnapshot,
  isPayableClaim,
} = require('../services/lifecycleIntegrity');

const approvedDocuments = () => ({
  requirements: Object.fromEntries(ONLINE_REQUIREMENTS.map(({ key }) => [key, { fileName: `${key}.pdf`, status: 'Approved' }])),
});

test('[SUCCESS] an active scholar with six approved files and a physical folder is billable', () => {
  const result = evaluateBillingEligibility({
    isActive: true,
    alreadyBilled: false,
    initialDocs: approvedDocuments(),
    requirement: { folder_physical_submitted: true },
  });
  assert.equal(result.eligible, true);
  assert.equal(result.snapshot.onlineApproved, 6);
});

test('[FAILED] pending or missing Moderator decisions block billing', () => {
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

test('[FAILED] an unreceived physical folder blocks billing', () => {
  const result = evaluateBillingEligibility({
    isActive: true,
    alreadyBilled: false,
    initialDocs: approvedDocuments(),
    requirement: { folder_physical_submitted: false },
  });
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.some(({ code }) => code === 'PHYSICAL_FOLDER_MISSING'));
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
