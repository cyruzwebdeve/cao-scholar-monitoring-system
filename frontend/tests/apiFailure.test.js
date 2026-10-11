import test from 'node:test';
import assert from 'node:assert/strict';
import { API_BASE, installSiteAccessFetch } from '../src/services/api.js';

const setup = (fetch) => {
  const windowObject = {
    location: { href: 'https://cnpgceap-sms.com/' },
    sessionStorage: { getItem: () => null, removeItem: () => {} },
    dispatchEvent: () => {}, fetch,
  };
  installSiteAccessFetch({ windowObject });
  return windowObject.fetch;
};

test('failed reads provide recovery guidance without exposing browser transport text', async () => {
  const fetch = setup(async () => { throw new TypeError('Failed to fetch INTERNAL-HOST'); });
  await assert.rejects(fetch(`${API_BASE}/reports/lifecycle`), (error) => {
    assert.match(error.message, /service could not be reached/);
    assert.match(error.message, /Retry or refresh/);
    assert.doesNotMatch(error.message, /Failed to fetch|INTERNAL-HOST/);
    return true;
  });
});

test('uncertain writes are never replayed and Request methods retain their meaning', async () => {
  let calls = 0;
  const fetch = setup(async () => { calls += 1; throw new TypeError('NetworkError'); });
  await assert.rejects(fetch(new Request(`${API_BASE}/payroll/process`, { method: 'POST' })), /could not confirm whether this action completed.*reload the affected record/);
  assert.equal(calls, 1);
});

test('an init method override selects write guidance even for a GET Request', async () => {
  const fetch = setup(async () => { throw new TypeError('NetworkError'); });
  await assert.rejects(fetch(new Request(`${API_BASE}/settings`), { method: 'PUT' }), /could not confirm whether this action completed/);
});

test('application and exam submissions receive specific uncertain-outcome guidance', async () => {
  const fetch = setup(async () => { throw new TypeError('NetworkError'); });
  await assert.rejects(fetch(`${API_BASE}/applications`, { method: 'POST' }), /Keep this form open and contact CAO before submitting again/);
  await assert.rejects(fetch(`${API_BASE}/applications/me/exam-result`, { method: 'POST' }), /Your answers remain on this page.*before the deadline/);
});

test('sign-in transport errors offer sign-in recovery rather than record-save instructions', async () => {
  const fetch = setup(async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(fetch(`${API_BASE}/auth/login`, { method: 'POST' }), (error) => {
    assert.match(error.message, /try signing in again/);
    assert.doesNotMatch(error.message, /affected record/);
    return true;
  });
});

test('server failures hide internal JSON and proxy HTML while retaining a status for diagnostics', async () => {
  for (const body of ['{"message":"INTERNAL-STACK-TRACE"}', '<html>INTERNAL-PROXY-HOST</html>']) {
    const fetch = setup(async () => new Response(body, { status: 503 }));
    await assert.rejects(fetch(`${API_BASE}/scholars/management`), (error) => {
      assert.equal(error.status, 503);
      assert.match(error.message, /temporarily unavailable/);
      assert.doesNotMatch(error.message, /INTERNAL/);
      return true;
    });
  }
});

test('malformed successful JSON fails visibly instead of becoming an empty result or save success', async () => {
  const fetch = setup(async () => new Response('<html>proxy response</html>'));
  const read = await fetch(`${API_BASE}/staff/management`);
  await assert.rejects(read.json(), /unreadable response.*Retry or refresh/);
  const write = await fetch(`${API_BASE}/staff`, { method: 'POST' });
  await assert.rejects(write.json(), /unreadable response.*could not confirm whether this action completed/);
});

test('validation, authentication and conflict messages remain available to existing consumers', async () => {
  for (const status of [400, 401, 403, 409, 410, 429]) {
    const payload = { message: 'Synthetic actionable rule', code: 'RULE', fields: { reason: 'Required' } };
    const fetch = setup(async () => new Response(JSON.stringify(payload), { status }));
    const response = await fetch(`${API_BASE}/results`, { method: 'POST' });
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), payload);
  }
});

test('timeout errors retain timeout identity, and intentional cancellation is unchanged', async () => {
  const timeout = setup(async () => { throw new DOMException('raw timed out', 'TimeoutError'); });
  await assert.rejects(timeout(`${API_BASE}/applications/me`), (error) => error.name === 'TimeoutError' && /took too long/.test(error.message));
  const aborted = new DOMException('Intentional cancellation', 'AbortError');
  const fetch = setup(async () => { throw aborted; });
  await assert.rejects(fetch(`${API_BASE}/applications/me`), (error) => error === aborted);
});

test('document download bytes remain intact while body transport errors receive guidance', async () => {
  const fetch = setup(async () => new Response('%PDF-synthetic', { headers: { 'Content-Type': 'application/pdf' } }));
  assert.equal(await (await fetch(`${API_BASE}/document-reviews/1/grades/file`)).blob().then((blob) => blob.text()), '%PDF-synthetic');
  const broken = setup(async () => new Response(new ReadableStream({ start(controller) { controller.error(new TypeError('NetworkError during body')); } })));
  await assert.rejects((await broken(`${API_BASE}/document-reviews/1/grades/file`)).blob(), /service could not be reached/);
});

test('tester-gate requests and non-API requests retain their independent error handling', async () => {
  const failure = new TypeError('Original error');
  const fetch = setup(async () => { throw failure; });
  for (const url of [`${API_BASE}/site-access/status`, 'https://example.com/other.json']) {
    await assert.rejects(fetch(url), (error) => error === failure);
  }
});


test('null and scalar JSON cannot masquerade as a structured API payload', async () => {
  for (const body of ['null', '12', '"unexpected scalar"']) {
    const fetch = setup(async () => new Response(body));
    await assert.rejects((await fetch(`${API_BASE}/applications/me`)).json(), /unreadable response/);
  }
});
