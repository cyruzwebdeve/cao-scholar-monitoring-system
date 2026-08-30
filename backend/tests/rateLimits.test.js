const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const express = require('express');
const { createRateLimiters } = require('../middleware/rateLimits');

let server;
let baseUrl;

before(async () => {
  const app = express();
  const limiters = createRateLimiters({ isProduction: true });
  app.use(express.json());

  app.post('/login', limiters.loginRateLimiter, (req, res) => {
    res.status(req.body.success ? 200 : 401).json({ ok: Boolean(req.body.success) });
  });
  app.post('/applications', limiters.applicationSubmissionRateLimiter, (req, res) => {
    res.status(201).json({ ok: true });
  });
  app.post('/forgot-password', limiters.passwordResetRequestRateLimiter, (req, res) => {
    res.status(200).json({ ok: true });
  });
  app.put('/documents', (req, res, next) => {
    req.user = { id: Number(req.headers['x-test-user']), role: 'Scholar' };
    next();
  }, limiters.documentUploadRateLimiter, (req, res) => {
    res.json({ ok: true });
  });
  app.put('/staff', (req, res, next) => {
    req.user = { id: Number(req.headers['x-test-user']), role: 'SuperAdmin' };
    next();
  }, limiters.staffWriteRateLimiter, (req, res) => {
    res.json({ ok: true });
  });
  app.put('/document-reviews', (req, res, next) => {
    req.user = { id: Number(req.headers['x-test-user']), role: 'Moderator' };
    next();
  }, limiters.documentReviewRateLimiter, (req, res) => {
    res.json({ ok: true });
  });
  app.post('/scholarship-decisions', (req, res, next) => {
    req.user = { id: Number(req.headers['x-test-user']), role: 'SuperAdmin' };
    next();
  }, limiters.scholarshipDecisionRateLimiter, (req, res) => {
    res.json({ ok: true });
  });
  app.post('/billing', (req, res, next) => {
    req.user = { id: Number(req.headers['x-test-user']), role: 'BillingPayrollAdmin' };
    next();
  }, limiters.billingWriteRateLimiter, (req, res) => {
    res.json({ ok: true });
  });

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

const request = (path, options = {}) => fetch(`${baseUrl}${path}`, {
  headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  ...options,
});

test('successful sign-ins do not consume the failed-login allowance', async () => {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const response = await request('/login', { method: 'POST', body: JSON.stringify({ success: true }) });
    assert.equal(response.status, 200);
  }
});

test('failed sign-ins are blocked after ten attempts', async () => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await request('/login', { method: 'POST', body: JSON.stringify({ success: false }) });
    assert.equal(response.status, 401);
  }
  const blocked = await request('/login', { method: 'POST', body: JSON.stringify({ success: false }) });
  assert.equal(blocked.status, 429);
  assert.match((await blocked.json()).message, /failed sign-in attempts/i);
});

test('application submissions are limited to ten per connection each hour', async () => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await request('/applications', { method: 'POST' });
    assert.equal(response.status, 201);
  }
  const blocked = await request('/applications', { method: 'POST' });
  assert.equal(blocked.status, 429);
});

test('password reset emails are limited to five requests per connection each hour', async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await request('/forgot-password', { method: 'POST' });
    assert.equal(response.status, 200);
  }
  const blocked = await request('/forgot-password', { method: 'POST' });
  assert.equal(blocked.status, 429);
  assert.match((await blocked.json()).message, /password reset requests/i);
});

test('document upload limits are isolated per authenticated account', async () => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await request('/documents', { method: 'PUT', headers: { 'X-Test-User': '101' } });
    assert.equal(response.status, 200);
  }
  const blocked = await request('/documents', { method: 'PUT', headers: { 'X-Test-User': '101' } });
  assert.equal(blocked.status, 429);

  const otherAccount = await request('/documents', { method: 'PUT', headers: { 'X-Test-User': '202' } });
  assert.equal(otherAccount.status, 200);
});

test('staff account mutations are limited and isolated per Super Administrator', async () => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await request('/staff', { method: 'PUT', headers: { 'X-Test-User': '301' } });
    assert.equal(response.status, 200);
  }
  const blocked = await request('/staff', { method: 'PUT', headers: { 'X-Test-User': '301' } });
  assert.equal(blocked.status, 429);
  assert.match((await blocked.json()).message, /staff account update limit/i);

  const otherAdministrator = await request('/staff', { method: 'PUT', headers: { 'X-Test-User': '302' } });
  assert.equal(otherAdministrator.status, 200);
});

test('document review decisions are rate limited per moderator account', async () => {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const response = await request('/document-reviews', { method: 'PUT', headers: { 'X-Test-User': '401' } });
    assert.equal(response.status, 200);
  }
  const blocked = await request('/document-reviews', { method: 'PUT', headers: { 'X-Test-User': '401' } });
  assert.equal(blocked.status, 429);

  const otherModerator = await request('/document-reviews', { method: 'PUT', headers: { 'X-Test-User': '402' } });
  assert.equal(otherModerator.status, 200);
});

test('scholarship decisions are rate limited per authorized staff account', async () => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const response = await request('/scholarship-decisions', { method: 'POST', headers: { 'X-Test-User': '451' } });
    assert.equal(response.status, 200);
  }
  const blocked = await request('/scholarship-decisions', { method: 'POST', headers: { 'X-Test-User': '451' } });
  assert.equal(blocked.status, 429);
  assert.match((await blocked.json()).message, /scholarship decision limit/i);

  const otherAdministrator = await request('/scholarship-decisions', { method: 'POST', headers: { 'X-Test-User': '452' } });
  assert.equal(otherAdministrator.status, 200);
});

test('billing operations are rate limited per administrator account', async () => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const response = await request('/billing', { method: 'POST', headers: { 'X-Test-User': '501' } });
    assert.equal(response.status, 200);
  }
  const blocked = await request('/billing', { method: 'POST', headers: { 'X-Test-User': '501' } });
  assert.equal(blocked.status, 429);
  assert.match((await blocked.json()).message, /billing processing limit/i);

  const otherAdministrator = await request('/billing', { method: 'POST', headers: { 'X-Test-User': '502' } });
  assert.equal(otherAdministrator.status, 200);
});
