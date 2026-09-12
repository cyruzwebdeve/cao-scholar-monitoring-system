const assert = require('node:assert/strict');
const test = require('node:test');

const { resolveBillingAmount } = require('../services/billingGrant');

test('private scholar grants always resolve to PHP 5,000', () => {
  assert.equal(resolveBillingAmount('Private', 0), 5000);
  assert.equal(resolveBillingAmount('private', 12500), 5000);
  assert.equal(resolveBillingAmount(' private ', 2500), 5000);
});

test('public scholar payroll grants always resolve to PHP 3,000', () => {
  assert.equal(resolveBillingAmount('Public', 7500), 3000);
  assert.equal(resolveBillingAmount('public', -1), 3000);
  assert.equal(resolveBillingAmount('PUBLIC', 'invalid'), 3000);
});
