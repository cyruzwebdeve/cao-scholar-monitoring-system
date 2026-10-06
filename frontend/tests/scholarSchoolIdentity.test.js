import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test, { after, before } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let server;
let ScholarSchoolIdentity;
before(async () => {
  server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)),
    server: { middlewareMode: true },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  ({ default: ScholarSchoolIdentity } = await server.ssrLoadModule('/src/components/ScholarSchoolIdentity.jsx'));
});
after(async () => { await server?.close(); });

const render = (record) => renderToStaticMarkup(createElement(ScholarSchoolIdentity, { record: { name: 'TEST SCHOLAR', ...record } }));

test('Payroll shows only the saved school as read-only text without a classification subtitle', () => {
  const html = render({ schoolId: 1, school: 'TEST PUBLIC SCHOOL', schoolType: 'Public' });
  assert.match(html, /TEST PUBLIC SCHOOL/);
  assert.match(html, /Recorded school for TEST SCHOLAR/);
  assert.doesNotMatch(html, /<select|<button|<input|<span|Select school|Auto-identified|identification incomplete/);
});

test('Billing shows the recorded Private school without email or classification captions', () => {
  const html = render({ schoolId: 2, school: 'TEST PRIVATE SCHOOL', schoolType: 'Private', email: 'test@example.com' });
  assert.match(html, /TEST PRIVATE SCHOOL/);
  assert.match(html, /Recorded school for TEST SCHOLAR/);
  assert.doesNotMatch(html, /test@example.com|Auto-identified|<span|<select|<input/);
});

test('unmatched and unclassified saved schools retain their name without extra subtitles', () => {
  for (const schoolId of [null, 1]) {
    const html = render({ schoolId, school: 'TEST UNKNOWN SCHOOL', schoolType: 'Unclassified' });
    assert.match(html, /TEST UNKNOWN SCHOOL/);
    assert.doesNotMatch(html, /Auto-identified|School identification incomplete|School Catalog|<select|<button|<input|<span/);
  }
});

test('missing schools and stale classifications are not presented as identified', () => {
  for (const school of [undefined, '', 'Not specified']) {
    const html = render({ school, schoolType: 'Public' });
    assert.match(html, /No school recorded/);
    assert.doesNotMatch(html, /Auto-identified/);
  }
  assert.doesNotMatch(render({ school: 'TEST SCHOOL', schoolType: 'Public' }), /Auto-identified/);
});

test('school display is record-specific and safely escapes database text', () => {
  const first = render({ schoolId: 1, school: 'FIRST SCHOOL', schoolType: 'Public' });
  const second = render({ schoolId: 2, school: '<SECOND SCHOOL>', schoolType: 'Private' });
  assert.doesNotMatch(first, /SECOND SCHOOL/);
  assert.match(second, /&lt;SECOND SCHOOL&gt;/);
  assert.doesNotMatch(second, /Auto-identified|Private/);
  assert.doesNotMatch(second, /FIRST SCHOOL/);
});

test('Billing and Payroll source rows share name-and-school-only identity and retain controls', async () => {
  const source = await readFile(new URL('../src/BillingPayrollManagement.jsx', import.meta.url), 'utf8');
  const rows = source.slice(source.indexOf('{sourceRecords.map((record)'), source.indexOf('<nav className="billing-transfer-controls"'));
  assert.match(rows, /<strong>\{record.name\}<\/strong><\/button>/);
  assert.match(rows, /<ScholarSchoolIdentity record=\{record\} \/>/);
  assert.doesNotMatch(rows, /record.email|<small>|isPayroll && <ScholarSchoolIdentity/);
  assert.match(rows, /aria-pressed=\{isSelected\}/);
  assert.match(rows, /\{statusLabel\}<\/span>/);
  assert.match(rows, /openProcessingOverride\(record\)/);
  assert.match(rows, /openBillingEditor\(record\)/);
});

test('Billing and Payroll share tighter source spacing without changing target-queue spacing', async () => {
  const source = await readFile(new URL('../src/BillingPayrollManagement.jsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/styles/admin.css', import.meta.url), 'utf8');
  assert.match(source, /className="billing-queue-table billing-source-table"/);
  assert.match(css, /\.billing-source-table \.billing-queue-name \{ min-height: 32px; \}/);
  assert.match(css, /\.billing-queue-row > button \{ min-height: 40px;/);
});

test('Payroll cannot open, save, or render the shared Billing school editor', async () => {
  const source = await readFile(new URL('../src/BillingPayrollManagement.jsx', import.meta.url), 'utf8');
  assert.match(source, /const openBillingEditor = \(record\) => \{\s+if \(isPayroll\) return;/);
  assert.match(source, /if \(isPayroll \|\| !billingEditor \|\| billingSaving\) return;/);
  assert.match(source, /\{!isPayroll && billingEditor &&/);
  assert.match(source, /<ScholarSchoolIdentity record=\{record\} \/>/);
  assert.doesNotMatch(source, /Use saved school details for/);
  assert.match(source, /!isPayroll && !record.isArchivedPeriod && !record.billed && <button/);
});
