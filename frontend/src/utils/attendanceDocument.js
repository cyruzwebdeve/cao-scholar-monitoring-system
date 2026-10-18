import JSZip from 'jszip';

export const ATTENDANCE_WORD_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const xml = value => Array.from(String(value ?? '')).filter(character => {
  const code = character.codePointAt(0);
  return [9, 10, 13].includes(code) || (code >= 32 && code <= 0xD7FF) || (code >= 0xE000 && code <= 0xFFFD) || code >= 0x10000;
}).join('')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const paragraph = (value, { bold = false, size = 20 } = {}) => `<w:p><w:pPr><w:spacing w:after="80"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>${bold ? '<w:b/>' : ''}<w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${xml(value)}</w:t></w:r></w:p>`;
const recordedAt = value => {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(+date) ? date.toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : '';
};

export const attendanceWordFilename = (municipality, now = new Date()) => {
  const name = String(municipality || 'examination').normalize('NFKD').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'examination';
  return `attendance-${name}-${now.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })}.docx`;
};

export async function createAttendanceDocument({ exam, applicants, dateLabel, now = new Date() }) {
  // Preserve the same municipality scope and seven fields as the former CSV export.
  const records = applicants.filter(applicant => applicant.municipality === exam.municipality);
  const headings = ['Control number', 'Applicant', 'Email', 'Municipality', 'Venue', 'Attendance', 'Recorded at'];
  const widths = [1700, 2400, 3000, 1700, 2700, 1500, 2300];
  const row = (cells, header = false) => `<w:tr><w:trPr><w:cantSplit/>${header ? '<w:tblHeader/>' : ''}</w:trPr>${cells.map((cell, index) => `<w:tc><w:tcPr><w:tcW w:w="${widths[index]}" w:type="dxa"/>${header ? '<w:shd w:fill="E8F1EB"/>' : ''}</w:tcPr>${paragraph(cell, { bold: header })}</w:tc>`).join('')}</w:tr>`;
  const dataRows = records.map(applicant => row([
    applicant.controlNo, applicant.name, applicant.email, applicant.municipality, exam.venue,
    applicant.attendanceStatus || 'Pending', recordedAt(applicant.appearedAt),
  ])).join('');
  const table = `<w:tbl><w:tblPr><w:tblW w:w="15300" w:type="dxa"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(edge => `<w:${edge} w:val="single" w:sz="4" w:color="B8C9BE"/>`).join('')}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="100" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map(width => `<w:gridCol w:w="${width}"/>`).join('')}</w:tblGrid>${row(headings, true)}${dataRows}</w:tbl>`;
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${NS}"><w:body>${paragraph('PGCEAP Examination Attendance', { bold: true, size: 32 })}${paragraph(`Municipality: ${exam.municipality || 'Not specified'}`)}${paragraph(`Venue: ${exam.venue || 'Not specified'}`)}${paragraph(`Examination date: ${dateLabel || exam.date || 'Not set'}`)}${paragraph(`Generated: ${recordedAt(now)} (Asia/Manila)`)}${table}${!records.length ? paragraph('No applicants are currently assigned to this municipality.') : ''}<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', document);
  return zip.generateAsync({ type: 'blob', mimeType: ATTENDANCE_WORD_MIME, compression: 'DEFLATE' });
}

export async function downloadAttendanceDocument(options) {
  const blob = await createAttendanceDocument(options);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = attendanceWordFilename(options.exam.municipality, options.now);
  try { document.body.append(anchor); anchor.click(); }
  finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
}
