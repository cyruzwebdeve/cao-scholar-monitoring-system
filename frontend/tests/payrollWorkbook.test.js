import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import { buildPayrollWorkbook, payrollTemplateColumns as columns } from '../src/utils/payrollWorkbook.js';

const records = [
  { name: 'SYNTHETIC PUBLIC', school: 'SYNTHETIC PUBLIC SCHOOL', schoolType: 'Public', claimAmount: 3000, tuitionFeeAssistance: null, allowance: null },
  { name: 'SYNTHETIC PRIVATE', school: 'SYNTHETIC PRIVATE SCHOOL', schoolType: 'Private', claimAmount: 5000, tuitionFeeAssistance: 3500, allowance: 1500 },
  { name: 'SYNTHETIC ZERO TUITION', school: 'SYNTHETIC PRIVATE SCHOOL', schoolType: 'Private', claimAmount: 5000, tuitionFeeAssistance: 0, allowance: 5000 },
];
const options = { records, batch: { batchNumber: 'PAY-0043' }, activePeriod: { schoolYear: '2027-2028', semester: '2nd Semester' } };
async function serialized(overrides = {}) {
  const workbook = await buildPayrollWorkbook({ ...options, ...overrides });
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(await workbook.xlsx.writeBuffer());
  return loaded.worksheets[0];
}

test('official serialized form has the supplied columns, recorded breakdowns and actual totals/reference', async () => {
  const sheet = await serialized();
  assert.deepEqual([1, 3, 5, 7, 9, 11, 13].map(column => sheet.getCell(5, column).value), ['Seq', 'NAME', 'School', 'Tuition', 'Allowance', 'Amount', 'SIGNATURE']);
  assert.equal(sheet.getCell('K4').value, 'Reference #: PAY-0043');
  assert.equal(sheet.getCell('G6').value, '');
  assert.equal(sheet.getCell('I6').value, '');
  assert.equal(sheet.getCell('K6').value, 3000);
  assert.equal(sheet.getCell('G7').value, 3500);
  assert.equal(sheet.getCell('I7').value, 1500);
  assert.equal(sheet.getCell('G8').value, 0);
  assert.equal(sheet.getCell('I8').value, 5000);
  assert.equal(sheet.getCell('K36').value, 13000);
  assert.equal(sheet.getCell('K37').value, 13000);
  assert.equal(sheet.getCell('G37').value, 'GRAND TOTAL');
  assert.equal(sheet.getCell('M6').value, '');
  assert.equal(sheet.pageSetup.paperSize, 9);
  assert.equal(sheet.pageSetup.orientation, 'landscape');
  const text = sheet.getSheetValues().flat(2).filter(value => typeof value === 'string').join(' ');
  assert.match(text, /General Form No\. 5/);
  assert.match(text, /REVIEWED FOR LIST GENERATION/);
  assert.doesNotMatch(text, /has been paid|Approved for payment|DISBURSING OFFICER|50,000\.00/);
});

test('preparation copy uses the form without claiming a saved reference or membership', async () => {
  const sheet = await serialized({ preparationCopy: true, batch: undefined });
  assert.match(sheet.getCell('A3').value, /PREPARATION COPY/);
  assert.equal(sheet.getCell('K4').value, 'Reference #: Not assigned');
  const text = sheet.getSheetValues().flat(2).join(' ');
  assert.doesNotMatch(text, /PAY-0043/);
  assert.match(text, /does not create official list membership/);
});

test('custom ordered columns retain values, currency and totals without overwriting cells', async () => {
  const sheet = await serialized({ selectedColumns: [columns[5], columns[1], columns[6]] });
  assert.equal(sheet.getCell('A5').value, 'Amount');
  assert.equal(sheet.getCell('E5').value, 'NAME');
  assert.equal(sheet.getCell('J5').value, 'SIGNATURE');
  assert.equal(sheet.getCell('A6').value, 3000);
  assert.equal(sheet.getCell('E6').value, 'SYNTHETIC PUBLIC');
  assert.equal(sheet.getCell('A36').value, 13000);
  assert.equal(sheet.getCell('E36').value, 'SUB-TOTAL:');
  assert.equal(sheet.getCell('A6').numFmt, '#,##0.00');
});

test('single-column exports serialize valid merges without extra unselected data columns', async () => {
  for (const key of ['name', 'totalGrant', 'tuitionFeeAssistance']) {
    const sheet = await serialized({ selectedColumns: [columns.find(column => column.key === key)] });
    assert.equal(sheet.getCell('A5').value, columns.find(column => column.key === key).header);
    assert.ok(sheet.columnCount <= 14);
    assert.match(sheet.pageSetup.printArea, /^A1:N\d+$/);
  }
});

test('large lists retain every scholar with repeated headings and automatic page height', async () => {
  const large = Array.from({ length: 65 }, (_, index) => ({ ...records[index % 3], name: `SYNTHETIC ${index + 1}` }));
  const sheet = await serialized({ records: large });
  assert.equal(sheet.pageSetup.printTitlesRow, '1:5');
  assert.equal(sheet.pageSetup.fitToHeight, 0);
  assert.equal(sheet.pageSetup.printArea, 'A1:N76');
  for (let index = 0; index < large.length; index += 1) assert.equal(sheet.getCell(index + 6, 3).value, large[index].name);
});

test('official lists require saved identity and empty exports fail explicitly', async () => {
  await assert.rejects(buildPayrollWorkbook({ ...options, batch: undefined }), /saved Payroll reference/);
  await assert.rejects(buildPayrollWorkbook({ ...options, selectedColumns: [] }), /at least one export column/);
  await assert.rejects(buildPayrollWorkbook({ ...options, records: [] }), /at least one scholar/);
});
