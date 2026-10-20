import { formatReportMoney, reportMoneyCents, summarizePayrollReport } from './reportScholarSearch.js';

const membershipColumns = [
  { key: 'name', label: 'Scholar' }, { key: 'controlNumber', label: 'Control no.' },
  { key: 'schoolYear', label: 'School year' }, { key: 'semester', label: 'Semester' },
  { key: 'reference', label: 'Payroll list' }, { key: 'amount', label: 'Recorded amount' },
];
const titles = { payroll: 'Payroll list amount', tuition: 'Recorded tuition assistance', allowance: 'Recorded allowance', scholars: 'Scholars on payroll' };
export function payrollSummaryDetails(rows, kind) {
  const memberships = [...new Map(rows.filter(row => row.listStatus === 'Payroll listed').map(row => [row.id, row])).values()];
  const summary = summarizePayrollReport(memberships);
  const scope = 'Uses the current Reports search, school year and list-status filters across all pages. These are generated payroll-list records, not confirmed payments.';
  if (kind === 'scholars') {
    const groups = new Map();
    for (const row of memberships) { if (!groups.has(row.applicantId)) groups.set(row.applicantId, []); groups.get(row.applicantId).push(row); }
    return { title: titles[kind], description: `Each Scholar appears once, including their matching list memberships. ${scope}`, columns: [
      { key: 'name', label: 'Scholar' }, { key: 'controlNumber', label: 'Control no.' },
      { key: 'entries', label: 'Payroll entries' }, { key: 'lists', label: 'Payroll lists' },
      { key: 'amount', label: 'Recorded payroll total' }, { key: 'coverage', label: 'Amount coverage' },
    ], rows: [...groups.entries()].map(([id, records]) => {
      const totals = summarizePayrollReport(records);
      return { id, name: records[0].name, controlNumber: records[0].controlNumber || '—', entries: totals.entries, lists: [...new Set(records.map(row => row.reference).filter(Boolean))].join(', ') || 'Not recorded', amount: formatReportMoney(totals.payrollAmount), coverage: `${totals.entries - totals.missingAmounts} of ${totals.entries} entries have recorded amounts` };
    }) };
  }
  const field = { payroll: 'payrollAmount', tuition: 'tuitionAmount', allowance: 'allowanceAmount' }[kind];
  const known = memberships.filter(row => (kind === 'payroll' || row.breakdownStatus === 'Recorded') && reportMoneyCents(row[field]) != null);
  const missing = kind === 'payroll' ? summary.missingAmounts : summary.missingBreakdowns;
  return { title: titles[kind], description: `${known.length} matching payroll entries contribute to this total. ${missing ? `${missing} entries have no ${kind === 'payroll' ? 'valid recorded amount' : 'complete saved tuition/allowance breakdown'} and are excluded; missing data is not zero. ` : ''}${scope}`, columns: membershipColumns, rows: known.map(row => ({ id: row.id, name: row.name, controlNumber: row.controlNumber || '—', schoolYear: row.schoolYear, semester: row.semester, reference: row.reference || 'Not recorded', amount: formatReportMoney(row[field]) })) };
}
