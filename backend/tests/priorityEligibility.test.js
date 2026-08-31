const assert = require('node:assert/strict');
const test = require('node:test');
const { PRIORITY_PROOFS, isDeclaredPriorityProof, selectedPriorityCriteria } = require('../services/priorityEligibility');

test('maps every declared priority criterion to a criterion-specific proof key', () => {
  const selected = selectedPriorityCriteria({ pwd: 'Yes', alsPasser: 'Yes', soloParent: 'No' });
  assert.deepEqual(selected.map(({ proofKey }) => proofKey), ['priority_als_passer', 'priority_pwd']);
});

test('a proof can qualify for review only when its matching criterion was declared', () => {
  assert.equal(isDeclaredPriorityProof({ eligibility: { pwd: 'Yes' }, proofKey: 'priority_pwd' }), true);
  assert.equal(isDeclaredPriorityProof({ eligibility: { pwd: 'No' }, proofKey: 'priority_pwd' }), false);
  assert.equal(isDeclaredPriorityProof({ eligibility: { pwd: 'Yes' }, proofKey: 'priority_unknown' }), false);
  assert.equal(PRIORITY_PROOFS.priority_pwd.bulkApprovable, false);
});
