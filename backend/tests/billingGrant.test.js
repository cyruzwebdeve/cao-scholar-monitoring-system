const assert = require('node:assert/strict');
const test = require('node:test');
const { resolveBillingAmount, validateGrantAmount } = require('../services/billingGrant');
const { totalListAmount } = require('../services/scholarAmount');
test('defaults remain Public PHP 3,000 and Private PHP 5,000 until explicitly overridden', () => {
  assert.equal(resolveBillingAmount('Private'), 5000);
  assert.equal(resolveBillingAmount(' private ', null), 5000);
  assert.equal(resolveBillingAmount('Public'), 3000);
});
test('explicit overrides preserve zero, cents and alternate Public/Private totals', () => {
  for (const type of ['Public', 'Private']) for (const amount of [0, 0.01, 2500, 6500.75, 99999999.99]) assert.equal(resolveBillingAmount(type, amount), amount);
});
test('currency validation rejects missing, invalid, negative, over-limit and extra precision', () => {
  for (const value of [null, undefined, '', '6500', true, NaN, Infinity, -0.01, 100000000, 0.001]) assert.throws(() => validateGrantAmount(value));
});
test('list totals use integer cents and reject values beyond the batch column capacity', () => {
  assert.equal(totalListAmount(new Map([[1, 0.1], [2, 0.2]])), 0.3);
  assert.throws(() => totalListAmount(new Map(Array.from({ length: 101 }, (_, id) => [id, 99999999.99]))), /smaller lists/);
});
