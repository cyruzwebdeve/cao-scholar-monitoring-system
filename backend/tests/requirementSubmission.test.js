const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveRequirementSubmission } = require('../services/requirementSubmission');

test('semester requirement uploads remain open when no deadline is configured', () => {
  const result = resolveRequirementSubmission({}, new Date('2026-09-13T00:00:00.000Z'));
  assert.equal(result.isOpen, true);
  assert.equal(result.state, 'unscheduled');
  assert.equal(result.deadline, null);
});

test('semester requirement uploads stay open through the configured deadline', () => {
  const period = { requirements_deadline: new Date('2026-09-30T15:59:00.000Z') };
  assert.equal(resolveRequirementSubmission(period, new Date('2026-09-30T15:58:59.000Z')).isOpen, true);
  assert.equal(resolveRequirementSubmission(period, new Date('2026-09-30T15:59:00.000Z')).isOpen, true);
});

test('semester requirement uploads close after the configured deadline', () => {
  const result = resolveRequirementSubmission(
    { requirements_deadline: new Date('2026-09-30T15:59:00.000Z') },
    new Date('2026-09-30T15:59:00.001Z'),
  );
  assert.equal(result.isOpen, false);
  assert.equal(result.state, 'closed');
});
