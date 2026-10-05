import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test, { after, before } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let server;
let PayrollSchoolIdentity;
before(async () => {
  server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)),
    server: { middlewareMode: true },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  ({ default: PayrollSchoolIdentity } = await server.ssrLoadModule('/src/components/PayrollSchoolIdentity.jsx'));
});
after(async () => { await server?.close(); });

const render = (record) => renderToStaticMarkup(createElement(PayrollSchoolIdentity, { record: { name: 'TEST SCHOLAR', ...record } }));

test('Payroll shows only the saved school as read-only text without a classification subtitle', () => {
  const html = render({ schoolId: 1, school: 'TEST PUBLIC SCHOOL', schoolType: 'Public' });
  assert.match(html, /TEST PUBLIC SCHOOL/);
  assert.match(html, /Recorded school for TEST SCHOLAR/);
  assert.doesNotMatch(html, /<select|<button|<input|<span|Select school|Auto-identified|identification incomplete/);
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

test('Payroll name rows hide the email subtitle while Billing keeps its existing subtitle', async () => {
  const source = await readFile(new URL('../src/BillingPayrollManagement.jsx', import.meta.url), 'utf8');
  assert.match(source, /<strong>\{record.name\}<\/strong>\{!isPayroll && <small>\{isSelected \? 'Selected' : canOverride \? 'Click to authorize override' : record.email\}<\/small>\}/);
  assert.match(source, /aria-pressed=\{isSelected\}/);
  assert.match(source, /\{statusLabel\}<\/span>/);
});

test('Payroll cannot open, save, or render the shared Billing school editor', async () => {
  const source = await readFile(new URL('../src/BillingPayrollManagement.jsx', import.meta.url), 'utf8');
  assert.match(source, /const openBillingEditor = \(record\) => \{\s+if \(isPayroll\) return;/);
  assert.match(source, /if \(isPayroll \|\| !billingEditor \|\| billingSaving\) return;/);
  assert.match(source, /\{!isPayroll && billingEditor &&/);
  assert.match(source, /\{isPayroll && <PayrollSchoolIdentity record=\{record\} \/>\}/);
  assert.doesNotMatch(source, /Use saved school details for/);
  assert.match(source, /!isPayroll && !record.isArchivedPeriod && !record.billed && <button/);
});
