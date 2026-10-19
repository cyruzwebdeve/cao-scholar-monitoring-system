const { PRIVATE_SCHOLAR_GRANT_AMOUNT, isPrivateSchool, resolveBillingAmount } = require('./billingGrant');
const error = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const validateTuitionAssistance = (value, total = PRIVATE_SCHOLAR_GRANT_AMOUNT) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > total || value !== Math.round(value * 100) / 100) throw error(`Enter Tuition Fee Assistance from PHP 0 to PHP ${total.toLocaleString('en-PH')} with at most two decimal places.`);
  return Math.round(value * 100) / 100;
};
const grantBreakdown = (record) => {
  const total = resolveBillingAmount('Private', record?.list_amount_override);
  if (!record?.grant_prepared_at || record.tuition_fee_assistance == null) return { grantPrepared: false, totalGrant: total, tuitionFeeAssistance: null, allowance: null, grantPreparedAt: null };
  const tuition = validateTuitionAssistance(Number(record.tuition_fee_assistance), total);
  return { grantPrepared: true, totalGrant: total, tuitionFeeAssistance: tuition, allowance: (Math.round(total * 100) - Math.round(tuition * 100)) / 100, grantPreparedAt: record.grant_prepared_at };
};
const preparationBlocker = (schoolType, record, alreadyListed = false) => isPrivateSchool(schoolType) && !alreadyListed && !grantBreakdown(record).grantPrepared
  ? { code: 'GRANT_PREPARATION_REQUIRED', message: 'Create the Private grant record and enter Tuition Fee Assistance before generating the list.' } : null;
// Both preparation and list generation take the same transaction-scoped locks.
// Sorted keys avoid cross-batch deadlocks; the list snapshots freshly saved values.
const lockGrantRecords = async (tx, periodId, applicantIds) => {
  for (const id of [...new Set(applicantIds)].sort((a,b) => a-b)) await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(${periodId}::int, ${id}::int)`;
};
const snapshotPrivateGrants = async (tx, periodId, applicantIds) => {
  await lockGrantRecords(tx, periodId, applicantIds);
  if (!applicantIds.length) return new Map();
  const records = await tx.scholar_requirements.findMany({ where: { applicant_id: { in: applicantIds }, billing_period_id: periodId } });
  const byId = new Map(records.map((record) => [record.applicant_id,record]));
  return new Map(applicantIds.map((id) => {
    const breakdown = grantBreakdown(byId.get(id));
    if (!breakdown.grantPrepared) throw error('A selected Private Scholar has no saved grant preparation record. Refresh and prepare it first.',409);
    return [id,{tuition_fee_assistance:breakdown.tuitionFeeAssistance,allowance:breakdown.allowance}];
  }));
};
module.exports = { validateTuitionAssistance, grantBreakdown, preparationBlocker, lockGrantRecords, snapshotPrivateGrants, error };
