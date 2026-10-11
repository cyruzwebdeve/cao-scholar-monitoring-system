import test from 'node:test';
import assert from 'node:assert/strict';
import { draftContext, draftKey, readDraft, saveDraftPatch, removeDraft, clearExaminationDrafts } from '../src/utils/examinationDraft.js';
const context = () => draftContext({ applicantId: 7, id: 9, configurationId: 1, startedAt: '2026-10-11T10:00:00Z', deadlineAt: '2026-10-11T10:45:00Z' }, 3);
const now = Date.parse('2026-10-11T10:10:00Z');
const questions = [{ id: 1, type: 'multiple-choice', options: ['A','B','C','D'] }, { id: 9, type: 'identification' }, { id: 15, type: 'true-false' }];
const store = () => {
  const map = new Map();
  return { get length() { return map.size; }, key: (i) => [...map.keys()][i], getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: (key) => map.delete(key) };
};
test('reload restores each answer type and per-question edits preserve the existing draft', () => {
  const storage = store(); const c = context();
  saveDraftPatch(c, { multipleChoice: { 1: 0 } }, questions, storage, now);
  saveDraftPatch(c, { identification: { 9: 'test response' } }, questions, storage, now);
  saveDraftPatch(c, { trueFalse: { 15: 'FALSE' } }, questions, storage, now);
  assert.deepEqual(readDraft(c, questions, storage, now), { multipleChoice: { 1: 0 }, identification: { 9: 'test response' }, trueFalse: { 15: 'FALSE' } });
  assert.doesNotMatch(storage.getItem(draftKey(c)), /token|answerKey|firstName|email/);
});
test('another applicant, attempt, version or changed deadline cannot restore these answers', () => {
  const storage = store(); const c = context();
  saveDraftPatch(c, { multipleChoice: { 1: 1 } }, questions, storage, now);
  for (const other of [{ ...c, applicantId: 8 }, { ...c, id: 10 }, { ...c, configurationId: 2 }]) assert.equal(readDraft(other, questions, storage, now), null);
  assert.equal(readDraft({ ...c, deadlineAt: '2026-10-11T10:46:00Z' }, questions, storage, now), null);
  assert.equal(storage.getItem(draftKey(c)), null);
});
test('corrupt and expired drafts are removed; expired answers cannot be saved', () => {
  const storage = store(); const c = context();
  storage.setItem(draftKey(c), 'bad JSON');
  assert.equal(readDraft(c, questions, storage, now), null);
  saveDraftPatch(c, { multipleChoice: { 1: 2 } }, questions, storage, now);
  const deadline = Date.parse(c.deadlineAt);
  assert.equal(readDraft(c, questions, storage, deadline), null);
  assert.equal(saveDraftPatch(c, {}, questions, storage, deadline), false);
  assert.equal(storage.length, 0);
});
test('invalid/unknown answers cannot become recovered responses', () => {
  const storage = store(); const c = context();
  saveDraftPatch(c, { multipleChoice: { 1: '0', 999: 0 }, identification: { 9: 'x'.repeat(600) }, trueFalse: { 15: 'maybe' } }, questions, storage, now);
  const answers = readDraft(c, questions, storage, now);
  assert.deepEqual(answers.multipleChoice, {}); assert.deepEqual(answers.trueFalse, {});
  assert.equal(answers.identification[9].length, 500);
  assert.throws(() => draftContext({}, 3), /recovery/);
});
test('submission cleanup, sign-out and different-account cleanup affect only examination drafts', () => {
  const storage = store(); const c = context(); const other = { ...c, applicantId: 8 };
  storage.setItem('unrelated', 'keep');
  saveDraftPatch(c, {}, questions, storage, now); saveDraftPatch(other, {}, questions, storage, now);
  clearExaminationDrafts(storage, { applicantId: 7, now });
  assert.equal(storage.getItem(draftKey(other)), null);
  assert.notEqual(storage.getItem(draftKey(c)), null);
  removeDraft(c, storage); assert.equal(storage.getItem(draftKey(c)), null);
  saveDraftPatch(c, {}, questions, storage, now);
  clearExaminationDrafts(storage, { now: null });
  assert.equal(storage.length, 1); assert.equal(storage.getItem('unrelated'), 'keep');
});
test('storage denial is surfaced instead of claiming answers were saved', () => {
  const storage = { getItem: () => null, setItem: () => { throw new Error('Quota exceeded'); } };
  assert.throws(() => saveDraftPatch(context(), { multipleChoice: { 1: 0 } }, questions, storage, now), /Quota/);
});
