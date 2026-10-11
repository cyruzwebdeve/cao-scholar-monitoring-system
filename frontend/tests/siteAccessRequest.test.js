import test from 'node:test';
import assert from 'node:assert/strict';
import { requestSiteAccess, siteAccessFailureMessage } from '../src/services/siteAccessRequest.js';
const waitForAbort = (signal) => new Promise((resolve, reject) => {
  if (signal.aborted) reject(signal.reason);
  else signal.addEventListener('abort', () => reject(signal.reason), { once: true });
});
test('a stalled verification is aborted and receives retry guidance', async () => {
  const controller = new AbortController();
  await assert.rejects(requestSiteAccess('/status', {}, controller, (_, { signal }) => waitForAbort(signal), 10), (error) => {
    assert.equal(error.name, 'TimeoutError');
    assert.match(siteAccessFailureMessage(error), /connection and try again/);
    return true;
  });
  assert.equal(controller.signal.aborted, true);
});
test('deadline includes a stalled JSON response body', async () => {
  const controller = new AbortController();
  await assert.rejects(requestSiteAccess('/unlock', { method: 'POST' }, controller, async (_, { signal }) => ({ json: () => waitForAbort(signal) }), 10), { name: 'TimeoutError' });
});
test('a successful retry uses a fresh controller and returns the authorized payload', async () => {
  const controller = new AbortController();
  const { body } = await requestSiteAccess('/status', {}, controller, async () => new Response('{"authorized":true}'), 1000);
  assert.equal(body.authorized, true);
  assert.equal(controller.signal.aborted, false);
});
test('request cancellation remains distinguishable from a timeout', async () => {
  const controller = new AbortController();
  const pending = requestSiteAccess('/status', {}, controller, (_, { signal }) => waitForAbort(signal), 1000);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});
test('malformed JSON fails without granting authorization', async () => {
  await assert.rejects(requestSiteAccess('/status', {}, new AbortController(), async () => new Response('bad JSON'), 1000), SyntaxError);
  assert.match(siteAccessFailureMessage(new SyntaxError()), /unreadable/);
});
