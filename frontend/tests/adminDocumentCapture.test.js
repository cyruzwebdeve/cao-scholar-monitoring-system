import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assignCaptureDraft, assignCaptureRequirement, captureDraftBytes, captureDraftHasContent, captureDraftUploadReady,
  createCaptureDraft, getCaptureUploadBatch, getCaptureUploadTarget, MAX_CAPTURE_DRAFT_BYTES, updateCaptureDraftContent,
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

test('a requirement row replaces its selected scan atomically and preserves all document content', () => {
  const drafts = {
    one: { ...scanned('one', 1), requirementKey: 'valid_id' },
    two: scanned('two', 2, 'replacement-page'),
    three: { ...createCaptureDraft('three', 3), requirementKey: 'report_card', file: { fileName: 'report.pdf', fileData: 'synthetic-report' } },
  };
  const original = structuredClone(drafts);
  const next = assignCaptureRequirement(drafts, 'valid_id', 'two', requirements);
  assert.equal(next.one.requirementKey, '');
  assert.equal(getCaptureUploadTarget(next, 'two', requirements), 'valid_id');
  assert.deepEqual(next.one.pages, original.one.pages);
  assert.deepEqual(next.two.pages, original.two.pages);
  assert.deepEqual(next.three, original.three);
  assert.deepEqual(drafts, original);
});

test('clearing a requirement row releases its scan without deleting content or other assignments', () => {
  const drafts = {
    one: { ...scanned('one', 1), requirementKey: 'valid_id' },
    two: { ...scanned('two', 2), requirementKey: 'report_card' },
  };
  const original = structuredClone(drafts);
  const cleared = assignCaptureRequirement(drafts, 'valid_id', '', requirements);
  assert.equal(cleared.one.requirementKey, '');
  assert.deepEqual(cleared.one.pages, original.one.pages);
  assert.deepEqual(cleared.two, original.two);
  assert.equal(captureDraftUploadReady(cleared, 'one', requirements), false);
  const reassigned = assignCaptureRequirement(cleared, 'grades', 'one', requirements);
  assert.equal(getCaptureUploadTarget(reassigned, 'one', requirements), 'grades');
  assert.deepEqual(drafts, original);
});

test('a requirement row cannot steal a document from another row or release its old selection on failure', () => {
  const drafts = {
    one: { ...scanned('one', 1), requirementKey: 'valid_id' },
    two: { ...scanned('two', 2), requirementKey: 'report_card' },
  };
  const original = structuredClone(drafts);
  assert.throws(() => assignCaptureRequirement(drafts, 'valid_id', 'two', requirements), /another requirement/);
  assert.deepEqual(drafts, original);
  const unchanged = assignCaptureRequirement(drafts, 'valid_id', 'one', requirements);
  assert.equal(getCaptureUploadTarget(unchanged, 'one', requirements), 'valid_id');
  assert.deepEqual(unchanged, original);
});

