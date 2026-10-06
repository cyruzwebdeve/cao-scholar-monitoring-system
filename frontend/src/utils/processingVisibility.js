const classificationOf = (record) => String(record.schoolType || '').trim().toLowerCase();

export const isVisibleInProcessingMode = (record, mode) => {
  const classification = classificationOf(record);
  // Unknown classification needs a visible correction path, not a hidden row.
  if (!['public', 'private'].includes(classification)) return true;
  return classification === (mode === 'payroll' ? 'public' : 'private');
};

export const canQueueForProcessing = (record, mode) => (
  !record.isArchivedPeriod
  && classificationOf(record) === (mode === 'payroll' ? 'public' : 'private')
  && record.processRoute === mode
  && record.processEligible === true
  && (mode === 'payroll' ? !record.inPayroll : !record.billed)
);

export const canOverrideForProcessing = (record, mode, userRole) => {
  const reasons = record.billingEligibilityReasons;
  return ['SuperAdmin', 'BillingPayrollAdmin'].includes(userRole)
    && !record.isArchivedPeriod
    && record.status === 'Active'
    && classificationOf(record) === (mode === 'payroll' ? 'public' : 'private')
    && record.processRoute === mode
    && !record.processEligible
    && !record.inPayroll && !record.billed
    && Array.isArray(reasons) && reasons.length > 0
    && reasons.every(({ code }) => ['REQUIREMENT_MISSING', 'REQUIREMENT_NOT_APPROVED'].includes(code));
};
