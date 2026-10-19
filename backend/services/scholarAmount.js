const { resolveBillingAmount } = require('./billingGrant');
const { lockGrantRecords } = require('./grantPreparation');
// List creation and amount/preparation edits share these locks and serializable isolation.
const snapshotListAmounts = async (tx, periodId, candidates) => {
  await lockGrantRecords(tx, periodId, candidates.map(item => item.applicantId));
  const records = await tx.scholar_requirements.findMany({ where: { applicant_id: { in: candidates.map(item => item.applicantId) }, billing_period_id: periodId } });
  const byId = new Map(records.map(record => [record.applicant_id, record]));
  return new Map(candidates.map(item => [item.applicantId, resolveBillingAmount(item.schoolType, byId.get(item.applicantId)?.list_amount_override)]));
};
const totalListAmount = amounts => {
  const cents = [...amounts.values()].reduce((total, amount) => total + Math.round(amount * 100), 0);
  if (cents > 999999999999) throw Object.assign(new Error('The total exceeds the list amount limit. Generate smaller lists.'), { statusCode: 400 });
  return cents / 100;
};
module.exports = { snapshotListAmounts, totalListAmount };
