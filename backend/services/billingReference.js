const { randomUUID } = require('node:crypto');

const formatListReference = (prefix, batchId) => {
  if (!Number.isSafeInteger(batchId) || batchId <= 0) {
    throw new TypeError('A positive integer batch ID is required.');
  }
  return `${prefix}-${String(batchId).padStart(4, '0')}`;
};

const createBillingReference = (batchId) => formatListReference('BILL', batchId);
const createPayrollReference = (batchId) => formatListReference('PAY', batchId);

// Call only inside the list-generation transaction. The temporary unique value
// is replaced before memberships/requirement references are written or committed.
const createReferencedListBatch = async (transaction, route, data) => {
  if (!['billing', 'payroll'].includes(route)) throw new TypeError('A valid list route is required.');
  const batch = await transaction.payroll_batches.create({
    data: { ...data, batch_number: `PENDING-${randomUUID()}` },
  });
  return transaction.payroll_batches.update({
    where: { id: batch.id },
    data: { batch_number: route === 'billing' ? createBillingReference(batch.id) : createPayrollReference(batch.id) },
  });
};

module.exports = { createBillingReference, createPayrollReference, createReferencedListBatch };
