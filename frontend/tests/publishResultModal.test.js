import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let server, Modal;
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  Modal = (await server.ssrLoadModule('/src/components/PublishResultModal.jsx')).default;
});
after(async () => { await server?.close(); });
const result = { id: 1, name: 'Synthetic <Applicant>', score: 18, status: 'Passed', resultId: 2, resultUpdatedAt: '2026-10-18' };

test('publishing confirmation uses a labelled native dialog with the exact applicant outcome and separate-workflow notice', () => {
  const html = renderToStaticMarkup(createElement(Modal, { result }));
  for (const content of ['<dialog', 'aria-modal="true"', 'aria-labelledby="publish-result-title"', 'aria-describedby="publish-result-description"', 'Publish reviewed result?', 'Synthetic &lt;Applicant&gt;', '18', 'Passed', 'Cancel', 'Publish result', 'Passer List posting, initial verification and Scholar acceptance remain separate steps.']) assert.ok(html.includes(content), content);
  assert.doesNotMatch(html, /<Applicant>/);
});
test('pending publication disables both actions and errors remain visible for retry', () => {
  const html = renderToStaticMarkup(createElement(Modal, { result, busy: true, error: 'Synthetic request failure' }));
  assert.equal((html.match(/disabled=""/g) || []).length, 2);
  assert.match(html, /role="status"/); assert.match(html, /Publishing\.\.\./);
  assert.match(html, /role="alert">Synthetic request failure/);
  const retry = renderToStaticMarkup(createElement(Modal, { result, busy: false, error: 'Retry' }));
  assert.doesNotMatch(retry, /disabled=""/);
});
test('drawer publish button opens the modal without sending or invoking browser confirm', async () => {
  const source = await readFile(new URL('../src/ResultsManagement.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /window\.confirm|window\.alert/);
  assert.match(source, /onClick=\{\(\) => \{ setPublishError\(''\); setPublishConfirmation\(\{ \.\.\.selected \}\); \}\}/);
  assert.match(source, /onConfirm=\{publishResult\}/);
  for (const guard of ['const result = publishConfirmation', 'publishRequest.current', 'selected.resultUpdatedAt !== result.resultUpdatedAt', 'resultId: result.resultId, updatedAt: result.resultUpdatedAt', '/examinations/${result.examId}/results/${result.id}/publish', 'setPublishConfirmation(null)', 'setPublishError(error.message']) assert.ok(source.includes(guard), guard);
  assert.match(source, /'Escape' && !publishConfirmation && !publishing/);
});
test('dialog retains native focus isolation, safe cancel behavior and narrow-screen action layout', async () => {
  const source = await readFile(new URL('../src/components/PublishResultModal.jsx', import.meta.url), 'utf8');
  for (const guard of ['dialog.showModal()', 'cancelRef.current?.focus()', 'previousFocus.focus()', 'dialog.close()', 'document.body.style.overflow = previousOverflow', 'event.preventDefault(); if (!busy) onCancel()', 'event.stopPropagation()']) assert.ok(source.includes(guard), guard);
  const css = await readFile(new URL('../src/styles/publish-result-modal.css', import.meta.url), 'utf8');
  for (const rule of ['::backdrop', 'min-height: 44px', '@media (max-width: 520px)', ':focus-visible', 'overflow-wrap: anywhere']) assert.ok(css.includes(rule), rule);
});
