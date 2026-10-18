import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { filterExamRoster, resultAcceptanceNotice } from '../src/utils/examinationUi.js';

let server, Roster, Reminder, Acceptance;
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  Roster = (await server.ssrLoadModule('/src/components/AssignedApplicantsModal.jsx')).default;
  Reminder = (await server.ssrLoadModule('/src/components/ResultReviewNotice.jsx')).default;
  Acceptance = (await server.ssrLoadModule('/src/components/ResultAcceptanceNotice.jsx')).default;
});
after(async () => { await server?.close(); });
const applicants = [
  { id: 1, name: 'SYNTHETIC <APPLICANT>', email: 'fixture@example.com', controlNo: 'TEST-1', attendanceStatus: 'Pending', status: 'Pending', examScore: null },
  { id: 2, name: 'SYNTHETIC SCHOLAR', email: 'scholar@example.com', attendanceStatus: 'Present', status: 'Accepted as scholar', examScore: 14 },
  { id: 3, name: 'SYNTHETIC ZERO', controlNo: 'TEST-3', attendanceStatus: 'Present', status: 'Failed', examScore: 0 },
];
const props = { exam: { municipality: 'Test municipality', venue: 'Synthetic hall' }, dateLabel: 'Test date', applicants, active: true };

test('publication reminder uses a readable informational block without changing review wording', () => {
  const html = renderToStaticMarkup(createElement(Reminder));
  assert.match(html, /role="note"/); assert.match(html, /Publication reminder/);
  assert.match(html, /Saving keeps the result under review/); assert.match(html, /until CAO republishes it/);
  assert.doesNotMatch(html, /<button|<input|<textarea/);
});
test('acceptance guidance separates waiting, publication, initial-verification and accepted states', () => {
  assert.equal(resultAcceptanceNotice({ status: 'Failed' }, true).title, 'Passing result required');
  assert.equal(resultAcceptanceNotice({ status: 'For review' }, true).title, 'Awaiting a passing result');
  assert.equal(resultAcceptanceNotice({ status: 'Passed', resultId: 1 }, true).title, 'Publish the reviewed result first');
  assert.equal(resultAcceptanceNotice({ status: 'Passed', resultId: 1, resultPublishedAt: 'test' }, false).title, 'Initial verification required');
  assert.equal(resultAcceptanceNotice({ status: 'Passed', resultId: 1, resultPublishedAt: 'test' }, true).tone, 'ready');
  assert.equal(resultAcceptanceNotice({ status: 'Passed', isScholar: true }, false).tone, 'complete');
  const html = renderToStaticMarkup(createElement(Acceptance, { result: { isScholar: true, scholarId: '<Synthetic ID>' } }));
  assert.match(html, /id="rm-acceptance-guidance"/); assert.match(html, /role="status"/); assert.match(html, /&lt;Synthetic ID&gt;/);
});
test('acceptance notice tone agrees with existing eligibility blockers without introducing a new acceptance path', () => {
  for (const status of ['Pending', 'For review', 'Passed', 'Failed']) for (const isScholar of [false, true]) for (const resultId of [null, 1]) for (const resultPublishedAt of [null, 'published']) for (const verified of [false, true]) {
    const result = { status, isScholar, resultId, resultPublishedAt };
    const blocked = status !== 'Passed' || isScholar || (resultId && !resultPublishedAt) || (!isScholar && !verified);
    assert.equal(resultAcceptanceNotice(result, verified).tone === 'ready', !blocked);
  }
});
test('assigned-applicant modal has a native labelled dialog, clear controls, complete rows and roster totals', () => {
  const html = renderToStaticMarkup(createElement(Roster, props));
  for (const content of ['<dialog', 'aria-labelledby="exam-applicant-modal-title"', 'aria-describedby="exam-roster-description"', 'aria-modal="true"', 'Close applicant list', 'Download attendance (.docx)', 'Deactivate exam', 'Search assigned applicants', 'Filter attendance', '3 of 3 applicants shown', '2 Present', '1 Pending', 'SYNTHETIC &lt;APPLICANT&gt;', 'Attendance locked', 'Result recorded']) assert.ok(html.includes(content), content);
  assert.match(html, /does not record completion or a passing result/);
  assert.equal((html.match(/class="exam-applicant-row"/g) || []).length, 3);
  const fields = [...html.matchAll(/<select[^>]*aria-label="Attendance for[^>]*>/g)].map(match => match[0]);
  assert.equal(fields.length, 3); assert.doesNotMatch(fields[0], /disabled/); assert.match(fields[1], /disabled/); assert.match(fields[2], /disabled/);
});
test('download/loading failures and per-row saving states remain safe and visible', () => {
  const error = renderToStaticMarkup(createElement(Roster, { ...props, applicantsLoadError: 'Synthetic load error', attendanceSaveError: 'Synthetic save error' }));
  assert.match(error, /Unable to load assigned applicants/); assert.match(error, /Applicant records unavailable/); assert.match(error, /Synthetic save error/);
  assert.doesNotMatch(error, /SYNTHETIC SCHOLAR|3 of 3/);
  assert.match(error, /class="exam-attendance-button" disabled=""/);
  const saving = renderToStaticMarkup(createElement(Roster, { ...props, attendanceSavingId: 1, attendanceDownloading: true }));
  assert.match(saving, /Saving attendance/); assert.match(saving, /Preparing Word file/);
  assert.match(saving, /disabled="" aria-label="Attendance for SYNTHETIC &lt;APPLICANT&gt;"/);
  const empty = renderToStaticMarkup(createElement(Roster, { ...props, applicants: [], active: false }));
  assert.match(empty, /No applicants are currently assigned/); assert.match(empty, /Activate exam/);
});
test('roster filters combine case-insensitive name/email/control search with attendance without mutating records', () => {
  const original = JSON.stringify(applicants);
  assert.deepEqual(filterExamRoster(applicants, ' test-1 ', 'all').map(row => row.id), [1]);
  assert.deepEqual(filterExamRoster(applicants, 'SCHOLAR@', 'Present').map(row => row.id), [2]);
  assert.equal(filterExamRoster(applicants, 'SCHOLAR@', 'Pending').length, 0);
  assert.deepEqual(filterExamRoster(applicants, '', 'Present').map(row => row.id), [2, 3]);
  assert.equal(JSON.stringify(applicants), original);
});
test('integration preserves existing attendance/download/publication/acceptance handlers and locks', async () => {
  const dashboard = await readFile(new URL('../src/Dashboard.jsx', import.meta.url), 'utf8');
  for (const marker of ['<AssignedApplicantsModal', 'onAttendanceChange={updateAttendance}', 'onDownload={() => downloadAttendanceList(selectedExam)}', 'onToggleActivation={() => toggleExamActivation(selectedExam.municipality)}', 'applicants.filter(applicant => applicant.municipality === selectedExam.municipality)']) assert.ok(dashboard.includes(marker), marker);
  const results = await readFile(new URL('../src/ResultsManagement.jsx', import.meta.url), 'utf8');
  assert.ok(results.includes("disabled={selected.status !== 'Passed' || selected.isScholar || (selected.resultId && !selected.resultPublishedAt) || publishing || acceptingScholar || (!selected.isScholar && !intake?.initialVerified)}"));
  for (const marker of ['onClick={acceptAsScholar}', '<PublishResultModal', '<ResultReviewNotice', '<ResultAcceptanceNotice', 'aria-describedby="rm-acceptance-guidance"']) assert.ok(results.includes(marker), marker);
  assert.doesNotMatch(results, /Latest exam result is not passing/);
  const modal = await readFile(new URL('../src/components/AssignedApplicantsModal.jsx', import.meta.url), 'utf8');
  for (const marker of ['Number.isFinite(applicant.examScore)', 'disabled={saving || locked}', 'onAttendanceChange(applicant, event.target.value)', 'element.showModal()', 'element.close()', 'previous?.focus()', 'document.body.style.overflow = overflow']) assert.ok(modal.includes(marker), marker);
});
test('responsive layout uses centred viewport bounds, a single roster scroller and readable status controls', async () => {
  const css = await readFile(new URL('../src/styles/examination-ui.css', import.meta.url), 'utf8');
  for (const marker of ['dialog.exam-roster-modal', 'position: fixed', 'margin: auto', '100dvh', 'minmax(0, 1fr)', 'white-space: normal', 'overflow-wrap: anywhere', 'min-height: 44px', 'font-size: 16px', 'max-height: 650px', 'overflow-y: visible', ':focus-visible', '::backdrop', ':not([open])']) assert.ok(css.includes(marker), marker);
});
