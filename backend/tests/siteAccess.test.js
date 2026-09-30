const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');
const {
  issueSiteAccessToken,
  isSiteAccessEnabled,
  passwordsMatch,
  verifySiteAccessToken,
} = require('../services/siteAccess');
const { requireSiteAccess } = require('../middleware/siteAccess');

const originalEnv = {
  SITE_ACCESS_ENABLED: process.env.SITE_ACCESS_ENABLED,
  SITE_ACCESS_PASSWORD: process.env.SITE_ACCESS_PASSWORD,
  JWT_SECRET: process.env.JWT_SECRET,
};

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

const createResponse = () => ({
  headers: {},
  statusCode: 200,
  body: null,
  set(name, value) { this.headers[name] = value; return this; },
  status(value) { this.statusCode = value; return this; },
  json(value) { this.body = value; return this; },
});

test('site access is opt-in and password comparison is timing-safe compatible', () => {
  assert.equal(isSiteAccessEnabled({ SITE_ACCESS_ENABLED: 'false' }), false);
  assert.equal(isSiteAccessEnabled({ SITE_ACCESS_ENABLED: ' TRUE ' }), true);
  assert.equal(passwordsMatch('shared-secret', 'shared-secret'), true);
  assert.equal(passwordsMatch('wrong-secret', 'shared-secret'), false);
  assert.equal(passwordsMatch('', 'shared-secret'), false);
});

test('site access tokens require the intended purpose, issuer, audience, and secret', () => {
  const secret = 'test-secret-that-is-long-enough-for-token-tests';
  const token = issueSiteAccessToken({ secret, expiresIn: '5m' });
  assert.equal(verifySiteAccessToken(token, { secret })?.purpose, 'site-access');
  assert.equal(verifySiteAccessToken(token, { secret: `${secret}-wrong` }), null);
  assert.equal(verifySiteAccessToken('not-a-token', { secret }), null);
});

test('middleware allows all requests while the private testing gate is disabled', () => {
  process.env.SITE_ACCESS_ENABLED = 'false';
  let continued = false;
  requireSiteAccess({ get: () => '' }, createResponse(), () => { continued = true; });
  assert.equal(continued, true);
});

test('middleware rejects missing authorization and accepts a valid shared-access token', () => {
  process.env.SITE_ACCESS_ENABLED = 'true';
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-token-tests';

  const rejectedResponse = createResponse();
  requireSiteAccess({ get: () => '' }, rejectedResponse, () => assert.fail('Missing token must not continue.'));
  assert.equal(rejectedResponse.statusCode, 401);
  assert.equal(rejectedResponse.headers['X-Site-Access-Required'], 'true');
  assert.equal(rejectedResponse.body.code, 'SITE_ACCESS_REQUIRED');

  const token = issueSiteAccessToken({ secret: process.env.JWT_SECRET, expiresIn: '5m' });
  let continued = false;
  const request = { get: (name) => (name === 'X-Site-Access-Token' ? token : '') };
  requireSiteAccess(request, createResponse(), () => { continued = true; });
  assert.equal(continued, true);
  assert.equal(request.siteAccess.authorized, true);
});
