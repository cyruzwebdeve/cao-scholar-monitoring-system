import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { APPLICANT_ELIGIBILITY_CRITERIA, matchesApplicantEligibility as matches } from '../src/utils/applicantEligibilityFilter.js';

test('all seven form criteria can independently filter declared applicants', () => {
  assert.equal(APPLICANT_ELIGIBILITY_CRITERIA.length, 7);
  for (const { key } of APPLICANT_ELIGIBILITY_CRITERIA) {
    assert.equal(matches({ [key]: 'Yes' }, key), true);
    assert.equal(matches({ [key]: true }, key), true);
    assert.equal(matches({ [key]: '  YES  ' }, key), true);
    for (const value of ['No', false, null, undefined, 'false', 'true', 1]) assert.equal(matches({ [key]: value }, key), false);
  }
});
test('all, any and none handle missing declarations without counting the family acknowledgement', () => {
  assert.equal(matches(undefined, 'all'), true);
  assert.equal(matches(undefined, 'none'), true);
  assert.equal(matches(undefined, 'any'), false);
  assert.equal(matches({ siblingRuleAccepted: true }, 'any'), false);
  assert.equal(matches({ pwd: 'Yes', soloParent: 'Yes' }, 'any'), true);
  assert.equal(matches({ pwd: 'Yes' }, 'none'), false);
  assert.equal(matches({ pwd: 'Yes' }, 'unknown'), false);
});
test('parent-of-PWD declarations do not imply that the applicant has PWD status or approved proof', () => {
  assert.equal(matches({ childOfPwd: 'Yes', pwd: 'No' }, 'pwd'), false);
  assert.equal(matches({ childOfPwd: 'Yes', pwd: 'No' }, 'childOfPwd'), true);
  assert.equal(matches({ pwd: 'No', proofApproved: true }, 'pwd'), false);
});

let server, Filter;
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  Filter = (await server.ssrLoadModule('/src/components/ApplicantEligibilityFilter.jsx')).default;
});
after(async () => { await server?.close(); });
test('the labelled filter renders all screenshot criteria with declaration-only guidance', () => {
  const html = renderToStaticMarkup(createElement(Filter, { value: 'pwd' }));
  assert.equal((html.match(/<option /g) || []).length, 10);
  for (const { label } of APPLICANT_ELIGIBILITY_CRITERIA) assert.ok(html.includes(label), label);
  assert.match(html, /value="pwd" selected=""/);
  assert.match(html, /Applicant declarations, not proof approval/);
  assert.match(html, /aria-describedby="applicant-eligibility-filter-hint"/);
  let selected;
  const tree = Filter({ value: 'all', onChange: value => { selected = value; } });
  tree.props.children[1].props.onChange({ target: { value: 'soloParent' } });
  assert.equal(selected, 'soloParent');
});
test('Applicants combines the criterion with other filters, resets pagination and exports the filtered results', async () => {
  const source = await readFile(new URL('../src/Dashboard.jsx', import.meta.url), 'utf8');
  const applicants = source.slice(source.indexOf('function ApplicantsManagement('), source.indexOf('const examVenueDefaults'));
  assert.match(applicants, /&& matchesApplicantEligibility\(applicant.eligibility, eligibilityFilter\)/);
  assert.match(applicants, /eligibilityFilter !== 'all'/);
  assert.match(applicants, /setEligibilityFilter\('all'\)/);
  assert.match(applicants, /setEligibilityFilter\(value\); setPage\(1\)/);
  assert.match(applicants, /buildRecordRows\(sortedApplicants, columns\)/);
  assert.match(applicants, /applicant-filters applicant-eligibility-tools/);
});
