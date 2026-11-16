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
let Sidebar;
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  ({ default: SettingsTabs } = await server.ssrLoadModule('/src/components/SettingsTabs.jsx'));
  ({ default: OnlineQuestionsSettings } = await server.ssrLoadModule('/src/OnlineQuestionsSettings.jsx'));
  ({ default: SettingsManagement } = await server.ssrLoadModule('/src/SettingsManagement.jsx'));
  ({ default: Sidebar } = await server.ssrLoadModule('/src/components/Sidebar.jsx'));
});
after(async () => { await server?.close(); });

test('Settings groups controls into accessible tabs with administrator-only maintenance sections', () => {
  const html = renderToStaticMarkup(createElement(SettingsTabs, { activeTab: 'examination', onChange: () => {} }));
  for (const label of ['Applications', 'Academic Year', 'Requirements', 'Examination']) assert.ok(html.includes(`>${label}</button>`), label);
  assert.equal((html.match(/role="tab"/g) || []).length, 4);
  assert.doesNotMatch(html, /General|School Catalog|System Health|Online Questions|settings-tab-online|settings-tab-questions/);
  assert.match(html, /id="settings-tab-examination" aria-controls="settings-panel-examination" aria-selected="true" tabindex="0"/);
  assert.equal((html.match(/aria-selected="true"/g) || []).length, 1);
  const admin = renderToStaticMarkup(createElement(SettingsTabs, { activeTab: 'schools', showAdminTabs: true, onChange: () => {} }));
  assert.equal((admin.match(/role="tab"/g) || []).length, 6);
  for (const [id, label] of [['schools', 'School Catalog'], ['system', 'System Health']]) {
    assert.match(admin, new RegExp(`id="settings-tab-${id}" aria-controls="settings-panel-${id}"`));
    assert.ok(admin.includes(`>${label}</button>`), label);
  }
  assert.match(admin, /id="settings-tab-schools" aria-controls="settings-panel-schools" aria-selected="true" tabindex="0"/);
  const adminSettings = renderToStaticMarkup(createElement(SettingsManagement, { token: '', user: { role: 'SuperAdmin' } }));
  assert.equal((adminSettings.match(/role="tab"/g) || []).length, 6);
  assert.equal((adminSettings.match(/role="tabpanel"/g) || []).length, 6);
  assert.equal((adminSettings.match(/role="tabpanel"[^>]*hidden=""/g) || []).length, 5);
  for (const id of ['schools', 'system']) assert.match(adminSettings, new RegExp(`id="settings-panel-${id}" role="tabpanel" aria-labelledby="settings-tab-${id}"`));
});

test('Examination panel contains delivery controls followed by the authorized question editor', () => {
  const html = renderToStaticMarkup(createElement(SettingsManagement, { token: '', user: { role: 'RegularAdmin' } }));
  const panelStart = html.indexOf('id="settings-panel-examination"');
  assert.ok(panelStart >= 0);
  const panel = html.slice(panelStart);
  assert.match(panel, /aria-labelledby="settings-tab-examination" tabindex="0" hidden=""/);
  assert.ok(panel.indexOf('Online Examination</h3>') < panel.indexOf('Online Questions</h3>'));
  assert.match(panel, /online-questions-settings/);
  assert.doesNotMatch(html.slice(0, panelStart), /Online Questions<\/h3>|Online Examination<\/h3>/);
  for (const id of ['applications', 'academic-year', 'requirements', 'examination']) {
    assert.match(html, new RegExp(`id="settings-tab-${id}" aria-controls="settings-panel-${id}"`));
    assert.match(html, new RegExp(`id="settings-panel-${id}" role="tabpanel" aria-labelledby="settings-tab-${id}"`));
  }
  assert.equal((html.match(/role="tabpanel"/g) || []).length, 4);
  assert.equal((html.match(/role="tabpanel"[^>]*hidden=""/g) || []).length, 3);
  const applicationStart = html.indexOf('id="settings-panel-applications"');
  const academicStart = html.indexOf('id="settings-panel-academic-year"');
  const requirementsStart = html.indexOf('id="settings-panel-requirements"');
  assert.ok(applicationStart >= 0 && applicationStart < academicStart && academicStart < requirementsStart && requirementsStart < panelStart);
  const academic = html.slice(academicStart, requirementsStart);
  assert.match(academic, /Intake school year and semester/);
  assert.match(academic, /School year and semester/);
  assert.doesNotMatch(html.slice(applicationStart, academicStart), /Intake school year and semester/);
});

