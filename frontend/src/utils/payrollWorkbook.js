const recordedAmount = (value) => value == null || value === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null;

export const payrollTemplateColumns = [
  { key: 'sequence', label: 'No.', header: 'Seq', width: 5, value: (_record, index) => index + 1 },
  { key: 'name', label: 'Scholar Name', header: 'NAME', width: 44 },
  { key: 'school', label: 'School', header: 'School', width: 43 },
  { key: 'tuitionFeeAssistance', label: 'Tuition Fee Assistance (PHP)', header: 'Tuition', width: 12, currency: true, value: record => recordedAmount(record.tuitionFeeAssistance) },
  { key: 'allowance', label: 'Allowance (PHP)', header: 'Allowance', width: 12, currency: true, value: record => recordedAmount(record.allowance) },
  { key: 'totalGrant', label: 'Total Grant (PHP)', header: 'Amount', width: 14, currency: true, value: record => Number(record.claimAmount || 0) },
  { key: 'signature', label: 'Signature', header: 'SIGNATURE', width: 24, value: () => '' },
].map(column => ({ ...column, group: 'Payroll template' }));

export async function buildPayrollWorkbook({ records, batch, activePeriod, preparationCopy = false, selectedColumns = payrollTemplateColumns }) {
  if (!selectedColumns.length) throw new Error('Select at least one export column.');
  if (!records.length) throw new Error('Add at least one scholar before exporting.');
  if (!preparationCopy && !batch?.batchNumber) throw new Error('A saved Payroll reference is required for an official list.');
  const ExcelJS = await import('exceljs');
  const Workbook = ExcelJS.Workbook || ExcelJS.default?.Workbook;
  if (!Workbook) throw new Error('Excel workbook support could not be loaded.');
  const workbook = new Workbook();
  workbook.creator = 'PGCEAP Scholarship Management System';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Payroll List', {
    views: [{ showGridLines: false, state: 'frozen', ySplit: 5 }],
    pageSetup: {
      paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1,
      fitToHeight: records.length <= 30 ? 1 : 0, printTitlesRow: '1:5',
      margins: { left: .2, right: .2, top: .2, bottom: .3, header: .1, footer: .15 },
    },
    headerFooter: { oddFooter: '&L&8PGCEAP Payroll List&R&8Page &P of &N' },
  });
  // A fine physical grid allows the form heading/footer to have different spans
  // from the user-selected table columns, including a single-column export.
  const physicalCount = Math.max(14, selectedColumns.length * 2);
  const totalWidth = selectedColumns.reduce((sum, column) => sum + (column.width || 24), 0);
  const layoutScale = Math.max(1, 90 / totalWidth);
  const ranges = selectedColumns.map((column, index) => ({
    ...column,
    start: Math.floor(index * physicalCount / selectedColumns.length) + 1,
    end: Math.floor((index + 1) * physicalCount / selectedColumns.length),
  }));
  ranges.forEach(column => {
    for (let index = column.start; index <= column.end; index += 1) {
      sheet.getColumn(index).width = (column.width || 24) * layoutScale / (column.end - column.start + 1);
    }
  });
  const mergeText = (row, start, end, value, options = {}) => {
    if (end > start) sheet.mergeCells(row, start, row, end);
    const cell = sheet.getCell(row, start);
    cell.value = value ?? '';
    cell.font = { name: 'Arial', size: 9, ...options.font };
    cell.alignment = { vertical: 'middle', wrapText: true, ...options.alignment };
    if (options.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: options.fill } };
    if (options.border) cell.border = options.border;
    return cell;
  };
  const thin = { style: 'thin', color: { argb: 'FF222222' } };
  const dotted = { style: 'dotted', color: { argb: 'FF777777' } };
  const period = `${activePeriod?.schoolYear || ''} · ${activePeriod?.semester || ''}`;
  const narrow = totalWidth < 90;
  mergeText(1, 1, physicalCount, 'PROVINCIAL GOVERNMENT COLLEGE EDUCATIONAL ASSISTANCE PROGRAM', { font: { size: 10, bold: true }, alignment: { horizontal: 'center' } });
  mergeText(2, 1, physicalCount, `PAYROLL LIST · ${period}`, { alignment: { horizontal: 'center' } });
  sheet.getRow(1).height = narrow ? 36 : 18;
  sheet.getRow(2).height = narrow ? 30 : 16;
  if (preparationCopy) {
    mergeText(3, 1, physicalCount, 'PREPARATION COPY — NO OFFICIAL LIST GENERATED', { font: { bold: true, color: { argb: 'FF875314' } }, alignment: { horizontal: 'center' }, fill: 'FFFFF4D9' });
    sheet.getRow(3).height = narrow ? 26 : 17;
  } else sheet.getRow(3).height = 6;
  mergeText(4, 1, physicalCount - 4, 'Agency: Community Affairs Office');
  mergeText(4, physicalCount - 3, physicalCount, `Reference #: ${preparationCopy ? 'Not assigned' : batch.batchNumber}`, { font: { bold: true }, alignment: { horizontal: 'right' } });
  sheet.getRow(4).height = narrow ? 32 : 18;
  ranges.forEach(column => mergeText(5, column.start, column.end, column.header || column.label, {
    font: { bold: true }, alignment: { horizontal: 'center' },
    border: { top: thin, bottom: thin, left: thin, right: thin },
  }));
  sheet.getRow(5).height = 22;
  const values = records.map((record, index) => ranges.map(column => column.value ? column.value(record, index, preparationCopy ? undefined : batch) : record[column.key] ?? ''));
  const bodyRows = Math.max(30, records.length);
  for (let index = 0; index < bodyRows; index += 1) {
    const row = index + 6;
    let lines = 1;
    ranges.forEach((column, columnIndex) => {
      const value = values[index]?.[columnIndex] ?? '';
      if (typeof value === 'string' && value.length) {
        lines = Math.max(lines, Math.ceil(value.length / Math.max(8, (column.width || 24) * layoutScale * 1.2)));
      }
      const cell = mergeText(row, column.start, column.end, value, {
        alignment: { horizontal: column.currency ? 'right' : column.key === 'sequence' ? 'center' : 'left' },
        border: { bottom: dotted, left: thin, right: thin },
      });
      if (column.currency) cell.numFmt = '#,##0.00';
    });
    sheet.getRow(row).height = Math.max(13, lines * 12);
  }
  let footerRow = bodyRows + 6;
  const currencyColumns = ranges.map((column, index) => ({ ...column, index })).filter(column => column.currency);
  const amountColumn = currencyColumns.find(column => column.key === 'totalGrant');
  const totalColumns = amountColumn ? [amountColumn] : currencyColumns;
  if (totalColumns.length) {
    const firstTotal = totalColumns[0].start;
    const leftColumns = ranges.filter(column => column.end < firstTotal);
    const labelStart = leftColumns.length ? leftColumns[Math.max(0, leftColumns.length - 2)].start : null;
    const rightLabel = !leftColumns.length ? ranges.find(column => !column.currency) : null;
    for (const label of ['SUB-TOTAL:', 'GRAND TOTAL']) {
      if (!labelStart && !rightLabel) {
        mergeText(footerRow, 1, physicalCount, label, { font: { bold: true }, alignment: { horizontal: 'right' } });
        sheet.getRow(footerRow++).height = 15;
      }
      const row = footerRow++;
      ranges.filter(column => !totalColumns.some(total => total.key === column.key))
        .forEach(column => mergeText(row, column.start, column.end, '', { fill: 'FFE0E0E0' }));
      if (labelStart) {
        // Remove the blank merges before making the form's wider total label.
        leftColumns.filter(column => column.start >= labelStart).forEach(column => sheet.unMergeCells(row, column.start, row, column.end));
        mergeText(row, labelStart, firstTotal - 1, label, { fill: 'FFFFFFFF', font: { bold: true }, alignment: { horizontal: 'right' }, border: { top: thin, bottom: thin } });
      } else if (rightLabel) {
        sheet.getCell(row, rightLabel.start).value = label;
        sheet.getCell(row, rightLabel.start).font = { name: 'Arial', size: 9, bold: true };
      }
      totalColumns.forEach(column => {
        const recorded = values.map(row => row[column.index]).filter(value => typeof value === 'number' && Number.isFinite(value));
        const total = recorded.length ? recorded.reduce((cents, value) => cents + Math.round(value * 100), 0) / 100 : '';
        const cell = mergeText(row, column.start, column.end, total, { font: { bold: true }, alignment: { horizontal: 'right' }, border: { top: thin, bottom: thin } });
        cell.numFmt = '#,##0.00';
      });
      sheet.getRow(row).height = 15;
    }
  }
  const blocks = [
    { title: 'PREPARED AND VERIFIED CORRECT BY:', name: 'MARCIAL P. FERRER', role: 'Administrative Assistant II' },
    { title: 'CERTIFIED:', name: 'CHRISTABELL R. ABANO, RN, MPA', role: 'Community Affairs Officer IV' },
    { title: 'REVIEWED FOR LIST GENERATION:', name: 'RICARTE R. PADILLA', role: 'Governor' },
    { title: 'LIST RECORD:', reference: preparationCopy ? 'PREPARATION COPY' : batch.batchNumber, role: `${records.length} scholar${records.length === 1 ? '' : 's'} · ${period}` },
  ];
  const columnEnds = Array.from({ length: physicalCount }, (_, index) => index + 1);
  const cumulativeWidths = columnEnds.map(end => columnEnds.slice(0, end).reduce((sum, column) => sum + sheet.getColumn(column).width, 0));
  const sheetWidth = cumulativeWidths.at(-1);
  const footerEnds = [];
  [.215, .445, .695].forEach((fraction, index) => {
    const min = (footerEnds.at(-1) || 0) + 1;
    const max = physicalCount - (3 - index);
    const choices = columnEnds.filter(end => end >= min && end <= max);
    footerEnds.push(choices.reduce((best, end) => Math.abs(cumulativeWidths[end - 1] - sheetWidth * fraction) < Math.abs(cumulativeWidths[best - 1] - sheetWidth * fraction) ? end : best));
  });
  footerEnds.push(physicalCount);
  blocks.forEach((block, index) => {
    const start = index ? footerEnds[index - 1] + 1 : 1;
    const end = footerEnds[index];
    const options = { border: { left: thin, right: thin }, font: { size: 8 } };
    mergeText(footerRow, start, end, block.title, { ...options, font: { size: 8, bold: true }, border: { top: thin, left: thin, right: thin } });
    mergeText(footerRow + 1, start, end, block.name || block.reference || '', { ...options, alignment: { horizontal: 'center' }, border: { ...options.border, ...(!block.reference ? { bottom: thin } : {}) } });
    mergeText(footerRow + 2, start, end, block.role, { ...options, alignment: { horizontal: 'center' }, border: { bottom: thin, left: thin, right: thin } });
  });
  [22, 20, narrow ? 32 : 18].forEach((height, index) => { sheet.getRow(footerRow + index).height = height; });
  const lastColumn = sheet.getColumn(physicalCount).letter;
  sheet.pageSetup.printArea = `A1:${lastColumn}${footerRow + 2}`;
  return workbook;
}

export async function downloadPayrollWorkbook(options) {
  const workbook = await buildPayrollWorkbook(options);
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${String(options.preparationCopy ? `payroll-preparation-${new Date().toISOString().slice(0, 10)}` : options.batch?.batchNumber || 'payroll-list').replace(/[^a-z0-9_-]+/gi, '-')}.xlsx`;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
