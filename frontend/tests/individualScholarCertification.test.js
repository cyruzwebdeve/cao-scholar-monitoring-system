import assert from 'node:assert/strict';
import test from 'node:test';
import { buildIndividualScholarCertificationPdf } from '../src/utils/individualScholarCertification.js';
import { MAX_DOCUMENT_BYTES } from '../src/utils/documentFilePolicy.js';

const snapshot = () => ({
  reference: 'PGCEAP-CERT#0034', name: 'Synthetic Scholar', course: 'Synthetic Program',
  yearLevel: '2nd Year', school: 'Synthetic Private School', semester: '1st Semester',
  schoolYear: '2026-2027', controlNumber: 'SYNTHETIC-034', scholarId: 'SYNTHETIC-SCHOLAR',
});
const renderer = (bytes = 100) => {
  const documents = [];
  class Pdf {
    constructor(options) { this.options = options; this.calls = []; this.internal = { pageSize: { getWidth: () => 215.9 } }; documents.push(this); }
    setCreationDate(date) { this.createdAt = date.toISOString(); }
    addImage(...args) { this.calls.push(['addImage', ...args]); }
    setDrawColor() {}
    setLineWidth() {}
    line(...args) { this.calls.push(['line', ...args]); }
    setTextColor() {}
    setFont() {}
    setFontSize() {}
    text(...args) { this.calls.push(['text', ...args]); }
    splitTextToSize(text) { return [text]; }
    output(type) {
      if (type === 'arraybuffer') return new ArrayBuffer(bytes);
      assert.equal(type, 'datauristring');
      return 'data:application/pdf;filename=generated.pdf;base64,JVBERi1TWU5USEVUSUM=';
    }
    save() { assert.fail('The PDF builder must not download before saving history.'); }
  }
  return { load: async () => ({ jsPDF: Pdf }), documents };
};
const input = () => ({ snapshot: snapshot(), generatedAt: '2026-11-17T17:00:00.000Z', headerDataUrl: 'data:image/png;base64,U1lOVEhFVElD' });

test('builder uses the supplied Philippine date and exact snapshot, returning a strict upload-ready PDF without download', async () => {
  const args = input(), original = structuredClone(args), pdf = renderer();
  const result = await buildIndividualScholarCertificationPdf(args, pdf.load);
  assert.deepEqual(result, { fileName: 'PGCEAP-CERT#0034.pdf', fileData: 'data:application/pdf;base64,JVBERi1TWU5USEVUSUM=' });
  const document = pdf.documents[0];
  assert.deepEqual(document.options, { orientation: 'portrait', unit: 'mm', format: [215.9, 330.2] });
  assert.equal(document.createdAt, args.generatedAt);
  const text = document.calls.filter(call => call[0] === 'text').map(call => Array.isArray(call[1]) ? call[1].join(' ') : call[1]).join('\n');
  assert.match(text, /SYNTHETIC SCHOLAR, a 2nd Year Synthetic Program student of Synthetic Private School/);
  assert.match(text, /1st Semester, School Year 2026-2027/);
  assert.match(text, /Issued this November 18, 2026 for enrollment purposes\./);
  assert.match(text, /FIVE THOUSAND PESOS \(PHP 5,000\.00\)/);
  assert.match(text, /CHRISTABELL ANGELICA R\. ABAÑO, RN, MPA/);
  assert.match(text, /Control No\.: SYNTHETIC-034/);
  assert.deepEqual(document.calls.find(call => call[0] === 'addImage'), ['addImage', args.headerDataUrl, 'PNG', 32, 12, 151.9, 29]);
  assert.deepEqual(args, original);
});

test('async renderer loading cannot substitute later live-profile changes into the captured snapshot', async () => {
  const args = input(), pdf = renderer();
  const result = await buildIndividualScholarCertificationPdf(args, async () => {
    args.snapshot.name = 'Later Name'; args.snapshot.school = 'Later School'; args.snapshot.controlNumber = 'LATER-CONTROL';
    return pdf.load();
  });
  const text = pdf.documents[0].calls.filter(call => call[0] === 'text').map(call => String(call[1])).join('\n');
  assert.match(text, /SYNTHETIC SCHOLAR/); assert.match(text, /Synthetic Private School/); assert.match(text, /SYNTHETIC-034/);
  assert.doesNotMatch(text, /Later|LATER/); assert.equal(result.fileName, 'PGCEAP-CERT#0034.pdf');
});

test('invalid identity/date/header and oversized output reject before any downloadable result', async () => {
  let loads = 0;
  const load = async () => { loads++; return renderer().load(); };
  for (const args of [
    { ...input(), snapshot: {} }, { ...input(), snapshot: { reference: 'other.pdf' } },
    { ...input(), generatedAt: null }, { ...input(), generatedAt: 'invalid' },
    { ...input(), headerDataUrl: '' },
  ]) await assert.rejects(() => buildIndividualScholarCertificationPdf(args, load));
  assert.equal(loads, 0);
  const pdf = renderer(MAX_DOCUMENT_BYTES + 1);
  await assert.rejects(() => buildIndividualScholarCertificationPdf(input(), pdf.load), /exceeds 6 MB/);
});
