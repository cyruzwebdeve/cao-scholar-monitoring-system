import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Results applicant score drawer has no comment/remarks input or manual-entry gate', async () => {
  const source = await readFile(new URL('../src/ResultsManagement.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /reevaluationRemarks|setReevaluationRemarks|Review remarks|rm-reevaluation-remarks|<textarea/);
  const save = source.slice(source.indexOf('const saveReevaluation ='), source.indexOf('const publishResult ='));
  assert.doesNotMatch(save, /remarks:|Add a remark/);
  for (const guard of ['score < 0 || score > 20', 'Number(passingScore) < 1', "method: isFirstResult ? 'POST' : 'PUT'", 'resultId: selected.resultId, updatedAt: selected.resultUpdatedAt', 'if (!selected || selected.isScholar) return']) assert.ok(save.includes(guard), guard);
});
test('legacy notes remain retained for historical exports and publication stays a separate modal action', async () => {
  const source = await readFile(new URL('../src/ResultsManagement.jsx', import.meta.url), 'utf8');
  assert.match(source, /key: 'notes', label: 'Remarks'/);
  assert.match(source, /notes: payload.result.remarks/);
  assert.match(source, /<PublishResultModal/);
  assert.match(source, /Saving keeps the result under review/);
  const css = await readFile(new URL('../src/styles/admin.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /rm-reevaluation-remarks/);
  assert.match(css, /\.rm-reevaluation-scores input:focus/);
});
