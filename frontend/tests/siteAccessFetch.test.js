import test from 'node:test';
import assert from 'node:assert/strict';
import {
  API_BASE,
  installSiteAccessFetch,
  SITE_ACCESS_REQUIRED_EVENT,
  SITE_ACCESS_TOKEN_KEY,
} from '../src/services/api.js';

const createStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
};

test('API fetches receive the shared-access token while unrelated requests remain unchanged', async () => {
  const storage = createStorage();
  storage.setItem(SITE_ACCESS_TOKEN_KEY, 'private-token');
  const captured = [];
  const windowObject = {
    location: { href: 'https://cnpgceap-sms.com/' },
    sessionStorage: storage,
    dispatchEvent: () => {},
    fetch: async (input, init) => {
      captured.push({ input, init });
      return new Response('{}', { status: 200 });
    },
  };

  installSiteAccessFetch({ windowObject });
  await windowObject.fetch(`${API_BASE}/application-settings`);
  await windowObject.fetch('https://example.com/public.json');

  assert.equal(captured[0].init.headers.get('X-Site-Access-Token'), 'private-token');
  assert.equal(captured[1].init.headers, undefined);
});

test('an API access challenge clears the expired token and announces that the gate is required', async () => {
  const storage = createStorage();
  storage.setItem(SITE_ACCESS_TOKEN_KEY, 'expired-token');
  const events = [];
  const windowObject = {
    location: { href: 'https://cnpgceap-sms.com/' },
    sessionStorage: storage,
    dispatchEvent: (event) => events.push(event.type),
    fetch: async () => new Response('{}', {
      status: 401,
      headers: { 'X-Site-Access-Required': 'true' },
    }),
  };

  installSiteAccessFetch({ windowObject });
  await windowObject.fetch(`${API_BASE}/dashboard/summary`);

  assert.equal(storage.getItem(SITE_ACCESS_TOKEN_KEY), null);
  assert.deepEqual(events, [SITE_ACCESS_REQUIRED_EVENT]);
});
