import test from 'node:test';
import assert from 'node:assert/strict';
import { getApplicantExaminationSummary } from '../src/utils/applicantExamination.js';

test('paper attendance, score review and published outcome stay separate from acceptance', () => {
  assert.equal(getApplicantExaminationSummary({ schedule: { date: '2026-10-11' } }).title, 'Scheduled');
  const present = { deliveryMode: 'paper', attendance: { status: 'Present' } };
  assert.equal(getApplicantExaminationSummary(present).title, 'For review');
  assert.match(getApplicantExaminationSummary(present).description, /Await CAO recording/);
  assert.equal(getApplicantExaminationSummary({ ...present, completed: true }).title, 'Result under review');
  assert.match(getApplicantExaminationSummary({ ...present, completed: true }).description, /paper examination score/);
  assert.match(getApplicantExaminationSummary({ published: true, status: 'Passed' }).description, /subject to CAO review/);
  assert.match(getApplicantExaminationSummary({ published: true, status: 'Did not pass' }).description, /not a final application rejection/);
  assert.equal(getApplicantExaminationSummary({ published: true, isScholar: true }).title, 'Accepted as scholar');
  assert.equal(getApplicantExaminationSummary({ status: 'Withdrawn', attendance: { status: 'Present' } }).title, 'Withdrawn');
});

test('online attendance still instructs the applicant to submit their own examination', () => {
  const summary = getApplicantExaminationSummary({ deliveryMode: 'online', attendance: { status: 'Present' } });
  assert.match(summary.description, /Complete the online examination/);
  assert.match(getApplicantExaminationSummary({ deliveryMode: 'online', completed: true }).description, /submission was recorded/);
});
