const classificationOf = (record) => String(record.schoolType || '').trim().toLowerCase();
export const isVisibleInProcessingMode = (record, mode) => {
  const classification = classificationOf(record);
  if (!['public', 'private'].includes(classification)) return true;
  return record.processRoute ? record.processRoute === mode : classification === (mode === 'payroll' ? 'public' : 'private');
};
export const canQueueForProcessing = (record, mode) => (
  !record.isArchivedPeriod
  && ['public', 'private'].includes(classificationOf(record))
  && record.processRoute === mode
  && record.processEligible === true
  && (mode === 'payroll' ? !record.inPayroll : !record.billed)
);
