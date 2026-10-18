import JSZip from 'jszip';

export const ATTENDANCE_WORD_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const xml = value => Array.from(String(value ?? '')).filter(character => {
  const code = character.codePointAt(0);
  return [9, 10, 13].includes(code) || (code >= 32 && code <= 0xD7FF) || (code >= 0xE000 && code <= 0xFFFD) || code >= 0x10000;
}).join('')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
export const attendanceWordFilename = (municipality, now = new Date()) => {
  const name = String(municipality || 'examination').normalize('NFKD').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'examination';
  return `attendance-${name}-${now.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })}.docx`;
};

const rowsOf = table => [...table.matchAll(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g)].map(match => match[0]);
const fillCell = (cell, value) => {
  const properties = cell.match(/<w:tcPr(?:\s[^>]*)?>[\s\S]*?<\/w:tcPr>/)?.[0] || '';
  const paragraphProperties = cell.match(/<w:pPr(?:\s[^>]*)?>[\s\S]*?<\/w:pPr>/)?.[0] || '';
  const runProperties = cell.match(/<w:rPr(?:\s[^>]*)?>[\s\S]*?<\/w:rPr>/)?.[0] || '';
  return cell.replace(/^(<w:tc(?:\s[^>]*)?>)[\s\S]*(<\/w:tc>)$/, (_, open, close) =>
    open + properties + '<w:p>' + paragraphProperties + '<w:r>' + runProperties + '<w:t xml:space="preserve">' + xml(value) + '</w:t></w:r></w:p>' + close);
};
const fillRow = (row, values) => {
  let index = 0;
  return row.replace(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g, cell => {
    const value = values[index++];
    return value === null ? cell : fillCell(cell, value);
  });
};
const recordedParts = value => {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(+date) ? [date.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' }), date.toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila' })] : ['', ''];
};

export async function createAttendanceDocument({ exam, applicants, dateLabel, templateData }) {
  if (!templateData) {
    const { default: templateUrl } = await import('../assets/templates/pgceap-attendance.docx?url');
    const response = await fetch(templateUrl);
    if (!response.ok) throw new Error('Unable to load the PGCEAP attendance Word template. Please try again.');
    templateData = await response.arrayBuffer();
  }
  const zip = await JSZip.loadAsync(templateData);
  const part = zip.file('word/document.xml');
  if (!part) throw new Error('Invalid PGCEAP attendance template.');
  const document = await part.async('string');
  const tables = [...document.matchAll(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g)];
  const metadata = tables[0]?.[0], attendance = tables[1]?.[0];
  const metadataRows = metadata ? rowsOf(metadata) : [];
  const attendanceRows = attendance ? rowsOf(attendance) : [];
  if (metadataRows.length !== 3 || attendanceRows.length !== 41 || !['No.', 'Name', 'Remarks', 'Date Recorded', 'Time Recorded'].every(label => attendanceRows[0].includes(label))) throw new Error('Unexpected PGCEAP attendance template layout.');
  const labels = [`Municipality: ${exam.municipality || 'Not specified'}`, `Venue: ${exam.venue || 'Not specified'}`, `Date: ${dateLabel || exam.date || 'Not set'}`];
  let populatedMetadata = metadata;
  metadataRows.forEach((row, index) => { populatedMetadata = populatedMetadata.replace(row, () => fillRow(row, [labels[index]])); });
  // Retain the template's automatic No. numbering, header/footer artwork and page setup.
  const records = applicants.filter(applicant => applicant.municipality === exam.municipality);
  const header = attendanceRows[0].includes('<w:tblHeader') ? attendanceRows[0]
    : attendanceRows[0].includes('</w:trPr>') ? attendanceRows[0].replace('</w:trPr>', '<w:tblHeader/></w:trPr>')
      : attendanceRows[0].replace(/^(<w:tr(?:\s[^>]*)?>)/, '$1<w:trPr><w:tblHeader/></w:trPr>');
  const rows = Array.from({ length: Math.max(40, records.length) }, (_, index) => {
    const base = attendanceRows[index + 1] || attendanceRows[40].replace(/\s+w14:(?:paraId|textId)="[^"]*"/g, '');
    const applicant = records[index];
    if (!applicant) return base;
    return fillRow(base, [null, applicant.name || '', applicant.attendanceStatus || 'Pending', ...recordedParts(applicant.appearedAt)]);
  });
  let rowIndex = 0;
  const populatedAttendance = attendance.replace(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g, () => rowIndex++ === 0 ? header + rows.join('') : '');
  zip.file('word/document.xml', document.replace(metadata, () => populatedMetadata).replace(attendance, () => populatedAttendance));
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
