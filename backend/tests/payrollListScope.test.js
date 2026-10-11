const assert = require('node:assert/strict');
const test = require('node:test');
const { isCertificationBatch, serializePayrollListMembership } = require('../services/payrollListScope');

const preparedAt = new Date('2026-10-01T00:00:00Z');
test('legacy payment confirmations project only payroll-list membership', () => {
  for (const claimStatus of ['listed', 'paid', 'claimed', 'released']) {
    const membership = { claim_amount: 3000, claim_status: claimStatus, claimed_date: new Date(), claimed_notes: 'SYNTHETIC-PAYMENT-REFERENCE', updated_at: new Date() };
    const batch = { batch_number: 'PAYROLL-TEST', status: 'released', released_at: new Date(), prepared_at: preparedAt };
    assert.deepEqual(serializePayrollListMembership(membership, batch), {
      status: 'Included in payroll list', reference: 'PAYROLL-TEST', amount: 3000, generatedAt: preparedAt,
    });
    assert.equal(membership.claim_status, claimStatus);
    assert.equal(batch.status, 'released');
  }
});

test('certification entries and missing batches do not become payroll-list confirmations', () => {
  const membership = { claim_amount: 5000 };
  for (const batch of [null, { batch_number: 'BILL-TEST', status: 'released' }, { batch_number: 'LEGACY', status: 'billed' }]) {
    assert.equal(serializePayrollListMembership(membership, batch), null);
  }
  assert.equal(serializePayrollListMembership(null, { batch_number: 'PAYROLL-TEST' }), null);
  assert.equal(isCertificationBatch({ batch_number: 'BILL-TEST' }), true);
});

test('payroll dates use list creation rather than later payment update dates', () => {
  const membership = { claim_amount: 3000, created_at: preparedAt, updated_at: new Date(), claimed_date: new Date() };
  assert.equal(serializePayrollListMembership(membership, { batch_number: 'PAYROLL-TEST' }).generatedAt, preparedAt);
  assert.equal(serializePayrollListMembership({ claim_amount: 3000, updated_at: new Date() }, {}).generatedAt, null);
});
