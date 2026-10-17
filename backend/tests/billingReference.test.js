const assert = require('node:assert/strict');
const test = require('node:test');

const { createBillingReference, createPayrollReference, createReferencedListBatch } = require('../services/billingReference');

test('uses durable batch IDs with minimum four digits and expands without truncation', () => {
  assert.equal(createBillingReference(42), 'BILL-0042');
  assert.equal(createPayrollReference(43), 'PAY-0043');
  assert.equal(createBillingReference(10000), 'BILL-10000');
  assert.equal(createPayrollReference(10000), 'PAY-10000');
});

test('rejects invalid batch identifiers instead of generating ambiguous references', () => {
  for (const id of [undefined, null, 0, -1, 1.5, NaN, Infinity, '42', Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => createBillingReference(id), /positive integer batch ID/i);
    assert.throws(() => createPayrollReference(id), /positive integer batch ID/i);
  }
});

test('finalizes a batch reference on the provided transaction before returning it', async () => {
  for (const [route, expected] of [['billing', 'BILL-0042'], ['payroll', 'PAY-0042']]) {
    let saved;
    const transaction = { payroll_batches: {
      create: async ({ data }) => {
        assert.match(data.batch_number, /^PENDING-[a-f0-9-]{36}$/);
        saved = { id: 42, ...data };
        return saved;
      },
      update: async ({ where, data }) => {
        assert.deepEqual(where, { id: 42 });
        saved = { ...saved, ...data };
        return saved;
      },
    } };
    const batch = await createReferencedListBatch(transaction, route, { billing_period_id: 10, total_amount: 5000 });
    assert.equal(batch.batch_number, expected);
    assert.equal(batch.billing_period_id, 10);
    assert.equal(batch.total_amount, 5000);
  }
});

test('reference finalization errors propagate so the caller transaction rolls back', async () => {
  const collision = Object.assign(new Error('Reference conflict'), { code: 'P2002' });
  const transaction = { payroll_batches: {
    create: async () => ({ id: 42 }),
    update: async () => { throw collision; },
  } };
  await assert.rejects(createReferencedListBatch(transaction, 'billing', {}), (error) => error === collision);
  await assert.rejects(createReferencedListBatch(transaction, 'invalid', {}), /valid list route/i);
});
