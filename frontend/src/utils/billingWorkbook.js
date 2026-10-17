export const billingTemplateColumns = [
  { key: 'sequence', label: 'No.', width: 7, value: (_record, index) => index + 1 },
  { key: 'controlNumber', label: 'Control Number', width: 18 },
  { key: 'name', label: 'Private Scholar Name', width: 32 },
  { key: 'school', label: 'School', width: 36 },
  { key: 'municipality', label: 'Municipality', width: 18 },
  { key: 'course', label: 'Course / Program', width: 28 },
  { key: 'yearLevel', label: 'Year Level', width: 14 },
  { key: 'totalGrant', label: 'Total Grant (PHP)', width: 20, currency: true, value: record => record.claimAmount ?? record.billingAmount ?? '' },
  { key: 'tuitionFeeAssistance', label: 'Tuition Fee Assistance (PHP)', width: 22, currency: true },
  { key: 'allowance', label: 'Allowance (PHP)', width: 18, currency: true },
  { key: 'referenceNumber', label: 'Reference Number', width: 25, value: (_record, _index, batch) => batch?.batchNumber || batch?.billingReference || '' },
].map(column => ({ ...column, group: 'Billing template' }));
export const buildBillingWorkbook = async ({ records, batch, activePeriod, preparationCopy = false, selectedColumns = billingTemplateColumns }) => {
  if (!records?.length) throw new Error('Add at least one scholar before exporting.');
  const ExcelJS = await import('exceljs');
  const Workbook = ExcelJS.Workbook || ExcelJS.default?.Workbook;
  if (!Workbook) throw new Error('Excel workbook support could not be loaded.');
  const workbook = new Workbook();
  workbook.creator = 'PGCEAP Scholarship Management System';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Tuition Certification List', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  if (!selectedColumns.length) throw new Error('Select at least one export column.');
  const lastColumn = sheet.getColumn(selectedColumns.length).letter;
  if (selectedColumns.length > 1) sheet.mergeCells(`A1:${lastColumn}1`);
  sheet.getCell('A1').value = preparationCopy ? 'PGCEAP BILLING LIST - PREPARATION COPY' : 'PGCEAP PRIVATE-SCHOLAR TUITION CERTIFICATION LIST';
  sheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF176B3A' } };
  sheet.getCell('A1').alignment = { horizontal: 'center' };
  if (selectedColumns.length > 1) sheet.mergeCells(`A2:${lastColumn}2`);
  sheet.getCell('A2').value = `${activePeriod?.schoolYear || ''} · ${activePeriod?.semester || ''} · ${batch?.batchNumber || batch?.billingReference || ''}`;
  sheet.getCell('A2').alignment = { horizontal: 'center' };
  sheet.addRow([]);
  const header = sheet.addRow(selectedColumns.map(column => column.label));
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF176B3A' } };
  header.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  records.forEach((record, index) => {
    sheet.addRow(selectedColumns.map(column => column.value ? column.value(record, index, batch) : record[column.key] ?? ''));
  });
  const totalIndex = selectedColumns.findIndex(column => column.key === 'totalGrant');
  if (totalIndex >= 0) {
    const values = Array(selectedColumns.length).fill('');
    values[totalIndex] = records.reduce((sum, record) => sum + Number(record.claimAmount ?? record.billingAmount ?? 0), 0);
    if (selectedColumns.length > 1) values[totalIndex > 0 ? totalIndex - 1 : 1] = 'TOTAL';
    sheet.addRow(values).font = { bold: true };
  }
  selectedColumns.forEach((column, index) => {
    sheet.getColumn(index + 1).width = column.width || 24;
    if (column.currency) sheet.getColumn(index + 1).numFmt = '₱#,##0.00';
  });
  sheet.views = [{ state: 'frozen', ySplit: 4 }];
  return workbook;
};

export async function downloadBillingWorkbook(options) {
  const workbook = await buildBillingWorkbook(options);
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${String(options.preparationCopy ? `billing-preparation-${new Date().toISOString().slice(0, 10)}` : options.batch?.batchNumber || options.batch?.billingReference || 'private-certification-list').replace(/[^a-z0-9_-]+/gi, '-')}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

