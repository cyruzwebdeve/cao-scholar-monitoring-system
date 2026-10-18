import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PAYOUT_CLAIM_NOTICE, scheduleIso, scheduleLocalInput, scheduleTime, filterScheduleScholars } from '../src/utils/payoutSchedules.js';
test('schedule inputs always use Philippine time independent of browser timezone', () => {
  assert.equal(scheduleIso('2026-11-01T09:30'), '2026-11-01T01:30:00.000Z');
  assert.equal(scheduleLocalInput('2026-11-01T01:30:00.000Z'), '2026-11-01T09:30');
  assert.match(scheduleTime('2026-11-01T01:30:00Z'), /9:30/);
  assert.equal(scheduleIso(''), null);
});
test('municipality/school/search filters select batch recipients independently of venue', () => {
  const rows = [{ applicantId: 1, name: 'SYNTHETIC A', municipality: 'Capalonga', school: 'SCHOOL A' }, { applicantId: 2, name: 'SYNTHETIC B', municipality: 'Sta. Elena', school: 'SCHOOL B' }];
  assert.deepEqual(filterScheduleScholars(rows, 'Capalonga', '', '').map(row => row.applicantId), [1]);
  assert.deepEqual(filterScheduleScholars(rows, '', 'SCHOOL B', 'synthetic b').map(row => row.applicantId), [2]);
  assert.equal(filterScheduleScholars(rows, 'Capalonga', 'SCHOOL B', '').length, 0);
});

test('schedule workspace discloses automatic Gmail and displays delivery states without an opt-out', async () => {
  const source = await readFile(new URL('../src/PayoutSchedules.jsx', import.meta.url), 'utf8');
  assert.match(source, /Gmail notifications are automatic when publishing, changing or cancelling/);
  assert.match(source, /drafts do not send email/);
  assert.match(source, /row\.emailDeliveries\?\.\[state\]/);
  assert.ok(source.includes("['sent', 'pending', 'failed', 'sending', 'cancelled']"));
  assert.doesNotMatch(source, /notifyEmail|type="checkbox"[^>]*[Ee]mail/);
});


test('the one-week notice is consistent across the admin preview, saved card and backend messages', async () => {
  const { createServer } = await import('vite');
  const { fileURLToPath } = await import('node:url');
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  try {
    const Card = (await server.ssrLoadModule('/src/components/PayoutScheduleCard.jsx')).default;
    const schedule = { title: 'Synthetic schedule', startsAt: '2030-01-01T01:00:00Z', venue: 'Test venue' };
    for (const status of ['draft', 'published']) {
      const html = renderToStaticMarkup(createElement(Card, { schedule: { ...schedule, status }, preview: status === 'draft' }));
      assert.ok(html.includes(PAYOUT_CLAIM_NOTICE)); assert.match(html, /Important notice:/);
    }
    const cancelled = renderToStaticMarkup(createElement(Card, { schedule: { ...schedule, status: 'cancelled' } }));
    assert.ok(!cancelled.includes(PAYOUT_CLAIM_NOTICE)); assert.match(cancelled, /This schedule is cancelled/);
    const backend = await readFile(new URL('../../backend/services/payoutSchedulePolicy.js', import.meta.url), 'utf8');
    assert.ok(backend.includes(PAYOUT_CLAIM_NOTICE));
  } finally { await server.close(); }
});


test('scholar schedule layout separates the existing reminder without inventing notices or losing message text', async () => {
  const { createServer } = await import('vite');
  const { fileURLToPath } = await import('node:url');
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  try {
    const Updates = (await server.ssrLoadModule('/src/components/ScholarUpdates.jsx')).default;
    const personal = { id: 1, type: 'payout_schedule', title: 'Test schedule', reference: 'TEST-1', message: `Bring <ID>. ${PAYOUT_CLAIM_NOTICE}`, isRead: false };
    const html = renderToStaticMarkup(createElement(Updates, { personal }));
    assert.match(html, /scholar-payout-reminder/);
    assert.equal(html.split(PAYOUT_CLAIM_NOTICE).length - 1, 1);
    assert.match(html, /Bring &lt;ID&gt;\./);
    assert.match(html, /TEST-1/);
    assert.match(html, /Mark as read/);
    for (const message of ['Schedule cancelled. Contact CAO.', 'Historical notice without reminder.']) {
      const rendered = renderToStaticMarkup(createElement(Updates, { personal: { ...personal, message, isRead: true } }));
      assert.ok(rendered.includes(message));
      assert.doesNotMatch(rendered, /scholar-payout-reminder|Mark as read/);
    }
    const ordinary = renderToStaticMarkup(createElement(Updates, { personal: { ...personal, type: 'personal', message: 'Ordinary update' } }));
    assert.doesNotMatch(ordinary, /scholar-payout-notice|scholar-payout-reminder/);
  } finally { await server.close(); }
});


test('calendar ticket uses the Philippine schedule date, not the UTC date', async () => {
  const { createServer } = await import('vite');
  const { fileURLToPath } = await import('node:url');
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  try {
    const Card = (await server.ssrLoadModule('/src/components/PayoutScheduleCard.jsx')).default;
    const schedule = { title: 'Synthetic schedule', startsAt: '2030-01-01T17:00:00Z', venue: 'Test venue', status: 'published' };
    const html = renderToStaticMarkup(createElement(Card, { schedule }));
    assert.match(html, /payout-ticket-heading/);
    assert.match(html, /<span>Jan<\/span><strong>02<\/strong>/);
    assert.match(html, /Philippine time/);
    const empty = renderToStaticMarkup(createElement(Card, { schedule: { ...schedule, startsAt: null } }));
    assert.match(empty, /<span>--<\/span><strong>--<\/strong>/);
    assert.doesNotMatch(empty, /Invalid Date/);
  } finally { await server.close(); }
});
