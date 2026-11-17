import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assignCaptureDraft, captureDraftBytes, captureDraftHasContent, captureDraftUploadReady,
  createCaptureDraft, getCaptureUploadTarget, MAX_CAPTURE_DRAFT_BYTES, updateCaptureDraftContent,
} from '../src/utils/adminDocumentCapture.js';

const requirements = ['tax_exemption', 'valid_id', 'grades', 'report_card'].map(requirementKey => ({ requirementKey }));
const scanned = (id, number, page = 'synthetic-page') => ({ ...createCaptureDraft(id, number), pages: [page] });

test('new document drafts remain unassigned until content is scanned or selected', () => {
  const draft = createCaptureDraft('scan-1', 1);
  assert.equal(draft.requirementKey, '');
  assert.equal(captureDraftHasContent(draft), false);
  assert.equal(captureDraftUploadReady({ 'scan-1': draft }, 'scan-1', requirements), false);
  assert.throws(() => assignCaptureDraft({ 'scan-1': draft }, 'scan-1', 'valid_id', requirements), /Scan or choose/);
});

test('multiple scanned documents can be collected before any requirement is assigned', () => {
  const drafts = { one: scanned('one', 1), two: scanned('two', 2), three: scanned('three', 3) };
  assert.ok(Object.values(drafts).every(captureDraftHasContent));
  assert.ok(Object.values(drafts).every(draft => !draft.requirementKey));
  assert.throws(() => getCaptureUploadTarget(drafts, 'one', requirements), /Assign this document/);
});

test('assignment preserves each document and makes only the chosen document uploadable', () => {
  const drafts = { one: scanned('one', 1), two: scanned('two', 2, 'second-page') };
  const before = structuredClone(drafts);
  const assigned = assignCaptureDraft(drafts, 'two', 'report_card', requirements);
  assert.equal(getCaptureUploadTarget(assigned, 'two', requirements), 'report_card');
  assert.equal(captureDraftUploadReady(assigned, 'one', requirements), false);
  assert.equal(captureDraftUploadReady(assigned, 'two', requirements), true);
  assert.deepEqual(assigned.two.pages, ['second-page']);
  assert.deepEqual(assigned.one, before.one);
  assert.deepEqual(drafts, before);
});

test('assignments can be corrected or cleared without losing the scanned pages', () => {
  let drafts = { one: scanned('one', 1) };
  drafts = assignCaptureDraft(drafts, 'one', 'grades', requirements);
  drafts = assignCaptureDraft(drafts, 'one', 'report_card', requirements);
  assert.equal(getCaptureUploadTarget(drafts, 'one', requirements), 'report_card');
  drafts = assignCaptureDraft(drafts, 'one', '', requirements);
  assert.equal(captureDraftUploadReady(drafts, 'one', requirements), false);
  assert.deepEqual(drafts.one.pages, ['synthetic-page']);
});

test('two pending documents cannot silently target the same requirement', () => {
  let drafts = { one: scanned('one', 1), two: scanned('two', 2) };
  drafts = assignCaptureDraft(drafts, 'one', 'valid_id', requirements);
  assert.throws(() => assignCaptureDraft(drafts, 'two', 'valid_id', requirements), /Another scanned document/);
  assert.equal(drafts.two.requirementKey, '');
  drafts = assignCaptureDraft(drafts, 'one', '', requirements);
  drafts = assignCaptureDraft(drafts, 'two', 'valid_id', requirements);
  assert.equal(getCaptureUploadTarget(drafts, 'two', requirements), 'valid_id');
});

test('upload rechecks stale duplicate, saved and removed requirement assignments', () => {
  const drafts = { one: { ...scanned('one', 1), requirementKey: 'valid_id' } };
  assert.throws(() => getCaptureUploadTarget(drafts, 'one', requirements, { valid_id: true }), /already uploaded/);
  assert.throws(() => assignCaptureDraft(drafts, 'one', 'valid_id', requirements, { valid_id: true }), /already uploaded/);
  const duplicate = { ...drafts, two: { ...scanned('two', 2), requirementKey: 'valid_id' } };
  assert.equal(captureDraftUploadReady(duplicate, 'one', requirements), false);
  assert.throws(() => getCaptureUploadTarget(drafts, 'one', requirements.filter(doc => doc.requirementKey !== 'valid_id')), /initial checklist/);
});

test('PDF and photo replacements retain assignment while clearing all content releases it', () => {
  let drafts = assignCaptureDraft({ one: scanned('one', 1) }, 'one', 'report_card', requirements);
  drafts = updateCaptureDraftContent(drafts, 'one', { pages: [], file: { fileName: 'report.pdf', fileData: 'synthetic-pdf' } });
  assert.equal(getCaptureUploadTarget(drafts, 'one', requirements), 'report_card');
  assert.deepEqual(drafts.one.pages, []);
  drafts = updateCaptureDraftContent(drafts, 'one', { pages: ['replacement-photo'], file: null });
  assert.equal(getCaptureUploadTarget(drafts, 'one', requirements), 'report_card');
  drafts = updateCaptureDraftContent(drafts, 'one', { pages: [], file: null });
  assert.equal(drafts.one.requirementKey, '');
  assert.equal(captureDraftUploadReady(drafts, 'one', requirements), false);
});

test('incomplete PDF metadata and unavailable drafts cannot be assigned or uploaded', () => {
  const draft = { ...createCaptureDraft('one', 1), file: { fileName: 'incomplete.pdf' } };
  assert.equal(captureDraftHasContent(draft), false);
  assert.throws(() => getCaptureUploadTarget({ one: draft }, 'one', requirements), /Scan or choose/);
  assert.throws(() => assignCaptureDraft({}, 'missing', 'grades', requirements), /no longer available/);
  assert.throws(() => updateCaptureDraftContent({}, 'missing', { pages: ['page'] }), /no longer available/);
});

test('PDF and image drafts share the session limit and rejected additions leave earlier scans intact', () => {
  const half = 'x'.repeat(MAX_CAPTURE_DRAFT_BYTES / 2);
  const drafts = {
    one: { ...createCaptureDraft('one', 1), file: { fileName: 'first.pdf', fileData: half } },
    two: { ...createCaptureDraft('two', 2), pages: [half] },
    three: createCaptureDraft('three', 3),
  };
  assert.equal(captureDraftBytes(drafts), MAX_CAPTURE_DRAFT_BYTES);
  assert.throws(() => updateCaptureDraftContent(drafts, 'three', { file: { fileName: 'next.pdf', fileData: 'one-more-byte' } }), /too large/);
  assert.deepEqual(drafts.three, createCaptureDraft('three', 3));
  const reduced = updateCaptureDraftContent(drafts, 'two', { pages: [], file: null });
  const accepted = updateCaptureDraftContent(reduced, 'three', { file: { fileName: 'next.pdf', fileData: 'small-pdf' } });
  assert.equal(captureDraftHasContent(accepted.three), true);
  assert.equal(accepted.one.file.fileData, half);
});
