import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MAX_DOCUMENT_BYTES, documentFileType, validateDocumentFile, DOCUMENT_FILE_HELP, DOCUMENT_FILE_ACCEPT } from '../src/utils/documentFilePolicy.js';
const fake = (name,type,bytes,size=bytes.length) => ({name,type,size,arrayBuffer:async()=>Uint8Array.from(bytes).buffer});
const pdf = Array.from(new TextEncoder().encode('%PDF-1.4\nfixture\n%%EOF\n'));
const png = [137,80,78,71,13,10,26,10,0,0];
test('shared browser policy lists all supported extensions with consistent per-requirement guidance', () => {
  for(const ext of ['.pdf','.jpg','.jpeg','.png'])assert.ok(DOCUMENT_FILE_ACCEPT.includes(ext));
  assert.equal(DOCUMENT_FILE_HELP,'PDF, JPG or PNG · Maximum 6 MB per requirement.');
});
test('browser rejects invalid names/types, empty files and oversize files before reading', async () => {
  for(const file of [fake('script.exe','application/pdf',pdf),fake('file.png','application/pdf',png),fake('file.pdf','application/pdf',[]),fake('large.pdf','application/pdf',pdf,MAX_DOCUMENT_BYTES+1)])await assert.rejects(validateDocumentFile(file));
  assert.equal(documentFileType(fake('file.PDF','',pdf)),'application/pdf');
  assert.equal(documentFileType(fake('file.jpeg','image/jpeg',[255,216,255],MAX_DOCUMENT_BYTES)),'image/jpeg');
});
test('PDF framing and real signature comparison reject renamed or truncated files', async () => {
  assert.equal(await validateDocumentFile(fake('test.pdf','application/pdf',pdf)),'application/pdf');
  await assert.rejects(validateDocumentFile(fake('test.pdf','application/pdf',png)),/contents/);
  await assert.rejects(validateDocumentFile(fake('test.pdf','application/pdf',pdf.slice(0,10))),/incomplete/);
});
test('image decoding is required, and capture photos may be 12 MB before final PDF conversion', async () => {
  let calls=0;const image=fake('photo.png','image/png',png,12*1024*1024);
  assert.equal(await validateDocumentFile(image,{capturePhoto:true,imagesOnly:true,decodeImage:async()=>{calls++;}}),'image/png');assert.equal(calls,1);
  await assert.rejects(validateDocumentFile(image),/6 MB/);
  await assert.rejects(validateDocumentFile(fake('photo.png','image/png',png),{decodeImage:async()=>{throw new Error('Unreadable');}}),/cannot be opened/);
  await assert.rejects(validateDocumentFile(fake('file.pdf','application/pdf',pdf),{capturePhoto:true,imagesOnly:true}),/photo/);
});
test('each upload surface uses the same rules, including per-document scholar/capture guidance', async () => {
  for(const name of ['InitialRequirementCapture.jsx','ScholarDashboard.jsx','PhoneCapturePage.jsx','components/ApplicationForm.jsx']) {
    const source=await readFile(new URL('../src/'+name,import.meta.url),'utf8');assert.match(source,/validateDocumentFile/);assert.match(source,/documentDataUrl/);
  }
  const scholar=await readFile(new URL('../src/ScholarDashboard.jsx',import.meta.url),'utf8');assert.match(scholar,/className="scholar-file-policy">\{DOCUMENT_FILE_HELP\}/);
  const capture=await readFile(new URL('../src/InitialRequirementCapture.jsx',import.meta.url),'utf8');assert.match(capture,/className="capture-file-policy">\{DOCUMENT_FILE_HELP\}/);
});
