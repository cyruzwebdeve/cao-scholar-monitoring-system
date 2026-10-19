import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
let server, Directory;
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  Directory = (await server.ssrLoadModule('/src/PotentialScholars.jsx')).PotentialScholarDirectory;
});
after(async () => { await server?.close(); });
const applicants = Array.from({ length: 13 }, (_, i) => ({ id: i + 1, name: `Synthetic <Applicant> ${i + 1}`, controlNo: `TEST-${i + 1}`, municipality: 'Test place', school: 'Synthetic College', initialVerified: i % 2 === 0 }));
const render = (props = {}) => renderToStaticMarkup(createElement(Directory, { applicants, query: '', verification: 'all', onQuery() {}, onVerification() {}, onReview() {}, onPage() {}, ...props }));
test('directory distinguishes potential status from official approval and safely renders search, verification and named review controls', () => {
  const html = render();
  for (const text of ['Potential scholar', '13 of 13 applicants', 'Search potential scholars', 'Document verification', 'Verified · awaiting administrator approval', 'Complete submission · verification pending', 'Synthetic &lt;Applicant&gt;', 'Review for approval', 'aria-label="Review Synthetic']) assert.ok(html.includes(text), text);
  assert.equal((html.match(/Review for approval<\/button>/g) || []).length, 10);
  assert.match(html, /Page 1 of 2/);
});
test('combined text and verification filters retain only matching candidates; page two retains remaining applicants', () => {
  const verified = render({ query: 'TEST-1', verification: 'verified' }); assert.match(verified, /3 of 13 applicants/);
  const empty = render({ query: 'no-match' }); assert.match(empty, /No potential scholars match/); assert.doesNotMatch(empty, /Review for approval/);
  const page2 = render({ page: 2 }); assert.match(page2, /Page 2 of 2/); assert.equal((page2.match(/Review for approval<\/button>/g) || []).length, 3);
});
test('read-only staff receive approval guidance and stale data disables review rather than offering a write', () => {
  const readonly = render({ onReview: undefined }); assert.match(readonly, /Administrator with examination access must review/); assert.doesNotMatch(readonly, /Review for approval/);
  assert.equal((render({ reviewDisabled: true }).match(/disabled="" aria-label="Review/g) || []).length, 10);
  assert.match(render({ applicants: [] }), /No applicants currently have a complete set/);
});
