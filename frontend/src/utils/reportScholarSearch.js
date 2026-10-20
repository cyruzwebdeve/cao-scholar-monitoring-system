const normalize = value => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
export const reportMoneyCents = value => {
  if (!['number', 'string'].includes(typeof value) || (typeof value === 'string' && !/^\d+(?:\.\d{1,2})?$/.test(value.trim()))) return null;
  const number = Number(value), cents = Math.round(number * 100);
  return Number.isFinite(number) && number >= 0 && number <= 99999999.99 && number === cents / 100 ? cents : null;
};
export const formatReportMoney = value => value == null ? 'Not recorded' : new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);
// Only fields needed for this read-only report reach the table/export rows.
export const buildScholarReportRows = scholars => scholars.flatMap(scholar => {
  const base = { applicantId: scholar.applicantId, name: scholar.name || 'Not specified', controlNumber: scholar.controlNumber || '', school: scholar.school || 'Not specified', municipality: scholar.municipality || '', barangay: scholar.barangay || '', course: scholar.course || '', accountStatus: scholar.status || '' };
  const project = (record, historical) => {
    const reference = record.inPayroll ? record.payReference : record.billed ? record.billingReference : '';
    const payroll = record.inPayroll === true;
    const amount = payroll ? reportMoneyCents(record.claimAmount) : null;
    const tuition = payroll ? reportMoneyCents(record.tuitionFeeAssistance) : null;
    const allowance = payroll ? reportMoneyCents(record.allowance) : null;
    const recordedBreakdown = amount != null && tuition != null && allowance != null && tuition + allowance === amount;
    return { ...base, payrollAmount: amount == null ? null : amount / 100, tuitionAmount: recordedBreakdown ? tuition / 100 : null, allowanceAmount: recordedBreakdown ? allowance / 100 : null, breakdownStatus: payroll ? recordedBreakdown ? 'Recorded' : 'Not recorded' : 'Not applicable', id: `${scholar.applicantId}:${record.academicPeriodId ?? 'legacy'}:${reference || (historical ? record.dateProcessed || 'history' : 'current')}`, schoolYear: record.schoolYear || 'Legacy period', semester: record.semester || 'Not specified', listStatus: record.inPayroll ? 'Payroll listed' : record.billed ? 'Certification listed' : 'Not listed', reference: reference || '', historical };
  };
  const currentMembership = (scholar.financialHistory || []).find(history => history.isActivePeriod || (history.academicPeriodId != null && history.academicPeriodId === scholar.academicPeriodId));
  // Prefer the saved membership snapshot to a current/default grant projection.
  const rows = [project({ ...scholar, ...currentMembership }, false)];
  const seen = new Set(rows.map(row => row.id));
  for (const history of scholar.financialHistory || []) {
    if (history.isActivePeriod || (history.academicPeriodId != null && history.academicPeriodId === scholar.academicPeriodId)) continue;
    const row = project(history, true);
    if (!seen.has(row.id)) { rows.push(row); seen.add(row.id); }
  }
  return rows;
}).sort((a, b) => a.name.localeCompare(b.name) || Number(a.historical) - Number(b.historical) || b.schoolYear.localeCompare(a.schoolYear) || a.semester.localeCompare(b.semester) || a.id.localeCompare(b.id));

export const filterScholarReportRows = (rows, query = '', schoolYear = 'All School Years', listType = 'all') => {
  const terms = normalize(query).split(' ').filter(Boolean);
  return rows.filter(row => (schoolYear === 'All School Years' || row.schoolYear === schoolYear)
    && (listType === 'all' || row.listStatus === ({ payroll: 'Payroll listed', certification: 'Certification listed', unlisted: 'Not listed' })[listType])
    && terms.every(term => normalize([row.name, row.controlNumber, row.school, row.course, row.municipality, row.barangay, row.schoolYear, row.semester, row.listStatus, row.reference, row.accountStatus].join(' ')).includes(term)));
};
export const scholarReportColumns = [
  ['controlNumber', 'Control Number'], ['name', 'Scholar Name'], ['school', 'Current School'], ['schoolYear', 'School Year'], ['semester', 'Semester'], ['accountStatus', 'Current Account Status'], ['listStatus', 'List Status'], ['reference', 'List Reference'], ['payrollAmount', 'Payroll List Amount (PHP)'], ['tuitionAmount', 'Recorded Tuition Assistance (PHP)'], ['allowanceAmount', 'Recorded Allowance (PHP)'], ['breakdownStatus', 'Breakdown Status'], ['municipality', 'Municipality'], ['barangay', 'Barangay'], ['course', 'Current Course'],
].map(([field, label]) => ({ key: `scholar-${field}`, label, group: 'Scholar records', defaultSelected: false, value: record => record[field] }));

// Sum saved list values in integer cents; never infer missing allowance splits.
export const summarizePayrollReport = rows => {
  const memberships = [...new Map(rows.filter(row => row.listStatus === 'Payroll listed').map(row => [row.id, row])).values()];
  const amounts = memberships.map(row => reportMoneyCents(row.payrollAmount));
  const breakdowns = memberships.filter(row => row.breakdownStatus === 'Recorded');
  const cents = amounts.reduce((sum, value) => sum + (value ?? 0), 0);
  const tuition = breakdowns.reduce((sum, row) => sum + (reportMoneyCents(row.tuitionAmount) ?? 0), 0);
  const allowance = breakdowns.reduce((sum, row) => sum + (reportMoneyCents(row.allowanceAmount) ?? 0), 0);
  const safe = [cents, tuition, allowance].every(Number.isSafeInteger);
  return { payrollAmount: safe && (!memberships.length || amounts.some(value => value != null)) ? cents / 100 : null, tuitionAmount: safe && breakdowns.length ? tuition / 100 : null, allowanceAmount: safe && breakdowns.length ? allowance / 100 : null, entries: memberships.length, scholars: new Set(memberships.map(row => row.applicantId)).size, lists: new Set(memberships.map(row => row.reference).filter(Boolean)).size, recordedBreakdowns: breakdowns.length, missingAmounts: amounts.filter(value => value == null).length, missingBreakdowns: memberships.length - breakdowns.length, overflow: !safe };
};
