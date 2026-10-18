import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { containScholarProfileFocus } from '../src/utils/scholarMobileLayout.js';

let server, Navigation, Updates;
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  Navigation = (await server.ssrLoadModule('/src/components/ScholarMobileNavigation.jsx')).default;
  Updates = (await server.ssrLoadModule('/src/components/ScholarUpdates.jsx')).default;
});
after(async () => { await server?.close(); });

test('mobile quick links use three existing on-page destinations without new APIs or workflow actions', () => {
  const html = renderToStaticMarkup(createElement(Navigation));
  assert.match(html, /aria-label="Scholar portal quick links"/);
  assert.equal((html.match(/<a /g) || []).length, 3);
  for (const target of ['scholar-updates', 'requirements', 'scholar-summary']) assert.ok(html.includes(`href="#${target}"`));
  for (const label of ['Updates', 'Requirements', 'Summary']) assert.ok(html.includes(label));
  assert.doesNotMatch(html, /<button|href="https?:|onClick/);
});
test('update destination remains labelled and retains complete, safely escaped schedule/announcement content', () => {
  const message = 'Scholars have one week (7 days) only to claim their payout. <Synthetic notice>';
  const html = renderToStaticMarkup(createElement(Updates, { personal: { type: 'payout_schedule', title: 'Test notice', message }, announcement: { title: 'Test announcement', content: 'Full announcement content' } }));
  for (const value of ['id="scholar-updates"', 'tabindex="-1"', 'aria-labelledby="scholar-updates-title"', 'PAYOUT SCHEDULE UPDATE', 'one week (7 days)', '&lt;Synthetic notice&gt;', 'Full announcement content', 'Notification history']) assert.ok(html.includes(value), value);
});
test('mobile overrides are loaded last, scoped and do not impose the phone layout on desktop/admin portals', async () => {
  const css = await readFile(new URL('../src/styles/scholar-mobile.css', import.meta.url), 'utf8');
  const source = await readFile(new URL('../src/ScholarDashboard.jsx', import.meta.url), 'utf8');
  assert.ok(source.indexOf("import './styles/scholar-mobile.css'") > source.indexOf("import './styles/scholar-portal-layout.css'"));
  assert.match(css, /\.scholar-mobile-navigation \{ display: none; \}/);
  assert.match(css, /@media \(max-width: 760px\)/); assert.match(css, /@media \(max-width: 400px\)/);
  assert.doesNotMatch(css, /\.applicant-|\.admin-|body\s*\{/);
  assert.match(source, /application && <ScholarMobileNavigation/);
  assert.match(source, /id="scholar-summary"/); assert.match(source, /id="requirements"/);
});
test('phone document rows stack, preserve complete filenames and expose usable touch/focus targets', async () => {
  const css = await readFile(new URL('../src/styles/scholar-mobile.css', import.meta.url), 'utf8');
  for (const rule of ['grid-template-columns: minmax(0, 1fr)', 'white-space: normal', 'overflow-wrap: anywhere', 'flex-wrap: wrap', 'min-height: 44px', 'min-height: 48px', 'font-size: 16px', 'scholar-upload-button:focus-within']) assert.ok(css.includes(rule), rule);
  assert.doesNotMatch(css, /overflow-x:\s*hidden|zoom:|text-size-adjust:\s*none/);
  const source = await readFile(new URL('../src/ScholarDashboard.jsx', import.meta.url), 'utf8');
  for (const guard of ['requirementsSubmissionClosed || loadingRequirements || Boolean(uploadingRequirement)', 'academicPeriodId', 'submissionWave=initial', 'submissionWave=continuing', 'initialRequirements[key]?.fileName && <DocumentViewButton', 'accept=".pdf,.jpg,.jpeg,.png"']) assert.ok(source.includes(guard), guard);
});
test('long notification history and profile remain viewport-bounded with reachable close controls', async () => {
  const css = await readFile(new URL('../src/styles/scholar-mobile.css', import.meta.url), 'utf8');
  for (const rule of ['max-height: min(580px, calc(100dvh - 100px))', 'overflow-y: auto', 'overscroll-behavior: contain', 'height: 100dvh', 'env(safe-area-inset-bottom)', 'position: sticky', 'scroll-margin-top: 96px']) assert.ok(css.includes(rule), rule);
  const source = await readFile(new URL('../src/ScholarDashboard.jsx', import.meta.url), 'utf8');
  for (const marker of ['aria-controls="scholar-notification-history"', 'id="scholar-notification-history"', 'ref={profileDialog}', "document.body.style.overflow = 'hidden'", 'document.body.style.overflow = previousOverflow', 'previousFocus?.focus()', 'containScholarProfileFocus']) assert.ok(source.includes(marker), marker);
});
test('profile keyboard containment wraps in both directions and recovers outside/empty focus safely', () => {
  let focused, prevented;
  const first = { focus: () => { focused = 'first'; } }, last = { focus: () => { focused = 'last'; } };
  const dialog = { querySelectorAll: () => [first, last], contains: node => [first, last].includes(node), focus: () => { focused = 'dialog'; } };
  for (const [active, shiftKey, expected] of [[last, false, 'first'], [first, true, 'last'], [{}, false, 'first'], [{}, true, 'last']]) {
    focused = null; prevented = false;
    containScholarProfileFocus({ key: 'Tab', shiftKey, preventDefault: () => { prevented = true; } }, dialog, active);
    assert.equal(prevented, true); assert.equal(focused, expected);
  }
  focused = null; containScholarProfileFocus({ key: 'Enter' }, dialog, first); assert.equal(focused, null);
  containScholarProfileFocus({ key: 'Tab', preventDefault() {} }, { ...dialog, querySelectorAll: () => [] }, null); assert.equal(focused, 'dialog');
});
