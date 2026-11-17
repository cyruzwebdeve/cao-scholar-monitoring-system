const test = require('node:test');
const assert = require('node:assert/strict');
const { isFirstYearEntry } = require('../services/initialAcademicEvidence');
const { initialApproved, evaluateContinuingSchedule } = require('../services/continuingSchedule');
const { initialChecklist } = require('../services/passerIntake');
const docs = (academic = 'report_card') => ({ requirements: Object.fromEntries(['tax_exemption', 'valid_id', 'registration_form', academic].map(key => [key, { fileName: 'fixture.pdf', status: 'Approved' }])) });

test('only explicit incoming/first-year entry levels require the Grade 12 report card', () => {
  for (const year of ['1st Year', ' First Year ', 'incoming 1st year college']) assert.equal(isFirstYearEntry(year), true);
  for (const year of [null, '', '2nd Year', '4th Year', 'unknown']) assert.equal(isFirstYearEntry(year), false);
});
test('first-year initial approval requires an approved report card even when COG is approved', () => {
  assert.equal(initialApproved(docs('grades'), 10, 'public', 10, '1st Year'), false);
  assert.equal(initialApproved(docs(), 10, 'public', 10, '1st Year'), true);
  const pending = docs(); pending.requirements.grades = { fileName: 'cog.pdf', status: 'Approved' }; pending.requirements.report_card.status = 'Pending';
  assert.equal(initialApproved(pending, 10, 'public', 10, '1st Year'), false);
  pending.requirements.report_card.status = 'Rejected';
  assert.equal(initialApproved(pending, 10, 'public', 10, '1st Year'), false);
  delete pending.requirements.report_card;
  assert.equal(initialApproved(pending, 10, 'public', 10, '1st Year'), false);
});
test('report card never waives higher-year grades, unknown entry year, or private tuition receipt', () => {
  for (const year of [null, '2nd Year']) assert.equal(initialApproved(docs(), 10, 'public', 10, year), false);
  assert.equal(initialApproved(docs(), 10, 'private', 10, '1st Year'), false);
  const privateDocs = docs(); privateDocs.requirements.tuition_receipt = { fileName: 'receipt.pdf', status: 'Approved' };
  assert.equal(initialApproved(privateDocs, 10, 'private', 10, '1st Year'), true);
  assert.equal(initialApproved(docs('grades'), 10, 'public', 10, '2nd Year'), true);
});
test('first-year checklist requires report card and keeps COG optional while retaining historical higher-year reports', () => {
  const rows = initialChecklist({}, 10, 'public', 10, 1, '1st Year');
  assert.equal(rows.find(item => item.requirementKey === 'grades').optional, true);
  assert.equal(rows.find(item => item.requirementKey === 'report_card').optional, false);
  assert.ok(rows.every(row => row.alternativeGroup === null));
  assert.equal(initialChecklist({}, 10, 'public', 10, 1, '2nd Year').some(row => row.requirementKey === 'report_card'), false);
  const retained = initialChecklist(docs(), 10, 'public', 10, 1, '2nd Year');
  assert.equal(retained.find(row => row.requirementKey === 'report_card').optional, true);
  assert.equal(retained.find(row => row.requirementKey === 'grades').optional, false);
});
test('continuing access recognizes first-year report approval without changing stored academic files', () => {
  const files = docs();
  const before = structuredClone(files);
  assert.equal(evaluateContinuingSchedule({ period: { id: 10 }, docs: files, schoolType: 'public', entryYearLevel: '1st Year' }).isOpen, true);
  assert.equal(files.requirements.grades, undefined);
  assert.equal(evaluateContinuingSchedule({ period: { id: 10 }, docs: files, schoolType: 'public', entryYearLevel: '2nd Year' }).isOpen, false);
  assert.equal(evaluateContinuingSchedule({ period: { id: 10 }, docs: docs('grades'), schoolType: 'public', entryYearLevel: '1st Year' }).state, 'waiting_initial');
  assert.deepEqual(files, before);
});