test('Billing can manage visible Settings controls while question editor and hidden panels stay hidden', () => {
  const html = renderToStaticMarkup(createElement(SettingsManagement, { token: '', user: { role: 'BillingPayrollAdmin' } }));
  assert.equal((html.match(/role="tab"/g) || []).length, 4);
  assert.equal((html.match(/role="tabpanel"/g) || []).length, 4);
  assert.equal((html.match(/role="tabpanel"[^>]*hidden=""/g) || []).length, 3);
  assert.doesNotMatch(html, /online-questions-settings|Online Questions<\/h3>/);
  assert.match(html, /Save application/);
  assert.match(html, /Save examination setting/);
  assert.doesNotMatch(html, /school-catalog|System Health|settings-availability-readonly/);
});

test('tab keyboard navigation supports arrows, Home and End with focus movement', () => {
  for (const [activeTab, showAdminTabs, key, expected] of [
    ['applications', false, 'ArrowRight', 'academic-year'],
    ['applications', false, 'ArrowLeft', 'examination'],
    ['academic-year', false, 'ArrowRight', 'requirements'],
    ['requirements', false, 'ArrowLeft', 'academic-year'],
    ['examination', false, 'ArrowRight', 'applications'],
    ['examination', false, 'Home', 'applications'],
    ['applications', false, 'End', 'examination'],
    ['applications', true, 'ArrowLeft', 'system'],
    ['system', true, 'ArrowRight', 'applications'],
    ['schools', true, 'Home', 'applications'],
    ['applications', true, 'End', 'system'],
  ]) {
    let selected;
    let focused;
    let prevented = false;
    const tabs = ['applications', 'academic-year', 'requirements', 'examination', ...(showAdminTabs ? ['schools', 'system'] : [])];
    const node = SettingsTabs({ activeTab, showAdminTabs, onChange: (id) => { selected = id; } });
    node.props.onKeyDown({ key, preventDefault: () => { prevented = true; }, currentTarget: { querySelectorAll: () => tabs.map((id) => ({ focus: () => { focused = id; } })) } });
    assert.equal(selected, expected);
    assert.equal(focused, expected);
    assert.equal(prevented, true);
  }
});

test('Billing without Settings assignment stays read-only and its sidebar retains hidden sections', () => {
  const html = renderToStaticMarkup(createElement(SettingsManagement, { token: '', user: { role: 'BillingPayrollAdmin', sectionAccess: [] } }));
  assert.doesNotMatch(html, /Save application setting|Online Questions<\/h3>/);
  assert.match(html, /settings-availability-readonly/);
  const sidebar = renderToStaticMarkup(createElement(Sidebar, { role: 'BillingPayrollAdmin', sectionAccess: ['scholars', 'settings'] }));
  assert.match(sidebar, />Scholars<|>Settings</);
  assert.doesNotMatch(sidebar, />Staff<|>Activity Logs<|>School Catalog<|>Payroll<|>Billing</);
});

test('question configuration clearly discloses versioning, scale and required objective grading', () => {
  const html = renderToStaticMarkup(createElement(OnlineQuestionsSettings, { token: '', active: false }));
  assert.match(html, /new version/);
  assert.match(html, /20 points/);
  assert.match(html, /Essays and completion credit are not supported/);
  assert.match(html, /Identification requires accepted answers/);
  assert.match(html, /does not activate online delivery/);
});

test('portal consumes authoritative review status while retaining attendance as a separate field', async () => {
  const source = await readFile(new URL('../src/ApplicantDashboard.jsx', import.meta.url), 'utf8');
  assert.match(source, /getApplicantExaminationSummary/);
  assert.match(source, /examination\?\.attendance\?\.status/);
  assert.match(source, /examinationAttendanceRevision/);
  assert.match(source, /Examination status/);
});

test('question page supports non-contiguous IDs and submits its version ticket, not a computed score', async () => {
  const source = await readFile(new URL('../src/ExamPage.jsx', import.meta.url), 'utf8');
  assert.match(source, /setActiveIndex\(index\)/);
  assert.doesNotMatch(source, /setActiveIndex\(q\.id - 1\)/);
  assert.match(source, /JSON\.stringify\(\{ answers, examTicket \}\)/);
  assert.match(source, /disabled=\{submitting\}/);
});