test('unknown, empty-content, removed and saved row selections reject without changing current bindings', () => {
  const drafts = {
    one: { ...scanned('one', 1), requirementKey: 'valid_id' },
    empty: createCaptureDraft('empty', 2),
  };
  const original = structuredClone(drafts);
  assert.throws(() => assignCaptureRequirement(drafts, 'unknown', 'one', requirements), /initial checklist/);
  assert.throws(() => assignCaptureRequirement(drafts, 'valid_id', 'empty', requirements), /Scan or choose/);
  assert.throws(() => assignCaptureRequirement(drafts, 'valid_id', 'removed', requirements), /no longer available/);
  assert.throws(() => assignCaptureRequirement(drafts, 'valid_id', undefined, requirements), /no longer available/);
  assert.throws(() => assignCaptureRequirement(drafts, 'valid_id', 'one', requirements, { valid_id: true }), /already uploaded/);
  assert.throws(() => assignCaptureRequirement(drafts, 'valid_id', '', requirements, { valid_id: true }), /already uploaded/);
  assert.deepEqual(drafts, original);
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

test('batch plans mixed PDF and photo documents in checklist order without changing caller data', () => {
  const drafts = {
    report: { ...createCaptureDraft('report', 1), requirementKey: 'report_card', file: { fileName: 'report.pdf', fileData: 'synthetic-pdf' } },
    grades: { ...scanned('grades', 2), requirementKey: 'grades' },
    tax: { ...scanned('tax', 3), requirementKey: 'tax_exemption' },
    id: { ...scanned('id', 4), requirementKey: 'valid_id' },
  };
  const before = structuredClone({ drafts, requirements, saved: {} });
  const saved = {};
  const expected = [
    { draftId: 'tax', requirementKey: 'tax_exemption' },
    { draftId: 'id', requirementKey: 'valid_id' },
    { draftId: 'grades', requirementKey: 'grades' },
    { draftId: 'report', requirementKey: 'report_card' },
  ];
  const plan = getCaptureUploadBatch(drafts, requirements, saved);
  assert.deepEqual(plan, expected);
  assert.deepEqual(getCaptureUploadBatch(Object.fromEntries(Object.entries(drafts).reverse()), requirements, saved), expected);
  plan[0].requirementKey = 'changed-plan';
  assert.deepEqual({ drafts, requirements, saved }, before);
});

test('batch ignores unassigned scans and already-uploaded requirements, including stale empty saved drafts', () => {
  const drafts = {
    saved: { ...createCaptureDraft('saved', 1), requirementKey: 'valid_id' },
    unused: scanned('unused', 2),
    empty: createCaptureDraft('empty', 3),
    pending: { ...scanned('pending', 4), requirementKey: 'report_card' },
  };
  const saved = { valid_id: true };
  const before = structuredClone({ drafts, saved });
  assert.deepEqual(getCaptureUploadBatch(drafts, requirements, saved), [{ draftId: 'pending', requirementKey: 'report_card' }]);
  assert.deepEqual(getCaptureUploadBatch(drafts, requirements, { ...saved, report_card: true }), []);
  assert.deepEqual(getCaptureUploadBatch({}, requirements), []);
  assert.deepEqual({ drafts, saved }, before);
});

test('batch permits a partial checklist even when other required documents have no assigned scan', () => {
  const checklist = requirements.map(document => ({ ...document, required: true }));
  const drafts = { one: { ...scanned('one', 1), requirementKey: 'grades' } };
  assert.deepEqual(getCaptureUploadBatch(drafts, checklist), [{ draftId: 'one', requirementKey: 'grades' }]);
});

test('batch rejects duplicate pending targets before returning any upload plan', () => {
  const drafts = {
    valid: { ...scanned('valid', 1), requirementKey: 'tax_exemption' },
    one: { ...scanned('one', 2), requirementKey: 'valid_id' },
    two: { ...scanned('two', 3), requirementKey: 'valid_id' },
  };
  const before = structuredClone(drafts);
  assert.throws(() => getCaptureUploadBatch(drafts, requirements), /Another scanned document/);
  assert.deepEqual(drafts, before);
});

test('batch validates unknown assigned targets instead of silently omitting them from checklist order', () => {
  const drafts = {
    valid: { ...scanned('valid', 1), requirementKey: 'valid_id' },
    unknown: { ...scanned('unknown', 2), requirementKey: 'removed_requirement' },
  };
  const before = structuredClone(drafts);
  assert.throws(() => getCaptureUploadBatch(drafts, requirements), /initial checklist/);
  assert.deepEqual(drafts, before);
});

test('batch rejects assigned empty scans and incomplete PDFs after an otherwise valid candidate', () => {
  const drafts = {
    valid: { ...scanned('valid', 1), requirementKey: 'valid_id' },
    empty: { ...createCaptureDraft('empty', 2), requirementKey: 'report_card' },
  };
  const before = structuredClone(drafts);
  assert.throws(() => getCaptureUploadBatch(drafts, requirements), /Scan or choose/);
  const incompletePdf = { ...drafts, empty: { ...drafts.empty, file: { fileName: 'incomplete.pdf' } } };
  assert.throws(() => getCaptureUploadBatch(incompletePdf, requirements), /Scan or choose/);
  assert.deepEqual(drafts, before);
});
