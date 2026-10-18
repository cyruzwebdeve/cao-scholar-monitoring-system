import test from 'node:test';
import assert from 'node:assert/strict';
import { initialRequirementItemsFor, initialRequirementProgress } from '../src/utils/initialAcademicEvidence.js';
const academic = [{ key: 'grades', label: 'COG' }, { key: 'registration_form', label: 'Registration' }];
const status = file => file?.status === 'Approved' ? 'approved' : 'missing';
const complete = { tax_exemption: { status: 'Approved' }, valid_id: { status: 'Approved' }, registration_form: { status: 'Approved' } };

test('first-year report card is optional and either academic document counts once toward required progress', () => {
  const items = initialRequirementItemsFor(academic, '1st Year');
  assert.equal(items.length, 6);
  assert.equal(items.find(item => item.key === 'report_card').optional, true);
  assert.equal(items.find(item => item.key === 'grades').optional, true);
  for (const academicFiles of [{ grades: { status: 'Approved' } }, { report_card: { status: 'Approved' } }, { grades: { status: 'Approved' }, report_card: { status: 'Approved' } }]) {
    assert.deepEqual(initialRequirementProgress(items, { ...complete, ...academicFiles }, '1st Year', status), { total: 4, approved: 4 });
  }
  assert.deepEqual(initialRequirementProgress(items, complete, '1st Year', status), { total: 4, approved: 3 });
});
test('higher-year requirements preserve COG and only retain report-card rows when a file already exists', () => {
  const items = initialRequirementItemsFor(academic, '2nd Year');
  assert.equal(items.some(item => item.key === 'report_card'), false);
  const files = { ...complete, report_card: { fileName: 'fixture.pdf', status: 'Approved' } };
  const retained = initialRequirementItemsFor(academic, '2nd Year', files);
  assert.equal(retained.find(item => item.key === 'report_card').optional, true);
  assert.deepEqual(initialRequirementProgress(retained, files, '2nd Year', status), { total: 4, approved: 3 });
});
test('private first-year progress still includes tuition receipt', () => {
  const items = initialRequirementItemsFor([...academic, { key: 'tuition_receipt', label: 'Receipt' }], '1st Year');
  assert.deepEqual(initialRequirementProgress(items, { ...complete, report_card: { status: 'Approved' } }, '1st Year', status), { total: 5, approved: 4 });
});
