import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReportWorkbook } from '../src/utils/reportWorkbook.js';

test('report XLSX roundtrip preserves selected sections, numeric currency, unknowns and literal formula-like text', async () => {
  const rows = [['Scholar Coverage Report'], ['School Year', '2027-2028'], [], ['Scholar Records'], ['Payroll List Amount (PHP)', 5000.25], ['Scholar Name', 'Payroll List Amount (PHP)', 'Recorded Allowance (PHP)'], ['=HYPERLINK("test")', 5000.25, 'Not recorded'], ['Synthetic zero', 0, 0], [], ['Priority Locations'], ['Municipality', 'Count'], ['Synthetic location', 2]];
  const workbook = await buildReportWorkbook(rows, [6, 11]);
  const buffer = await workbook.xlsx.writeBuffer();
  assert.equal(buffer[0], 80); assert.equal(buffer[1], 75);
  const restored = new workbook.constructor(); await restored.xlsx.load(buffer);
  const sheet = restored.getWorksheet('Reports');
  assert.equal(sheet.getCell('A7').value, '=HYPERLINK("test")');
  assert.equal(sheet.getCell('A7').type, 3);
  assert.equal(sheet.getCell('B7').value, 5000.25);
  assert.match(sheet.getCell('B7').numFmt, /0\.00/);
  assert.equal(sheet.getCell('C7').value, 'Not recorded');
  assert.equal(sheet.getCell('B8').value, 0);
  assert.equal(sheet.getCell('B12').value, 2);
  assert.notEqual(sheet.getCell('B12').numFmt, sheet.getCell('B7').numFmt);
  assert.equal(sheet.getCell('A6').font.bold, true);
});

test('names-only report stays names-only without added money columns or totals', async () => {
  const workbook = await buildReportWorkbook([['Scholar Records'], ['Scholar Name'], ['+Synthetic']], [2]);
  const sheet = workbook.getWorksheet('Reports');
  assert.equal(sheet.columnCount, 1);
  assert.equal(sheet.rowCount, 3);
  assert.equal(sheet.getCell('A3').value, '+Synthetic');
  assert.equal(sheet.getCell('A2').font.bold, true);
});
