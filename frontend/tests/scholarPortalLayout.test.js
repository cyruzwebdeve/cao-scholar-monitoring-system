import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { buildScholarNextStep as step, getRequirementReviewStatus as status } from '../src/utils/scholarPortalLayout.js';

let server, Next, Updates, Tabs;
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  Next = (await server.ssrLoadModule('/src/components/ScholarNextStep.jsx')).default;
  Updates = (await server.ssrLoadModule('/src/components/ScholarUpdates.jsx')).default;
  Tabs = (await server.ssrLoadModule('/src/components/ScholarRequirementsTabs.jsx')).default;
});
after(async () => { await server?.close(); });

test('document status aliases preserve existing review semantics', () => {
  assert.equal(status({ status: 'approved' }), 'missing');
  for (const value of ['approved', 'complete', 'completed']) assert.equal(status({ fileName: 'test.pdf', status: value }), 'approved');
  for (const value of ['rejected', 'declined']) assert.equal(status({ fileName: 'test.pdf', status: value }), 'rejected');
  assert.equal(status({ fileName: 'test.pdf' }), 'pending');
});
test('next step never invites an upload while loading, unavailable, or closed', () => {
  assert.equal(step({ loading: true }).action, undefined);
  assert.equal(step({ error: true }).action, undefined);
  assert.equal(step({ continuingOpen: false }).tab, 'initial');
  assert.equal(step({ continuingOpen: true, uploadsClosed: true, rejectedCount: 1 }).action, 'View requirements');
});
test('next step prioritizes corrections, missing documents, review, and final list status', () => {
  assert.equal(step({ continuingOpen: true, rejectedCount: 1, missingCount: 1 }).action, 'Review returned documents');
  assert.equal(step({ continuingOpen: true, missingCount: 1 }).action, 'Upload missing documents');
  assert.equal(step({ continuingOpen: true, pendingReviewCount: 1 }).action, 'View submitted documents');
  assert.equal(step({ continuingOpen: true, requirementsComplete: true }).title, 'Your continuing documents are approved');
  assert.equal(step({ continuingOpen: true, requirementsComplete: true, listed: true }).title, 'You are up to date');
});
test('next step renders one primary action and an optional progress disclosure', () => {
  const html = renderToStaticMarkup(createElement(Next, { step: step({ continuingOpen: true, missingCount: 1 }), timeline: [{ id: 'initial', status: 'completed', label: 'Initial review', detail: 'Verified' }] }));
  assert.equal((html.match(/href="#requirements"/g) || []).length, 1);
  assert.match(html, /<details/); assert.match(html, /View application progress/);
});
test('updates combine personal and general notices safely without legacy money details', () => {
  const html = renderToStaticMarkup(createElement(Updates, { personal: { type: 'payout_schedule', title: '<script>test</script>', message: 'Read CAO instructions', amount: 9999, processedAt: '2026-10-18' }, announcement: { title: 'Office update', content: 'Bring documents', priority: 'urgent', externalUrl: 'https://www.facebook.com/', imageData: 'data:image/png;base64,AA==', imageName: 'Office notice' } }));
  for (const text of ['PAYOUT SCHEDULE UPDATE', 'CAO ANNOUNCEMENT', 'Urgent', 'Notification history', '&lt;script&gt;', 'noopener noreferrer', 'loading="lazy"']) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /9999|Processed|<script>/);
  assert.match(renderToStaticMarkup(createElement(Updates)), /No new updates to show/);
});
test('requirement tabs expose keyboard navigation and proper selection semantics', () => {
  const html = renderToStaticMarkup(createElement(Tabs, { activeTab: 'continuing' }));
  assert.equal((html.match(/role="tab"/g) || []).length, 2);
  assert.match(html, /id="scholar-tab-continuing"[^>]*aria-selected="true"[^>]*aria-controls="scholar-panel-continuing"[^>]*tabindex="0"/);
  const tree = Tabs({ activeTab: 'initial', onChange: value => { selected = value; } });
  let selected, focused;
  for (const [key, expected] of [['ArrowRight', 'continuing'], ['ArrowLeft', 'continuing'], ['End', 'continuing'], ['Home', 'initial']]) {
    tree.props.onKeyDown({ key, preventDefault() {}, currentTarget: { querySelectorAll: () => [{ focus() { focused = 'initial'; } }, { focus() { focused = 'continuing'; } }] } });
    assert.equal(selected, expected); assert.equal(focused, expected);
  }
});
test('redesign retains upload guards, period scoping, history, and profile dialog', async () => {
  const source = await readFile(new URL('../src/ScholarDashboard.jsx', import.meta.url), 'utf8');
  for (const text of ['academicPeriodId', 'requirementsSubmissionClosed || loadingRequirements || Boolean(uploadingRequirement)', "key !== 'tuition_receipt' || isPrivateRequirementPeriod", 'scholarNotifications.map', 'setProfileOpen(true)', 'role="dialog"', 'hidden={activeRequirementsTab']) assert.ok(source.includes(text), text);
  assert.doesNotMatch(source, /Your payout schedules|scholar-profile-card/);
});

test('individual capture sends only the selected document and preserves other drafts', async () => {
  const source = await readFile(new URL('../src/InitialRequirementCapture.jsx', import.meta.url), 'utf8');
  const publish = source.slice(source.indexOf('const publish ='), source.indexOf('const ready ='));
  assert.match(publish, /captureDocumentReady\(key, draftsRef.current, saved\)/);
  assert.match(publish, /const item = draftsRef.current\[key\]/);
  assert.match(publish, /delete next\[key\]/);
  assert.doesNotMatch(publish, /for \(|captureReady\(|pending.push/);
  assert.doesNotMatch(source, /confirmed|setConfirmed|capture-confirm|type="checkbox"/);
  assert.match(source, /disabled=\{working \|\| phoneConnected \|\| !ready/);
  assert.match(source, /if \(!captureDocumentReady\(key, draftsRef.current, saved\)\)/);
  assert.match(source, /Upload &amp; approve this document|Upload & approve this document/);
});

test('view controls are authenticated and available to staff, applicants, and scholars only for saved files', async () => {
  const Viewer = (await server.ssrLoadModule('/src/components/DocumentViewButton.jsx')).default;
  const html = renderToStaticMarkup(createElement(Viewer, { label: 'Valid ID', endpoint: '/applications/me/requirements/valid_id/file', token: 'synthetic-token' }));
  assert.match(html, /aria-label="View Valid ID"/);
  assert.doesNotMatch(html, /synthetic-token|<iframe|applications\/me/);
  const source = await readFile(new URL('../src/components/DocumentViewButton.jsx', import.meta.url), 'utf8');
  for (const guard of ['authHeaders(token)', 'URL.revokeObjectURL(url)', 'controller.abort()', "cache: 'no-store'", "'application/pdf', 'image/jpeg', 'image/png'", 'aria-modal="true"']) assert.ok(source.includes(guard), guard);
  for (const [file, guard] of [['ApplicantDashboard.jsx', 'document.fileName && <DocumentViewButton'], ['ScholarDashboard.jsx', 'initialRequirements[key]?.fileName && <DocumentViewButton'], ['ResultsManagement.jsx', 'document.submitted && <DocumentViewButton'], ['InitialRequirementCapture.jsx', 'selected?.submitted && selected.applicationId && <DocumentViewButton']]) {
    const screen = await readFile(new URL(`../src/${file}`, import.meta.url), 'utf8'); assert.ok(screen.includes(guard), file);
  }
});
