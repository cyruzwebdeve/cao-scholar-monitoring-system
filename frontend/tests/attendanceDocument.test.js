import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { createAttendanceDocument, attendanceWordFilename, ATTENDANCE_WORD_MIME } from '../src/utils/attendanceDocument.js';

const exam = { municipality: 'Synthetic municipality', venue: 'Test hall', date: '2026-10-18' };
const now = new Date('2026-10-17T18:00:00Z');
const applicants = [
  { controlNo: 'TEST-001', name: 'Synthetic Applicant', email: 'synthetic@example.invalid', municipality: exam.municipality, attendanceStatus: 'Present', appearedAt: '2026-10-18T00:00:00Z' },
  { controlNo: 'TEST-002', name: 'Second Fixture', municipality: exam.municipality },
  { controlNo: 'EXCLUDED', name: 'Other municipality', municipality: 'Elsewhere' },
];
const templateData = await readFile(new URL('../src/assets/templates/pgceap-attendance.docx', import.meta.url));
const unpack = async options => {
  const blob = await createAttendanceDocument({ exam, applicants, now, templateData, ...options });
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  return { blob, zip, xml: await zip.file('word/document.xml').async('string') };
};

test('attendance download is a genuine DOCX package with Word MIME and the supplied template tables', async () => {
  const { blob, zip, xml } = await unpack();
  assert.equal(blob.type, ATTENDANCE_WORD_MIME);
  const types = await zip.file('[Content_Types].xml').async('string');
  const rels = await zip.file('_rels/.rels').async('string');
  assert.match(types, /wordprocessingml.document.main\+xml/);
  assert.match(rels, /Target="word\/document.xml"/);
  assert.match(xml, /w:pgSz w:w="12240" w:h="18720"/); assert.match(xml, /<w:tblHeader\/>/);
  assert.equal((xml.match(/<w:gridCol /g) || []).length, 6);
  assert.equal((xml.match(/<w:tr(?:\s|>)/g) || []).length, 44);
});
test('template attendance uses its five headings, preserves municipality scope and pending fallback', async () => {
  const { xml } = await unpack();
  for (const text of ['No.', 'Name', 'Remarks', 'Date Recorded', 'Time Recorded', 'Synthetic Applicant', 'Second Fixture', 'Test hall', 'Present', 'Pending']) assert.ok(xml.includes(text), text);
  assert.doesNotMatch(xml, /EXCLUDED|Other municipality/);
  assert.ok(xml.includes(new Date(applicants[0].appearedAt).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })));
  assert.ok(xml.includes(new Date(applicants[0].appearedAt).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila' })));
  assert.doesNotMatch(xml, /synthetic@example.invalid|Control number/);
});
test('Word XML safely escapes text and strips invalid control characters', async () => {
  const { xml } = await unpack({ applicants: [{ ...applicants[0], name: 'A & B <fixture> "quoted"\u0001\uD800' }] });
  assert.match(xml, /A &amp; B &lt;fixture&gt; &quot;quoted&quot;/);
  assert.equal(xml.includes('\u0001'), false); assert.equal(xml.includes('\uD800'), false);
  assert.doesNotMatch(xml, /<fixture>/);
});
test('empty attendance retains all forty blank template rows', async () => {
  const { xml } = await unpack({ applicants: [], dateLabel: 'October 18, 2026' });
  assert.equal((xml.match(/<w:tr(?:\s|>)/g) || []).length, 44);
  assert.doesNotMatch(xml, /Synthetic Applicant/);
  assert.match(xml, /October 18, 2026/);
});
test('download filenames are safe DOCX names using the Manila date', () => {
  assert.equal(attendanceWordFilename('Test / municipality', now), 'attendance-Test-municipality-2026-10-18.docx');
  assert.match(attendanceWordFilename('../', now), /^attendance-examination-/);
});
test('examination download uses the lazy Word generator without changing other CSV exports', async () => {
  const source = await readFile(new URL('../src/Dashboard.jsx', import.meta.url), 'utf8');
  const handler = source.slice(source.indexOf('const downloadAttendanceList ='), source.indexOf('const updateAttendance ='));
  assert.match(handler, /import\('\.\/utils\/attendanceDocument'\)/);
  assert.match(handler, /downloadAttendanceDocument\(\{ exam, applicants, dateLabel:/);
  assert.doesNotMatch(handler, /downloadCsv|\.csv|\.xlsx/);
  assert.match(source, /<AssignedApplicantsModal/);
  const modal = await readFile(new URL('../src/components/AssignedApplicantsModal.jsx', import.meta.url), 'utf8');
  assert.match(modal, /Download attendance \(\.docx\)/);
  assert.match(modal, /attendanceDownloading \|\| Boolean\(applicantsLoadError\)/);
  assert.match(source, /import \{ buildRecordRows, downloadCsv \}/);
});

test('template artwork, relationships, styles and other parts remain byte-identical', async () => {
  const original = await JSZip.loadAsync(templateData);
  const { zip } = await unpack();
  for (const [name, entry] of Object.entries(original.files)) {
    if (!entry.dir && name !== 'word/document.xml') assert.deepEqual(await zip.file(name).async('uint8array'), await entry.async('uint8array'), name);
  }
});
test('lists beyond forty expand without dropping applicants or template numbering', async () => {
  const many = Array.from({ length: 65 }, (_, i) => ({ ...applicants[0], name: 'Synthetic row ' + (i + 1) }));
  const { xml } = await unpack({ applicants: many });
  assert.match(xml, /Synthetic row 65/);
  assert.equal((xml.match(/<w:tr(?:\s|>)/g) || []).length, 69);
  assert.equal((xml.match(/<w:numId w:val="25"/g) || []).length, 65);
});
test('replacement-significant characters remain literal and malformed templates fail visibly', async () => {
  const { xml } = await unpack({ exam: { ...exam, venue: 'Test $& hall' }, applicants: [{ ...applicants[0], name: 'Literal $& fixture' }] });
  assert.ok(xml.includes('Test $&amp; hall')); assert.ok(xml.includes('Literal $&amp; fixture'));
  await assert.rejects(createAttendanceDocument({ exam, applicants, templateData: await new JSZip().generateAsync({ type: 'uint8array' }) }), /Invalid PGCEAP attendance template/);
});
