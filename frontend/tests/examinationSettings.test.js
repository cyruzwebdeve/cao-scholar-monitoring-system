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
let SettingsManagement;
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  ({ default: SettingsTabs } = await server.ssrLoadModule('/src/components/SettingsTabs.jsx'));
  ({ default: OnlineQuestionsSettings } = await server.ssrLoadModule('/src/OnlineQuestionsSettings.jsx'));
  ({ default: SettingsManagement } = await server.ssrLoadModule('/src/SettingsManagement.jsx'));
});
after(async () => { await server?.close(); });

test('Settings exposes exactly General and Examination tabs with accessible panel relationships', () => {
  const html = renderToStaticMarkup(createElement(SettingsTabs, { activeTab: 'examination', onChange: () => {} }));
  assert.match(html, />General<\/button>/);
  assert.match(html, />Examination<\/button>/);
  assert.equal((html.match(/role="tab"/g) || []).length, 2);
  assert.doesNotMatch(html, /Online Questions|settings-tab-online|settings-tab-questions/);
  assert.match(html, /id="settings-tab-examination" aria-controls="settings-panel-examination" aria-selected="true" tabindex="0"/);
  assert.equal((html.match(/aria-selected="true"/g) || []).length, 1);
});

test('Examination panel contains delivery controls followed by the authorized question editor', () => {
  const html = renderToStaticMarkup(createElement(SettingsManagement, { token: '', user: { role: 'RegularAdmin' } }));
  const panelStart = html.indexOf('id="settings-panel-examination"');
  assert.ok(panelStart >= 0);
  const panel = html.slice(panelStart);
  assert.match(panel, /aria-labelledby="settings-tab-examination" hidden=""/);
  assert.ok(panel.indexOf('Online Examination</h3>') < panel.indexOf('Online Questions</h3>'));
  assert.match(panel, /online-questions-settings/);
  assert.doesNotMatch(html.slice(0, panelStart), /Online Questions<\/h3>|Online Examination<\/h3>/);
});

test('Billing staff retain two tabs but cannot see the question editor or enable delivery changes', () => {
  const html = renderToStaticMarkup(createElement(SettingsManagement, { token: '', user: { role: 'BillingPayrollAdmin' } }));
  assert.equal((html.match(/role="tab"/g) || []).length, 2);
  assert.doesNotMatch(html, /online-questions-settings|Online Questions<\/h3>/);
  assert.match(html, /<input type="checkbox" disabled=""/);
});

test('tab keyboard navigation supports arrows, Home and End with focus movement', () => {
  for (const [key, expected] of [['ArrowRight', 'examination'], ['ArrowLeft', 'examination'], ['Home', 'general'], ['End', 'examination']]) {
    let selected;
    let focused;
    let prevented = false;
    const node = SettingsTabs({ activeTab: 'general', onChange: (id) => { selected = id; } });
    node.props.onKeyDown({ key, preventDefault: () => { prevented = true; }, currentTarget: { querySelectorAll: () => ['general', 'examination'].map((id) => ({ focus: () => { focused = id; } })) } });
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
