// Excel cells retain numeric amounts and literal text, including formula-like names.
export async function buildReportWorkbook(rows, headerRows = []) {
  const ExcelJS = await import('exceljs');
  const Workbook = ExcelJS.Workbook || ExcelJS.default?.Workbook;
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('Reports', { pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  let moneyColumns = [];
  for (const values of rows) {
    const row = sheet.addRow(values);
    const header = headerRows.includes(row.number);
    const section = !header && values.length === 1 && Boolean(values[0]);
    if (!values.length) moneyColumns = [];
    if (header) moneyColumns = values.map((value, index) => /\(PHP\)$/.test(String(value)) ? index + 1 : null).filter(Boolean);
    row.eachCell(cell => {
      cell.alignment = { vertical: 'top', wrapText: true };
      if (typeof cell.value === 'number' && (moneyColumns.includes(cell.col) || /\(PHP\)$/.test(String(values[0])) && cell.col === 2)) cell.numFmt = '"₱"#,##0.00';
      if (section || header) {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: section ? 'FF17633B' : 'FF466358' } };
      }
    });
  }
  sheet.columns.forEach(column => {
    let width = 14;
    column.eachCell(cell => { width = Math.max(width, Math.min(42, String(cell.value ?? '').length + 2)); });
    column.width = width;
  });
  sheet.views = [{ state: 'frozen', ySplit: 2 }];
  return workbook;
}

export async function downloadReportWorkbook({ filename, rows, headerRows }) {
  const workbook = await buildReportWorkbook(rows, headerRows);
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
