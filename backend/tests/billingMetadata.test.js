const assert = require('node:assert/strict');
const test = require('node:test');

const { validateScholarBillingMetadata } = require('../middleware/validators');

const validate = (body) => {
  let nextCalled = false;
  let statusCode = 200;
  let payload;
  const res = {
    status(code) { statusCode = code; return this; },
    json(value) { payload = value; return this; },
  };
  validateScholarBillingMetadata({ body }, res, () => { nextCalled = true; });
  return { nextCalled, statusCode, payload };
};

test('accepts an available billing period identifier and supported status', () => {
  const result = validate({ academicPeriodId: 4, billingStatus: 'Ready for billing' });
  assert.equal(result.nextCalled, true);
  assert.equal(result.statusCode, 200);
});

test('accepts each editable pre-processing billing status', () => {
  for (const billingStatus of ['Pending', 'Ready for billing', 'On hold', 'Not applicable']) {
    assert.equal(validate({ academicPeriodId: 1, billingStatus }).nextCalled, true);
  }
});

test('rejects invalid billing period identifiers', () => {
  const result = validate({ academicPeriodId: 0, billingStatus: 'Pending' });
  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 400);
  assert.match(result.payload.message, /school year and semester/i);
});

test('rejects system-controlled or unknown billing statuses', () => {
  const result = validate({ academicPeriodId: 1, billingStatus: 'Billed' });
  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 400);
  assert.match(result.payload.message, /billing status/i);
});
