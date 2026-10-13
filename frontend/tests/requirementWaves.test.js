import assert from 'node:assert/strict';
import test from 'node:test';
import { requirementScope, requirementScopeQuery } from '../src/utils/requirementWaves.js';

test('preview and review target the exact academic period, submission wave, and file revision', () => {
  const initial = { academicPeriodId: 10, submissionWave: 'initial', versionId: 'original-file', revision: 2 };
  const continuing = { academicPeriodId: 10, submissionWave: 'continuing', versionId: 'continuing-file', revision: 1 };
  assert.deepEqual(requirementScope(initial), initial);
  assert.notEqual(requirementScopeQuery(initial), requirementScopeQuery(continuing));
  const query = new URLSearchParams(requirementScopeQuery(continuing).slice(1));
  assert.equal(query.get('academicPeriodId'), '10');
  assert.equal(query.get('submissionWave'), 'continuing');
  assert.equal(query.get('versionId'), 'continuing-file');
});
test('unscoped eligibility proofs retain their existing request shape', () => {
  assert.deepEqual(requirementScope({ requirementKey: 'priority_pwd' }), {});
  assert.equal(requirementScopeQuery({ requirementKey: 'priority_pwd' }), '');
});
