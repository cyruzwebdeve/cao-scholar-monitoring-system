import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { certificationDocumentContent } from '../src/utils/certificationDocumentContent.js';

const options = {
  records: [{ name: 'SYNTHETIC SCHOLAR', school: 'SYNTHETIC SCHOOL' }],
  activePeriod: { schoolYear: '2027-2028', semester: '1st Semester' },
  batch: { batchNumber: 'PAY-TEST' },
  issuedAt: '2026-10-18T17:00:00Z',
};

test('Payroll Word queue export is a non-saving preparation document without an invented reference', () => {
  const content = certificationDocumentContent({ ...options, mode: 'payroll', preparationCopy: true, batch: undefined });
  assert.equal(content.title, 'PAYROLL PREPARATION');
  assert.equal(content.referenceText, 'Payroll reference: Not assigned');
  assert.match(content.introduction(), /does not generate an official payroll list/);
  assert.doesNotMatch(content.introduction(), /This is to certify|included in the payroll list/);
  assert.match(content.issuedText, /19 October 2026/);
  assert.match(content.issuedText, /Generate payroll list/);
  assert.equal(content.filename, 'payroll-preparation-2026-10-19.docx');
  const suppliedReference = certificationDocumentContent({ ...options, mode: 'payroll', preparationCopy: true });
  assert.equal(suppliedReference.referenceText, 'Payroll reference: Not assigned');
});

test('existing saved Billing and Payroll Word content retains its reference and certification wording', () => {
  for (const mode of ['billing', 'payroll']) {
    const content = certificationDocumentContent({ ...options, mode });
    assert.equal(content.title, 'CERTIFICATION');
    assert.match(content.referenceText, /PAY-TEST/);
    assert.match(content.introduction('SYNTHETIC SCHOOL'), /This is to certify/);
    assert.match(content.issuedText, /Issued on 19 October 2026/);
    assert.equal(content.filename, 'PAY-TEST.docx');
    if (mode === 'billing') assert.match(content.introduction('SYNTHETIC SCHOOL'), /at SYNTHETIC SCHOOL/);
    else assert.match(content.introduction(), /in their respective schools/);
  }
});

test('document content rejects missing saved identity, empty records and invalid periods/dates/modes', () => {
  assert.throws(() => certificationDocumentContent({ ...options, batch: undefined }), /saved list reference/);
  assert.throws(() => certificationDocumentContent({ ...options, records: [] }), /scholar list/);
  assert.throws(() => certificationDocumentContent({ ...options, activePeriod: {} }), /academic period/);
  assert.throws(() => certificationDocumentContent({ ...options, issuedAt: 'bad-date' }), /date is invalid/);
  assert.throws(() => certificationDocumentContent({ ...options, mode: 'other' }), /Invalid list type/);
  assert.throws(() => certificationDocumentContent({ ...options, mode: 'billing', preparationCopy: true }), /Payroll only/);
});

test('Payroll generation and history use official Excel while queue export uses Word and Billing remains unchanged', async () => {
  const source = await readFile(new URL('../src/BillingPayrollManagement.jsx', import.meta.url), 'utf8');
  const process = source.slice(source.indexOf('const processQueue'), source.indexOf('const exportQueueDocument'));
  assert.match(process, /const download = isPayroll \? downloadPayrollWorkbook : downloadBillingCertificationDocument/);
  assert.match(process, /records: downloadRecords, batch: body\.batch, activePeriod: body\.activePeriod/);
  assert.ok(process.indexOf('if (!response.ok)') < process.indexOf('await download('));
  assert.doesNotMatch(process, /preparationCopy: true/);
  assert.match(process, /Excel.*Word.*download failed/);
  const queue = source.slice(source.indexOf('const exportQueueDocument'), source.indexOf('const downloadHistoricalCertification'));
  assert.match(queue, /const download = isPayroll \? downloadBillingCertificationDocument : downloadBillingWorkbook/);
  assert.match(queue, /preparationCopy: true/);
  assert.doesNotMatch(queue, /fetch\(/);
  const history = source.slice(source.indexOf('const downloadHistoricalCertification'), source.indexOf('  return <>'));
  assert.match(history, /const download = isPayroll \? downloadPayrollWorkbook : downloadBillingCertificationDocument/);
  assert.match(history, /batchNumber: batch\.reference/);
  assert.match(source, /isPayroll \? 'Export Word' : 'Export Excel'/);
  assert.match(source, /!isPayroll && exportOpen/);
});
