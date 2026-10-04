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

test('Payroll shows the saved school and classification as read-only text', () => {
  const html = render({ schoolId: 1, school: 'TEST PUBLIC SCHOOL', schoolType: 'Public' });
  assert.match(html, /TEST PUBLIC SCHOOL/);
  assert.match(html, /Auto-identified · Public/);
  assert.match(html, /Recorded school for TEST SCHOLAR/);
  assert.doesNotMatch(html, /<select|<button|<input|Select school|identification incomplete/);
});

test('unmatched and unclassified saved schools show correction guidance, never a manual selector', () => {
  for (const schoolId of [null, 1]) {
    const html = render({ schoolId, school: 'TEST UNKNOWN SCHOOL', schoolType: 'Unclassified' });
    assert.match(html, /TEST UNKNOWN SCHOOL/);
    assert.match(html, /School identification incomplete/);
    assert.match(html, /correct the scholar record or School Catalog/);
    assert.doesNotMatch(html, /Auto-identified|<select|<button|<input/);
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
  assert.match(second, /Auto-identified · Private/);
  assert.doesNotMatch(second, /FIRST SCHOOL/);
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
