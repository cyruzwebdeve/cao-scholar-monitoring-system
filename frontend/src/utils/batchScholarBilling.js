export const MAX_BATCH_GRANT_ROWS = 100;

export const batchBillingBlocker = (record, periodId) => {
  if (Number(record.academicPeriodId) !== Number(periodId)) return 'Load this academic period before preparing the Scholar.';
  if (String(record.schoolType || '').toLowerCase() !== 'private') return 'Private-school grants only.';
  if (record.processRoute !== 'billing') return 'This Scholar is processed through Payroll.';
  if (record.status !== 'Active') return 'The Scholar account is inactive.';
  if (record.billed || record.inPayroll || record.notYetIncluded === false) return 'Locked: already included in a generated list.';
  if (record.processingEligibility?.eligible === false) return record.processingEligibility.message || 'This academic period is before the Scholar’s entry year.';
  const reasons = (record.billingEligibilityReasons || []).filter((reason) => reason.code !== 'GRANT_PREPARATION_REQUIRED');
  if (reasons.length) return reasons.map((reason) => reason.message).filter(Boolean).join(' ') || 'This Scholar is unavailable for Billing.';
  const total = Number(record.totalGrant ?? record.claimAmount ?? 5000);
  if (!Number.isFinite(total) || total < 0 || total > 99999999.99 || total !== Math.round(total * 100) / 100) return 'Reload the Scholar’s configured grant amount.';
  return '';
};

export const batchBillingDraft = (record) => ({
  tuition: record.tuitionFeeAssistance == null ? '' : String(record.tuitionFeeAssistance),
  preparedAt: record.grantPreparedAt || null,
  dirty: false,
  error: '',
});

export const mergeBatchBillingDrafts = (records, previous = {}) => Object.fromEntries(records.map((record) => [
  record.applicantId,
  previous[record.applicantId]?.dirty || previous[record.applicantId]?.error
    ? previous[record.applicantId]
    : batchBillingDraft(record),
]));

export const batchBillingAmount = (record, tuition) => {
  const total = Number(record.totalGrant ?? record.claimAmount ?? 5000);
  const amount = Number(tuition);
  const valid = Number.isFinite(total) && total >= 0 && total <= 99999999.99 && total === Math.round(total * 100) / 100
    && String(tuition ?? '').trim() !== '' && Number.isFinite(amount) && amount >= 0
    && amount <= total && amount === Math.round(amount * 100) / 100;
  return { total, amount, valid, allowance: valid ? (Math.round(total * 100) - Math.round(amount * 100)) / 100 : null };
};

export const buildBatchBillingEntries = (records, drafts, selectedIds, periodId) => {
  const ids = [...new Set(selectedIds)];
  if (!ids.length || ids.length > MAX_BATCH_GRANT_ROWS) return { entries: [], errors: {}, message: `Select between 1 and ${MAX_BATCH_GRANT_ROWS} Scholars.` };
  const byId = new Map(records.map((record) => [record.applicantId, record]));
  const entries = [], errors = {};
  ids.forEach((applicantId) => {
    const record = byId.get(applicantId);
    const blocker = record ? batchBillingBlocker(record, periodId) : 'Reload this Scholar before preparing the record.';
    const draft = drafts[applicantId];
    const amount = record && batchBillingAmount(record, draft?.tuition);
    const message = blocker || (!amount?.valid ? `Enter tuition assistance from PHP 0 to PHP ${amount?.total ?? 0}, with up to two decimal places.` : '');
    if (message) errors[applicantId] = message;
    else entries.push({ applicantId, tuitionFeeAssistance: amount.amount, preparedAt: draft?.preparedAt || null });
  });
  return { entries, errors, message: Object.keys(errors).length ? 'Check the selected rows before saving.' : '' };
};

// Treat a missing/duplicate server result as unconfirmed rather than claiming a save.
export const readBatchBillingResults = (body, requestedIds) => requestedIds.map((applicantId) => {
  const matches = (Array.isArray(body?.results) ? body.results : []).filter((result) => result?.applicantId === applicantId);
  const result = matches.length === 1 ? matches[0] : null;
  if (result?.success === true && result.grant?.grantPrepared === true
    && ['totalGrant', 'tuitionFeeAssistance', 'allowance'].every((key) => typeof result.grant[key] === 'number' && Number.isFinite(result.grant[key]))
    && typeof result.grant.grantPreparedAt === 'string' && result.grant.grantPreparedAt
    && Number.isFinite(new Date(result.grant.grantPreparedAt).getTime())) {
    const check = batchBillingAmount({ totalGrant: result.grant.totalGrant }, result.grant.tuitionFeeAssistance);
    if (check.valid && check.allowance === result.grant.allowance) return result;
  }
  return { applicantId, success: false, message: result?.message || 'The save could not be confirmed. Refresh the records before retrying.', statusCode: result?.statusCode };
});
