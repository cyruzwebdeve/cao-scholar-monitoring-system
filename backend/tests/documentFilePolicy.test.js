const test = require('node:test');
const assert = require('node:assert/strict');
const { MAX_DOCUMENT_BYTES, parseDocumentEnvelope, validateDocumentUpload } = require('../services/documentFilePolicy');
const { pdf, png, jpg, dataUrl } = require('./fixtures/documentFiles');

test('real PDFs, JPG/JPEG and PNG files pass content parsing with case-insensitive extensions', async () => {
  for (const [name,bytes,type] of [['document.PDF',pdf,'application/pdf'],['id.jpg',jpg,'image/jpeg'],['id.JPEG',jpg,'image/jpeg'],['proof.png',png,'image/png']]) {
    const parsed=await validateDocumentUpload(name,dataUrl(bytes,type));assert.equal(parsed.contentType,type);assert.deepEqual(parsed.buffer,bytes);
  }
});
test('extension, MIME and actual bytes must agree; renamed executables and malformed envelopes fail', async () => {
  const cases=[['proof.docx',dataUrl()],['proof.pdf',dataUrl(png,'image/png')],['proof.pdf',dataUrl(png,'application/pdf')],['proof.jpg',dataUrl(pdf,'image/jpeg')],['proof.png',dataUrl(Buffer.from('executable'),'image/png')],['../proof.pdf',dataUrl()],['proof.pdf','data:application/pdf;base64,'],['proof.pdf','data:application/pdf;base64,YQ=A'],['proof.pdf','data:application/pdf;base64,YR=='],['proof.pdf','data:application/pdf;base64,%%%%'],['proof.pdf','data:text/html;base64,PHNjcmlwdD4=']];
  for(const [name,data] of cases)await assert.rejects(validateDocumentUpload(name,data),error=>error.statusCode===400,`${name} must fail`);
});
test('signature-only, truncated, CRC-damaged and structurally invalid documents are rejected by parsers', async () => {
  const damagedPng=Buffer.from(png);damagedPng[damagedPng.length-5]^=255;
  for(const [name,bytes,type]of[['fake.pdf',Buffer.from('%PDF-1.4\nnot a document\n%%EOF'),'application/pdf'],['cut.pdf',pdf.subarray(0,80),'application/pdf'],['cut.jpg',jpg.subarray(0,30),'image/jpeg'],['bad.png',damagedPng,'image/png']])await assert.rejects(validateDocumentUpload(name,dataUrl(bytes,type)),error=>error.statusCode===400);
});
test('6 MB inclusive boundary and capture transfer 4 MB boundary are enforced before parsing', () => {
  const sized = size => {const bytes=Buffer.alloc(size,32);pdf.copy(bytes);return dataUrl(bytes);};
  assert.equal(parseDocumentEnvelope('boundary.pdf',sized(MAX_DOCUMENT_BYTES)).buffer.length,MAX_DOCUMENT_BYTES);
  assert.throws(()=>parseDocumentEnvelope('large.pdf',sized(MAX_DOCUMENT_BYTES+1)),error=>error.statusCode===413);
  assert.throws(()=>parseDocumentEnvelope('photo.jpg',dataUrl(Buffer.concat([jpg,Buffer.alloc(4*1024*1024)]),'image/jpeg'),4*1024*1024),error=>error.statusCode===413);
});
test('image dimension limits reject a small compressed file requesting excessive decoded memory', async () => {
  const bytes=Buffer.from(png);bytes.writeUInt32BE(100000,16);bytes.writeUInt32BE(100000,20);
  await assert.rejects(validateDocumentUpload('huge.png',dataUrl(bytes,'image/png')),error=>error.statusCode===400);
});
test('bounded parser concurrency rejects excess work and recovers without losing valid upload ability', async () => {
  const outcomes=await Promise.allSettled([validateDocumentUpload('a.pdf',dataUrl()),validateDocumentUpload('b.pdf',dataUrl()),validateDocumentUpload('c.pdf',dataUrl())]);
  assert.equal(outcomes.filter(row=>row.status==='fulfilled').length,2);
  assert.equal(outcomes.find(row=>row.status==='rejected').reason.statusCode,503);
  assert.equal((await validateDocumentUpload('retry.pdf',dataUrl())).contentType,'application/pdf');
});
