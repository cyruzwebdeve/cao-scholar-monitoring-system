import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let server, Passers, Retained;
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  Passers = (await server.ssrLoadModule('/src/PasserLists.jsx')).default;
  Retained = (await server.ssrLoadModule('/src/components/RetainedPasserLists.jsx')).default;
});
after(async () => { await server?.close(); });

test('Passer Lists separates list preparation, applicant rows and retained history without altering candidate eligibility', () => {
  const applicants = [
    { id: 1, name: 'Synthetic passer', control: 'TEST-001', municipality: 'Test municipality', status: 'Passed', resultId: 1, score: 18 },
    { id: 2, name: 'Excluded failure', status: 'Failed', resultId: 2 },
    { id: 3, name: 'Excluded scholar', status: 'Passed', resultId: 3, isScholar: true },
    { id: 4, name: 'Excluded unrecorded result', status: 'Passed' },
  ];
  const html = renderToStaticMarkup(createElement(Passers, { applicants, token: 'synthetic' }));
  for (const label of ['Prepare a list', 'Select passers', 'Retained lists', 'Save draft', 'Post &amp; lock list', 'Synthetic passer', 'TEST-001', 'Score']) assert.ok(html.includes(label), label);
  assert.equal((html.match(/type="checkbox"/g) || []).length, 1);
  assert.match(html, /aria-label="Select Synthetic passer"/);
  assert.doesNotMatch(html, /Excluded failure|Excluded scholar|Excluded unrecorded result/);
});

test('retained lists render readable draft/posted badges, member details and escaped titles', () => {
  const lists = [
    { id: 1, title: 'Draft <fixture>', status: 'draft', created_at: '2026-10-18', members: [{ id: 1, snapshot: { name: 'Synthetic member', score: 18 } }] },
    { id: 2, title: 'Posted list', status: 'posted', posted_at: '2026-10-18', supersedes_id: 1, revision_reason: 'Synthetic revision', members: [] },
  ];
  const html = renderToStaticMarkup(createElement(Retained, { lists, ready: true, busy: true }));
  assert.equal((html.match(/<details /g) || []).length, 2);
  for (const label of ['Draft &lt;fixture&gt;', 'Posted · Locked', 'Saved draft', 'Synthetic member', 'Score 18', 'Revision of #1']) assert.ok(html.includes(label), label);
  assert.equal((html.match(/Post &amp; lock saved draft/g) || []).length, 1);
  assert.match(html, /disabled=""/);
});

test('saved draft posting forwards the original list identifier only', () => {
  let posted;
  const tree = Retained({ lists: [{ id: 42, title: 'Test draft', status: 'draft', created_at: '2026-10-18', members: [] }], ready: true, busy: false, onPostDraft: id => { posted = id; } });
  const record = tree.props.children[1].props.children[0];
  record.props.children[1].props.children[3].props.onClick();
  assert.equal(posted, 42);
});

test('empty and loading states stay distinct', () => {
  assert.match(renderToStaticMarkup(createElement(Retained, { lists: [], ready: false })), /Loading saved lists/);
  assert.match(renderToStaticMarkup(createElement(Retained, { lists: [], ready: true })), /No saved lists yet/);
  assert.match(renderToStaticMarkup(createElement(Passers, { applicants: [] })), /No unaccepted applicants with recorded passing scores/);
});

test('layout preserves posting validation, idempotency and original request payloads', async () => {
  const source = await readFile(new URL('../src/PasserLists.jsx', import.meta.url), 'utf8');
  for (const guard of ['crypto.randomUUID()', 'requestKey: requestKey.current', 'selected.length > 500', 'previous && !reason.trim()', 'candidates.slice(0, 500)', 'applicantId: item.id', 'applicationId: item.applicationId', 'examId: item.examId', 'resultId: item.resultId', 'updatedAt: item.resultUpdatedAt', "save('draft')", "save('posted')", '/passer-lists/${id}/post', 'maxLength={160}', 'maxLength={2000}']) assert.ok(source.includes(guard), guard);
  const css = await readFile(new URL('../src/styles/passer-lists.css', import.meta.url), 'utf8');
  for (const rule of ['minmax(0, 1.4fr)', 'overflow-wrap: anywhere', '@media (max-width: 1050px)', '@media (max-width: 560px)', 'min-height: 44px', ':focus-visible']) assert.ok(css.includes(rule), rule);
});
