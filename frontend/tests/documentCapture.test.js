import test from 'node:test';
import assert from 'node:assert/strict';
import { captureDocumentReady } from '../src/utils/documentCapture.js';
test('single-document readiness does not depend on the other initial requirements', () => {
 const drafts = { valid_id: { pages: ['synthetic-page'] } };
 assert.equal(captureDocumentReady('valid_id', drafts), true);
 assert.equal(captureDocumentReady('grades', drafts), false);
 assert.equal(captureDocumentReady('valid_id', drafts, { valid_id: true }), false);
 assert.equal(captureDocumentReady('indigency', { indigency: { file: { fileName: 'fixture.pdf', fileData: 'data:application/pdf;base64,AA==' } } }), true);
 assert.equal(captureDocumentReady('valid_id', { valid_id: { file: { fileName: 'incomplete.pdf' } } }), false);
 assert.equal(captureDocumentReady('', drafts), false);
});
