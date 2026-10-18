import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { filterMetricRows, metricPage, scholarMetricRows, resultMetricRows, documentMetricRows, staffMetricRows, billingMetricRows } from '../src/utils/metricDetails.js';

let server, Card, Modal;
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  const module = await server.ssrLoadModule('/src/components/MetricDetailsCard.jsx'); Card = module.default; Modal = module.MetricRecordsModal;
});
after(async () => { await server?.close(); });
test('metric cards preserve their layout article and expose a native keyboard-accessible dialog button', () => {
  const html = renderToStaticMarkup(createElement(Card, { title: 'Active Scholars', className: 'blue' }, createElement('strong', {}, '27')));
  for (const value of ['<article', 'blue metric-details-card', '<strong>27</strong>', 'type="button"', 'aria-label="View Active Scholars records"', 'aria-haspopup="dialog"']) assert.ok(html.includes(value), value);
  const disabled = renderToStaticMarkup(createElement(Card, { title: 'Restricted', disabled: true }));
  assert.match(disabled, /disabled=""/);
});
test('record modal is labelled, searchable, paginated and safely escapes personal text', () => {
  const html = renderToStaticMarkup(createElement(Modal, { title: 'Active Scholars', rows: Array.from({ length: 27 }, (_, id) => ({ id, name: `Synthetic <Scholar> ${id}`, status: 'Active' })) }));
  for (const value of ['<dialog', 'aria-modal="true"', 'aria-labelledby="metric-records-title"', 'aria-describedby="metric-records-description"', 'Search Active Scholars', '27 records', 'Page 1 of 2', 'Previous', 'Next', 'Close', 'Synthetic &lt;Scholar&gt; 0']) assert.ok(html.includes(value), value);
  assert.doesNotMatch(html, /<Scholar>/);
  assert.equal((html.match(/<tbody>[\s\S]*?<\/tbody>/)?.[0].match(/<tr>/g) || []).length, 25);
});
test('empty and remote-loading categories never fabricate records or present page-only totals as complete', () => {
  const empty = renderToStaticMarkup(createElement(Modal, { title: 'None', rows: [] }));
  assert.match(empty, /No records in this category yet/); assert.match(empty, /0 records/);
  const loading = renderToStaticMarkup(createElement(Modal, { title: 'Active Scholars', endpoint: '/dashboard/metrics/activeScholars' }));
  assert.match(loading, /Loading records/); assert.doesNotMatch(loading, /0 records|No records in this category/);
});
test('search uses only displayed columns and pagination retains all records across pages', () => {
  const rows = Array.from({ length: 61 }, (_, id) => ({ id, name: `Test ${id}`, hidden: 'private' }));
  assert.equal(filterMetricRows(rows, 'private', [{ key: 'name' }]).length, 0);
  assert.equal(filterMetricRows(rows, '  TEST 1 ', [{ key: 'name' }]).length, 11);
  const all = [1, 2, 3].flatMap(page => metricPage(rows, page).rows);
  assert.deepEqual(all, rows); assert.equal(metricPage(rows, 99).page, 3); assert.equal(metricPage([], 9).page, 1);
});
test('scholar and examination drill-downs match each metric predicate rather than the current directory page', () => {
  const scholars = [{ id: 1, status: 'Active', documentStatus: 'Complete' }, { id: 2, status: 'Inactive', documentStatus: 'Review' }];
  assert.deepEqual(scholarMetricRows(scholars, 'Active Scholars').map(row => row.id), [1]);
  assert.deepEqual(scholarMetricRows(scholars, 'Documents Complete').map(row => row.id), [1]);
  assert.deepEqual(scholarMetricRows(scholars, 'For Review').map(row => row.id), [2]);
  const results = ['For review', 'Passed', 'Failed', 'Pending'].map(status => ({ status }));
  for (const [label, expected] of [['Total Records', 4], ['Scored', 2], ['Passed', 1], ['Failed', 1], ['For Review', 1]]) assert.equal(resultMetricRows(results, label).length, expected);
});
test('staff, document and list-preparation predicates retain exact state distinctions', () => {
  const staff = [{ isActive: true, role: 'SuperAdmin' }, { isActive: false, role: 'SuperAdmin' }, { isActive: true, role: 'RegularAdmin' }];
  assert.equal(staffMetricRows(staff, 'Provincial admins').length, 1); assert.equal(staffMetricRows(staff, 'Inactive staff').length, 1);
  const files = ['pending', 'approved', 'rejected'].map(status => ({ status }));
  for (const label of ['Pending review', 'Approved', 'Rejected']) assert.equal(documentMetricRows(files, label).length, 1);
  const records = [{ inPayroll: true, billed: false }, { inPayroll: false, billed: true }];
  for (const label of ['For Payroll', 'In Payroll', 'Generated Lists', 'For Certification', 'Certification Listed']) assert.equal(billingMetricRows(records, label).length, 1);
});
test('native dialog handles focus/scroll restoration, Escape and aborted or stale requests', async () => {
  const source = await readFile(new URL('../src/components/MetricDetailsCard.jsx', import.meta.url), 'utf8');
  for (const marker of ['element.showModal()', 'element.close()', 'previous?.focus()', "document.body.style.overflow = overflow", 'onCancel=', 'controller.abort()', 'controller.signal.aborted', 'remote?.requestKey === requestKey', 'response.status === 403', 'response.status === 401', 'Retry']) assert.ok(source.includes(marker), marker);
  const css = await readFile(new URL('../src/styles/metric-details.css', import.meta.url), 'utf8');
  for (const marker of ['::backdrop', ':focus-visible', 'overflow-x: auto', '100dvh', '@media(max-width: 600px)']) assert.ok(css.includes(marker), marker);
});
test('all operational summary card sections use the common read-only modal; restricted dashboard directories stay disabled', async () => {
  for (const filename of ['Dashboard', 'ScholarsManagement', 'ResultsManagement', 'BillingPayrollManagement', 'DocumentReviewManagement', 'StaffManagement', 'AnnouncementsManagement', 'ReportsManagement', 'ActivityLogsManagement']) {
    const source = await readFile(new URL(`../src/${filename}.jsx`, import.meta.url), 'utf8'); assert.ok(source.includes('<MetricDetailsCard'), filename);
  }
  const dashboard = await readFile(new URL('../src/Dashboard.jsx', import.meta.url), 'utf8');
  assert.match(dashboard, /!overview\.metricAccess\[stat\.metric\]/); assert.match(dashboard, /data\.metricRecords/);
});


test('record dialog explicitly centers in the viewport despite global margin resets', async () => {
  const css = await readFile(new URL('../src/styles/metric-details.css', import.meta.url), 'utf8');
  const dialogRule = css.match(/\.metric-records-modal \{([^}]+)\}/)[1];
  for (const declaration of ['position: fixed', 'inset: 0', 'margin: auto', 'overflow: auto', 'max-height: calc(100dvh - 40px)', 'width: min(900px, calc(100vw - 32px))']) assert.ok(dialogRule.includes(declaration), declaration);
});
