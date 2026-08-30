const assert = require('node:assert/strict');
const test = require('node:test');

const {
  POLICY,
  evaluateEligibility,
  scoreAcademicStanding,
  scoreFinancialNeed,
} = require('../services/eligibilityRecommendation');

const application = (overrides = {}) => ({
  id: 41,
  family: { familyIncome: 'Below ₱50,000', gwa: '92', ...(overrides.family || {}) },
  eligibility: { graduatedHonors: 'Yes', pwd: 'Yes', ...(overrides.eligibility || {}) },
});

const result = (overrides = {}) => ({
  id: 73,
  score: 18,
  passing_score: 14,
  passed: true,
  ...overrides,
});

test('scores configured income bands and both supported GWA formats deterministically', () => {
  assert.equal(scoreFinancialNeed('Below ₱50,000'), 35);
  assert.equal(scoreFinancialNeed('₱100,001 - ₱150,000'), 24);
  assert.equal(scoreAcademicStanding('92'), 22);
  assert.equal(scoreAcademicStanding('1.50'), 22);
});

test('recommends a complete passing record while preserving human authority', () => {
  const assessment = evaluateEligibility({
    application: application(),
    result: result(),
    generatedAt: new Date('2026-08-30T08:00:00Z'),
  });

  assert.equal(assessment.policyVersion, POLICY.version);
  assert.equal(assessment.recommendation, 'MEETS_CONFIGURED_CRITERIA');
  assert.equal(assessment.totalScore, 88);
  assert.equal(assessment.maxScore, 100);
  assert.equal(assessment.requiresHumanDecision, true);
  assert.equal(assessment.requiresOverrideReason, false);
  assert.equal(assessment.generatedAt, '2026-08-30T08:00:00.000Z');
});

test('a failed examination remains a hard recommendation blocker', () => {
  const assessment = evaluateEligibility({
    application: application(),
    result: result({ score: 12, passed: false }),
  });

  assert.equal(assessment.recommendation, 'DOES_NOT_MEET_CRITERIA');
  assert.equal(assessment.requiresOverrideReason, true);
  assert.match(assessment.summary, /examination result/i);
});

test('missing or unrecognized decision inputs are routed to human review', () => {
  const assessment = evaluateEligibility({
    application: application({ family: { familyIncome: 'Unverified', gwa: '' } }),
    result: null,
  });

  assert.equal(assessment.recommendation, 'REVIEW_REQUIRED');
  assert.equal(assessment.totalScore, null);
  assert.deepEqual(assessment.missingInputs, ['annual family income', 'GWA', 'verified examination result']);
});

test('the persisted input snapshot contains only fields used by the rules', () => {
  const assessment = evaluateEligibility({ application: application(), result: result() });

  assert.deepEqual(Object.keys(assessment.inputSnapshot).sort(), [
    'applicationId',
    'examPassed',
    'examScore',
    'familyIncome',
    'gwa',
    'passingScore',
    'priorityQualifications',
    'resultId',
  ].sort());
  assert.equal(Object.hasOwn(assessment.inputSnapshot, 'email'), false);
  assert.equal(Object.hasOwn(assessment.inputSnapshot, 'name'), false);
});
