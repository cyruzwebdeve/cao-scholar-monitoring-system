const assert = require('node:assert/strict');
const test = require('node:test');

const {
  RESET_TOKEN_TTL_MS,
  generateResetToken,
  hashResetToken,
  isStrongPassword,
} = require('../services/passwordReset');

test('generates URL-safe high-entropy reset tokens and stores deterministic hashes', () => {
  const firstToken = generateResetToken();
  const secondToken = generateResetToken();

  assert.match(firstToken, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(firstToken, secondToken);
  assert.match(hashResetToken(firstToken), /^[a-f0-9]{64}$/);
  assert.equal(hashResetToken(firstToken), hashResetToken(firstToken));
  assert.notEqual(hashResetToken(firstToken), firstToken);
});

test('uses a 30-minute reset-token lifetime', () => {
  assert.equal(RESET_TOKEN_TTL_MS, 30 * 60 * 1000);
});

test('requires a long mixed-case password containing a number', () => {
  assert.equal(isStrongPassword('SecurePassword2026'), true);
  assert.equal(isStrongPassword('short1A'), false);
  assert.equal(isStrongPassword('alllowercase2026'), false);
  assert.equal(isStrongPassword('ALLUPPERCASE2026'), false);
  assert.equal(isStrongPassword('NoNumbersIncluded'), false);
});
