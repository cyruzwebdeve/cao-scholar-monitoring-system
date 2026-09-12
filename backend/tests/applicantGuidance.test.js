const assert = require('node:assert/strict');
const test = require('node:test');

const { ONLINE_REQUIREMENTS } = require('../services/lifecycleIntegrity');
const { buildApplicantGuidance } = require('../services/applicantGuidance');

const application = (requirements = {}) => ({
  id: 10,
  submitted_at: new Date('2026-08-20T08:00:00Z'),
  initial_docs: { requirements },
});

const approvedDocuments = () => Object.fromEntries(
  ONLINE_REQUIREMENTS.map(({ key }) => [key, { fileName: `${key}.pdf`, status: 'Approved' }]),
);

test('scheduled applicants receive a specific examination action and transparent timeline', () => {
  const guidance = buildApplicantGuidance({
    application: application(),
    scheduledExam: { is_active: true, venue: 'Provincial Capitol Auditorium' },
    examinationSettings: { isEnabled: true, deliveryMode: 'online' },
    examSlot: { appeared: true },
  });

  assert.equal(guidance.state, 'action_required');
  assert.equal(guidance.actions[0].id, 'complete-examination');
  assert.equal(guidance.actions[0].route, 'examination');
  assert.equal(guidance.actions[0].title, 'Start your online examination');
  assert.equal(guidance.timeline.find(({ id }) => id === 'examination').status, 'current');
  assert.equal(guidance.timeline.find(({ id }) => id === 'decision').status, 'upcoming');
});

test('online examination guidance waits for CAO attendance confirmation', () => {
  const guidance = buildApplicantGuidance({
    application: application(),
    scheduledExam: { is_active: true, venue: 'Provincial Capitol Auditorium' },
    examinationSettings: { isEnabled: true, deliveryMode: 'online' },
    examSlot: { appeared: false },
  });

  assert.equal(guidance.actions[0].title, 'Wait for attendance confirmation');
  assert.equal(guidance.actions[0].route, null);
  assert.match(guidance.actions[0].description, /marks you Present/i);
});

test('globally disabled examination access keeps an active municipality schedule pending', () => {
  const guidance = buildApplicantGuidance({
    application: application(),
    scheduledExam: { is_active: true, venue: 'Provincial Capitol Auditorium' },
    examinationSettings: { isEnabled: false, deliveryMode: 'online' },
  });

  assert.equal(guidance.state, 'waiting');
  assert.equal(guidance.actions[0].id, 'wait-exam-schedule');
  assert.match(guidance.timeline.find(({ id }) => id === 'examination').detail, /not published/i);
});

test('examined applicants are told to wait without exposing an unreleased result', () => {
  const guidance = buildApplicantGuidance({
    application: application(),
    result: { passed: true, created_at: new Date('2026-08-21T08:00:00Z') },
  });

  assert.equal(guidance.state, 'waiting');
  assert.equal(guidance.actions[0].id, 'wait-official-decision');
  assert.doesNotMatch(JSON.stringify(guidance), /passed/i);
});

test('verified priority scholars show a completed examination-bypass stage', () => {
  const guidance = buildApplicantGuidance({
    application: application(),
    scholar: { is_active: true, issued_at: new Date('2026-08-22T08:00:00Z'), notes: 'Automatically accepted after verified proof: Person with Disability (PWD).' },
    scholarRequirement: {},
  });

  const examinationStage = guidance.timeline.find(({ id }) => id === 'examination');
  assert.equal(examinationStage.status, 'completed');
  assert.match(examinationStage.detail, /bypassed/i);
});

test('active scholars receive only applicable online requirement actions', () => {
  const documents = approvedDocuments();
  documents.grades.status = 'Rejected';
  delete documents.valid_id;
  const guidance = buildApplicantGuidance({
    application: application(documents),
    result: { created_at: new Date('2026-08-21T08:00:00Z') },
    scholar: { is_active: true, issued_at: new Date('2026-08-22T08:00:00Z') },
    scholarRequirement: { folder_physical_submitted: false },
  });

  assert.equal(guidance.state, 'action_required');
  assert.deepEqual(
    guidance.actions.map(({ id }) => id),
    ['replace-rejected-requirements', 'upload-missing-requirements'],
  );
  assert.equal(guidance.timeline.find(({ id }) => id === 'requirements').status, 'current');
});

test('pending documents produce a waiting state when the applicant has nothing to replace', () => {
  const documents = approvedDocuments();
  documents.grades.status = 'Pending';
  const guidance = buildApplicantGuidance({
    application: application(documents),
    result: { created_at: new Date('2026-08-21T08:00:00Z') },
    scholar: { is_active: true, issued_at: new Date('2026-08-22T08:00:00Z') },
    scholarRequirement: { folder_physical_submitted: true },
  });

  assert.equal(guidance.state, 'waiting');
  assert.equal(guidance.actions[0].id, 'wait-document-review');
});

test('inclusion in a generated payroll list completes the in-scope lifecycle', () => {
  const guidance = buildApplicantGuidance({
    application: application(approvedDocuments()),
    result: { created_at: new Date('2026-08-21T08:00:00Z') },
    scholar: { is_active: true, issued_at: new Date('2026-08-22T08:00:00Z') },
    scholarRequirement: { folder_physical_submitted: true, updated_at: new Date('2026-08-23T08:00:00Z') },
    payrollClaim: { claim_status: 'pending', created_at: new Date('2026-08-24T08:00:00Z') },
  });

  assert.equal(guidance.state, 'complete');
  assert.equal(guidance.actions[0].id, 'payroll-list-generated');
  assert.equal(guidance.timeline.at(-1).id, 'payroll_list');
  assert.ok(guidance.timeline.every(({ status }) => status === 'completed'));
  assert.doesNotMatch(JSON.stringify(guidance), /allowance release|marked as paid|claimed/i);
});
