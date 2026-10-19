import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import { buildBillingWorkbook, billingTemplateColumns } from '../src/utils/billingWorkbook.js';
const records = [
  { name: 'SYNTHETIC PRIVATE', claimAmount: 5000, tuitionFeeAssistance: 3500, allowance: 1500 },
  { name: 'SYNTHETIC ZERO', claimAmount: 0, tuitionFeeAssistance: 0, allowance: 0 },
  { name: 'SYNTHETIC MISSING', claimAmount: null, tuitionFeeAssistance: null, allowance: null },
];
const options = { records, preparationCopy: true, activePeriod: { schoolYear: '2027-2028', semester: '2nd Semester' } };
async function sheet(extra = {}) {
  const workbook = await buildBillingWorkbook({ ...options, ...extra });
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(await workbook.xlsx.writeBuffer());
  return loaded.worksheets[0];
}
test('restored Billing Excel is a preparation copy with recorded values, zero, blanks and no Signature', async () => {
  const result = await sheet();
  assert.match(result.getCell('A1').value, /BILLING LIST - PREPARATION COPY/);
  assert.equal(billingTemplateColumns.some(column => column.key === 'signature'), false);
  assert.equal(result.getCell('H5').value, 5000);
  assert.equal(result.getCell('I5').value, 3500);
  assert.equal(result.getCell('J5').value, 1500);
  assert.equal(result.getCell('H6').value, 0);
  assert.equal(result.getCell('I6').value, 0);
  assert.equal(result.getCell('H7').value, '');
  assert.equal(result.getCell('I7').value, '');
  assert.equal(result.getCell('H8').value, 5000);
  assert.equal(result.getCell('K5').value, '');
});
test('Billing Excel keeps selected column order, including a single column', async () => {
  const columns = ['allowance', 'name'].map(key => billingTemplateColumns.find(column => column.key === key));
  const result = await sheet({ selectedColumns: columns });
  assert.deepEqual([result.getCell('A4').value, result.getCell('B4').value], ['Allowance (PHP)', 'Private Scholar Name']);
  assert.deepEqual([result.getCell('A5').value, result.getCell('B5').value], [1500, 'SYNTHETIC PRIVATE']);
  const single = await sheet({ selectedColumns: columns.slice(1) });
  assert.equal(single.getCell('A5').value, 'SYNTHETIC PRIVATE');
  await assert.rejects(buildBillingWorkbook({ ...options, selectedColumns: [] }), /at least one export column/);
  await assert.rejects(buildBillingWorkbook({ ...options, records: [] }), /at least one scholar/);
});

test('custom saved amounts and recalculated allowances survive Billing Excel serialization', async () => {
 const result=await sheet({records:[{name:'SYNTHETIC CUSTOM',claimAmount:6500.75,tuitionFeeAssistance:3500,allowance:3000.75}]});
 assert.equal(result.getCell('H5').value,6500.75);assert.equal(result.getCell('I5').value,3500);assert.equal(result.getCell('J5').value,3000.75);assert.equal(result.getCell('H6').value,6500.75);
});
