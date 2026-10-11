// Legacy claim/batch columns remain list-membership storage. Payment-confirmation
// fields are deliberately excluded from the supported workflow projection.
const isCertificationBatch = (batch) => String(batch?.batch_number || '').startsWith('BILL-')
  || String(batch?.status || '').toLowerCase() === 'billed';

const serializePayrollListMembership = (membership, batch) => {
  if (!membership || !batch || isCertificationBatch(batch)) return null;
  return {
    status: 'Included in payroll list',
    reference: batch.batch_number || null,
    amount: Number(membership.claim_amount),
    generatedAt: batch.prepared_at || membership.created_at || null,
  };
};
module.exports = { isCertificationBatch, serializePayrollListMembership };
