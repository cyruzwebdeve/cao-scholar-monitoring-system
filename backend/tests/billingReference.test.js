const assert = require('node:assert/strict');
const test = require('node:test');

const { createBillingReference } = require('../services/billingReference');

test('creates a stable batch billing reference from the processing timestamp', () => {
  assert.equal(createBillingReference(new Date('2026-09-08T01:02:03.456Z')), 'BILL-20260908010203456');
});

test('rejects an invalid billing processing timestamp', () => {
  assert.throws(() => createBillingReference('not-a-date'), /valid billing processing timestamp/i);
});
