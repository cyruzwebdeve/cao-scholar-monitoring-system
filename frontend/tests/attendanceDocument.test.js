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
const unpack = async options => {
  const blob = await createAttendanceDocument({ exam, applicants, now, ...options });
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  return { blob, zip, xml: await zip.file('word/document.xml').async('string') };
};

test('attendance download is a genuine DOCX package with Word MIME and landscape table', async () => {
  const { blob, zip, xml } = await unpack();
  assert.equal(blob.type, ATTENDANCE_WORD_MIME);
  const types = await zip.file('[Content_Types].xml').async('string');
  const rels = await zip.file('_rels/.rels').async('string');
  assert.match(types, /wordprocessingml.document.main\+xml/);
  assert.match(rels, /Target="word\/document.xml"/);
  assert.match(xml, /w:orient="landscape"/); assert.match(xml, /<w:tblHeader\/>/);
  assert.equal((xml.match(/<w:gridCol /g) || []).length, 7);
  assert.equal((xml.match(/<w:tr>/g) || []).length, 3);
});
test('Word attendance preserves all seven fields, municipality scope and pending fallback', async () => {
  const { xml } = await unpack();
  for (const text of ['Control number', 'Applicant', 'Email', 'Municipality', 'Venue', 'Attendance', 'Recorded at', 'TEST-001', 'TEST-002', 'synthetic@example.invalid', 'Test hall', 'Present', 'Pending']) assert.ok(xml.includes(text), text);
  assert.doesNotMatch(xml, /EXCLUDED|Other municipality/);
  assert.ok(xml.includes(new Date(applicants[0].appearedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })));
});
test('Word XML safely escapes text and strips invalid control characters', async () => {
  const { xml } = await unpack({ applicants: [{ ...applicants[0], name: 'A & B <fixture> "quoted"\u0001\uD800' }] });
  assert.match(xml, /A &amp; B &lt;fixture&gt; &quot;quoted&quot;/);
  assert.equal(xml.includes('\u0001'), false); assert.equal(xml.includes('\uD800'), false);
  assert.doesNotMatch(xml, /<fixture>/);
});
test('empty attendance creates a valid header-only document with an explicit empty-state note', async () => {
  const { xml } = await unpack({ applicants: [], dateLabel: 'October 18, 2026' });
  assert.equal((xml.match(/<w:tr>/g) || []).length, 1);
  assert.match(xml, /No applicants are currently assigned/);
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
  assert.match(source, /Download attendance \(\.docx\)/);
  assert.match(source, /attendanceDownloading \|\| Boolean\(applicantsLoadError\)/);
  assert.match(source, /import \{ buildRecordRows, downloadCsv \}/);
});
