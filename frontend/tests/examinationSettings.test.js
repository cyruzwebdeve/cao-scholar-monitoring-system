import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test, { after, before } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let server;
let SettingsTabs;
let OnlineQuestionsSettings;
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  ({ default: SettingsTabs } = await server.ssrLoadModule('/src/components/SettingsTabs.jsx'));
  ({ default: OnlineQuestionsSettings } = await server.ssrLoadModule('/src/OnlineQuestionsSettings.jsx'));
});
after(async () => { await server?.close(); });

test('Settings exposes separate online controls and question tabs with accessible panel relationships', () => {
  const html = renderToStaticMarkup(createElement(SettingsTabs, { activeTab: 'online', onChange: () => {}, canManageQuestions: true }));
  assert.match(html, /General &amp; Face-to-face/);
  assert.match(html, /Online Examination/);
  assert.match(html, /Online Questions/);
  assert.match(html, /id="settings-tab-online" aria-controls="settings-panel-online" aria-selected="true" tabindex="0"/);
  assert.equal((html.match(/aria-selected="true"/g) || []).length, 1);
});

test('staff without question-editing permission have no Online Questions tab', () => {
  const html = renderToStaticMarkup(createElement(SettingsTabs, { activeTab: 'general', onChange: () => {}, canManageQuestions: false }));
  assert.doesNotMatch(html, /Online Questions|settings-tab-questions/);
});

test('tab keyboard navigation supports arrows, Home and End with focus movement', () => {
  for (const [key, expected] of [['ArrowRight', 'online'], ['ArrowLeft', 'questions'], ['Home', 'general'], ['End', 'questions']]) {
    let selected;
    let focused;
    let prevented = false;
    const node = SettingsTabs({ activeTab: 'general', canManageQuestions: true, onChange: (id) => { selected = id; } });
    node.props.onKeyDown({ key, preventDefault: () => { prevented = true; }, currentTarget: { querySelectorAll: () => ['general', 'online', 'questions'].map((id) => ({ focus: () => { focused = id; } })) } });
    assert.equal(selected, expected);
    assert.equal(focused, expected);
    assert.equal(prevented, true);
  }
});

test('question configuration clearly discloses versioning, scale and legacy grading limits', () => {
  const html = renderToStaticMarkup(createElement(OnlineQuestionsSettings, { token: '', active: false }));
  assert.match(html, /new version/);
  assert.match(html, /20 points/);
  assert.match(html, /not correctness or a human assessment/);
  assert.match(html, /does not activate online delivery/);
});

test('portal consumes authoritative review status while retaining attendance as a separate field', async () => {
  const source = await readFile(new URL('../src/ApplicantDashboard.jsx', import.meta.url), 'utf8');
  assert.match(source, /applicationStatus = examination\?\.status/);
  assert.match(source, /examination\?\.attendance\?\.status/);
  assert.match(source, /examinationAttendanceRevision/);
  assert.match(source, /does not mean the examination is completed or passed/);
});

test('question page supports non-contiguous IDs and submits its version ticket, not a computed score', async () => {
  const source = await readFile(new URL('../src/ExamPage.jsx', import.meta.url), 'utf8');
  assert.match(source, /setActiveIndex\(index\)/);
  assert.doesNotMatch(source, /setActiveIndex\(q\.id - 1\)/);
  assert.match(source, /JSON\.stringify\(\{ answers, examTicket \}\)/);
  assert.match(source, /disabled=\{submitting\}/);
});
