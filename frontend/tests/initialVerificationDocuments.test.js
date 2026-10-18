import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let server, Documents;
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  Documents = (await server.ssrLoadModule('/src/components/InitialVerificationDocuments.jsx')).default;
});
after(async () => { await server?.close(); });
const documents = [
  { label: 'Certificate of Tax Exemption', requirementKey: 'tax_exemption', submitted: true, status: 'Approved', applicationId: 1, academicPeriodId: 10 },
  { label: 'Barangay Indigency (optional)', requirementKey: 'indigency', submitted: false, status: 'Not Submitted' },
  { label: 'Synthetic <ID>', requirementKey: 'valid_id', submitted: true, status: 'Rejected', applicationId: 1, academicPeriodId: 10 },
];
const intake = { schoolYear: '2027-2028', semester: '1st Semester', initialDocuments: documents };

test('initial verification matches the Scholar submissions panel structure and displays period metadata', () => {
  const html = renderToStaticMarkup(createElement(Documents, { intake, token: 'synthetic' }));
  for (const text of ['Document submissions', '2027-2028', '1st Semester', 'scholars-document-list', 'Initial · CAO upload · Attached', 'Synthetic &lt;ID&gt;']) assert.ok(html.includes(text), text);
  assert.equal((html.match(/class="scholars-document-entry"/g) || []).length, 3);
  assert.equal((html.match(/aria-label="View /g) || []).length, 2);
  assert.match(html, /class="approved">Approved/);
  assert.match(html, /class="not-submitted">Not Submitted/);
  assert.match(html, /class="rejected">Rejected/);
});
test('View retains the original authenticated application, requirement and period scope', () => {
  const tree = Documents({ intake, token: 'synthetic' });
  const rows = tree.props.children[2].props.children;
  const view = rows[0].props.children[1].props.children[1];
  assert.equal(view.props.endpoint, '/document-reviews/1/tax_exemption/file?academicPeriodId=10&submissionWave=initial');
  assert.equal(view.props.token, 'synthetic');
  assert.equal(rows[1].props.children[1].props.children[1], false);
});
test('document sets remain server-authoritative and unavailable files do not gain a View action', () => {
  const html = renderToStaticMarkup(createElement(Documents, { intake: { initialDocuments: [{ ...documents[0], applicationId: null }] } }));
  assert.equal((html.match(/scholars-document-entry/g) || []).length, 1);
  assert.doesNotMatch(html, /aria-label="View |Tuition|undefined/);
});
test('Results mounts the consistent panel without altering intake or acceptance gates', async () => {
  const source = await readFile(new URL('../src/ResultsManagement.jsx', import.meta.url), 'utf8');
  assert.match(source, /<InitialVerificationDocuments intake=\{intake\} token=\{token\}/);
  assert.doesNotMatch(source, /passer-intake-checklist/);
  assert.match(source, /\/passers\/\$\{selected.id\}\/intake/);
  assert.match(source, /!intake\?\.initialVerified/);
  const css = await readFile(new URL('../src/styles/initial-verification-documents.css', import.meta.url), 'utf8');
  for (const rule of ['border-radius: 10px', 'overflow-wrap: anywhere', 'flex-wrap: nowrap', 'white-space: nowrap', 'min-height: 44px']) assert.ok(css.includes(rule), rule);
});
