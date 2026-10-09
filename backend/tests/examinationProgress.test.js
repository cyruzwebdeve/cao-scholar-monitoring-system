const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveExaminationProgress } = require('../services/examinationProgress');
const { buildApplicantGuidance } = require('../services/applicantGuidance');

test('Present is For review in both audiences, not completion or a passing result', () => {
  for (const applicantFacing of [true, false]) {
    const progress = resolveExaminationProgress({ examSlot: { appeared: true }, fallbackStatus: 'Applied', applicantFacing });
    assert.equal(progress.status, 'For review');
    assert.equal(progress.resultStatus, 'For review');
    assert.equal(progress.attendanceStatus, 'Present');
    assert.equal(progress.completed, false);
    assert.equal(progress.isScholar, false);
  }
});

test('existing results and decisions take precedence over attendance', () => {
  const examSlot = { appeared: true };
  for (const passed of [true, false]) {
    assert.equal(resolveExaminationProgress({ examSlot, result: { passed } }).resultStatus, passed ? 'Passed' : 'Failed');
    assert.equal(resolveExaminationProgress({ examSlot, result: { passed }, applicantFacing: true }).status, 'Waiting for results');
  }
  assert.equal(resolveExaminationProgress({ examSlot, scholar: { is_active: true } }).status, 'Accepted as scholar');
  for (const fallbackStatus of ['Rejected', 'Withdrawn', 'Passed_Exam']) {
    assert.equal(resolveExaminationProgress({ examSlot, fallbackStatus }).status, fallbackStatus);
    assert.equal(resolveExaminationProgress({ examSlot, fallbackStatus: 'pending', applicationStatus: fallbackStatus }).status, fallbackStatus);
  }
});

test('correcting attendance back to Pending removes only attendance-derived review', () => {
  assert.equal(resolveExaminationProgress({ examSlot: { appeared: false }, fallbackStatus: 'Applied' }).status, 'Applied');
  assert.equal(resolveExaminationProgress({ examSlot: { appeared: false }, result: { passed: true } }).status, 'Passed');
});

test('paper and online guidance preserve the remaining examination action', () => {
  for (const deliveryMode of ['paper', 'online']) {
    const guidance = buildApplicantGuidance({ application: { status: 'Applied' }, examSlot: { appeared: true }, examinationSettings: { isEnabled: true, deliveryMode }, scheduledExam: { is_active: true } });
    assert.equal(guidance.headline, 'Your application is For review');
    assert.equal(guidance.timeline.find(({ id }) => id === 'examination').status, 'current');
    assert.equal(guidance.timeline.find(({ id }) => id === 'decision').status, 'upcoming');
    assert.equal(guidance.actions[0].route, deliveryMode === 'online' ? 'examination' : null);
    assert.match(guidance.actions[0].description, /complete/i);
  }
});
