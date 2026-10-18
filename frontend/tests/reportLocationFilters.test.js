import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { getReportBarangayOptions, matchesReportLocation, getReportLocationLevel } from '../src/utils/reportLocationFilters.js';

const barangays = [
  { code: 'a2', municipalityCode: 'a', name: 'Zulu' },
  { code: 'b1', municipalityCode: 'b', name: 'Common' },
  { code: 'a1', municipalityCode: 'a', name: 'Common' },
];
const rows = [
  { id: 'a', municipalityCode: 'a', type: 'Municipality', count: 2 },
  ...barangays.map(row => ({ id: row.code, municipalityCode: row.municipalityCode, type: 'Barangay', count: 0 })),
];

test('barangay options require a municipality and include its zero-coverage locations', () => {
  assert.deepEqual(getReportBarangayOptions(barangays, ''), []);
  assert.deepEqual(getReportBarangayOptions(barangays, 'missing'), []);
  assert.deepEqual(getReportBarangayOptions(barangays, 'a').map(row => row.code), ['a1', 'a2']);
  assert.deepEqual(barangays.map(row => row.code), ['a2', 'b1', 'a1']);
});
test('separate filters support all locations, municipality summaries, and exact barangays', () => {
  assert.equal(rows.filter(row => matchesReportLocation(row)).length, 4);
  assert.deepEqual(rows.filter(row => matchesReportLocation(row, 'a')).map(row => row.id), ['a', 'a2', 'a1']);
  assert.deepEqual(rows.filter(row => matchesReportLocation(row, 'a', 'a1')).map(row => row.id), ['a1']);
});
test('same-name barangays in different municipalities cannot match the wrong selection', () => {
  assert.equal(matchesReportLocation(rows[2], 'a', 'b1'), false);
  assert.equal(matchesReportLocation(rows[0], 'a', 'a1'), false);
  assert.deepEqual(rows.filter(row => matchesReportLocation(row, 'b', 'b1')).map(row => row.id), ['b1']);
});

let server, Filters;
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  Filters = (await server.ssrLoadModule('/src/components/ReportLocationFilters.jsx')).default;
});
after(async () => { await server?.close(); });
test('Reports renders separate labelled geographic selectors without making a live data request', () => {
  const html = renderToStaticMarkup(createElement(Filters, { municipalities: [{ code: 'a', name: 'Synthetic municipality' }], barangays: [], municipality: '', barangay: '' }));
  assert.match(html, /<label>Municipality<select/);
  assert.match(html, /<label>Barangay<select disabled=""/);
  assert.match(html, /All municipalities/);
  assert.match(html, /Select a municipality first/);

});
test('filter transitions clear stale barangays and selecting one switches to barangay results', async () => {
  const source = await readFile(new URL('../src/ReportsManagement.jsx', import.meta.url), 'utf8');
  assert.match(source, /setMunicipalityFilter\(value\); setBarangayFilter\(''\)/);
  assert.match(source, /setBarangayFilter\(value\); setExpandedMunicipality\(null\)/);
  assert.match(source, /const locationLevel = getReportLocationLevel\(municipalityFilter\)/);
  assert.doesNotMatch(source, /View by|Location level|setLocationLevel|reports-table-tools/);
  assert.match(source, /matchesQuery && matchesCoverage && matchesReportLocation/);
  assert.match(source, /filteredCoverage.map\(\(record\) => coverageColumns.map/);
});
test('the two selects forward independent geographic codes and enable valid scoped barangays', () => {
  let municipality, barangay;
  const tree = Filters({ municipalities: [], barangays: getReportBarangayOptions(barangays, 'a'), municipality: 'a', barangay: '', onMunicipalityChange: value => { municipality = value; }, onBarangayChange: value => { barangay = value; } });
  tree.props.children[0].props.children[1].props.onChange({ target: { value: 'b' } });
  tree.props.children[1].props.children[1].props.onChange({ target: { value: 'a1' } });
  assert.equal(municipality, 'b'); assert.equal(barangay, 'a1');
  const html = renderToStaticMarkup(createElement(Filters, { municipalities: [], barangays: getReportBarangayOptions(barangays, 'a'), municipality: 'a', barangay: 'a1' }));
  assert.doesNotMatch(html, /disabled=/);
  assert.match(html, /value="a1" selected=""/);
  assert.doesNotMatch(html, /value="b1"/);
});

test('geographic selection alone determines summary versus barangay rows', () => {
  assert.equal(getReportLocationLevel(''), 'municipality');
  assert.equal(getReportLocationLevel('a'), 'barangay');
  assert.equal(getReportLocationLevel(null), 'municipality');
});
test('the unified toolbar has exactly four labelled controls and no View by selector', () => {
  const html = renderToStaticMarkup(createElement(Filters, { municipalities: [], barangays: [], municipality: '', barangay: '' }));
  assert.equal((html.match(/<select/g) || []).length, 3);
  assert.equal((html.match(/<input/g) || []).length, 1);
  assert.match(html, /Search locations/); assert.match(html, /Coverage priority/);
  assert.doesNotMatch(html, /View by|Location level/);
});
test('search and priority controls retain independent callbacks', () => {
  let query, coverage;
  const tree = Filters({ municipalities: [], barangays: [], municipality: '', barangay: '', onQueryChange: value => { query = value; }, onCoverageChange: value => { coverage = value; } });
  tree.props.children[2].props.children[1].props.children[1].props.onChange({ target: { value: 'Common' } });
  tree.props.children[3].props.children[1].props.onChange({ target: { value: 'none' } });
  assert.equal(query, 'Common'); assert.equal(coverage, 'none');
});
