export const matchesPayrollListStatus = (record, status) => {
  if (status === 'All Payroll Statuses') return true;
  if (status === 'Included in payroll list') return record.inPayroll === true;
  if (status === 'Not included yet') return record.inPayroll !== true && record.billed !== true && record.notYetIncluded !== false;
  return false;
};
