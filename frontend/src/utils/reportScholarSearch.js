const normalize = value => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
// Only fields needed for this read-only report reach the table/export rows.
export const buildScholarReportRows = scholars => scholars.flatMap(scholar => {
  const base = { applicantId: scholar.applicantId, name: scholar.name || 'Not specified', controlNumber: scholar.controlNumber || '', school: scholar.school || 'Not specified', municipality: scholar.municipality || '', barangay: scholar.barangay || '', course: scholar.course || '', accountStatus: scholar.status || '' };
  const project = (record, historical) => {
    const reference = record.inPayroll ? record.payReference : record.billed ? record.billingReference : '';
    return { ...base, id: `${scholar.applicantId}:${record.academicPeriodId ?? 'legacy'}:${reference || (historical ? record.dateProcessed || 'history' : 'current')}`, schoolYear: record.schoolYear || 'Legacy period', semester: record.semester || 'Not specified', listStatus: record.inPayroll ? 'Payroll listed' : record.billed ? 'Certification listed' : 'Not listed', reference: reference || '', historical };
  };
  const rows = [project(scholar, false)];
  const seen = new Set(rows.map(row => row.id));
  for (const history of scholar.financialHistory || []) {
    if (history.isActivePeriod || (history.academicPeriodId != null && history.academicPeriodId === scholar.academicPeriodId)) continue;
    const row = project(history, true);
    if (!seen.has(row.id)) { rows.push(row); seen.add(row.id); }
  }
  return rows;
}).sort((a, b) => a.name.localeCompare(b.name) || Number(a.historical) - Number(b.historical) || b.schoolYear.localeCompare(a.schoolYear) || a.semester.localeCompare(b.semester) || a.id.localeCompare(b.id));

export const filterScholarReportRows = (rows, query = '', schoolYear = 'All School Years') => {
  const terms = normalize(query).split(' ').filter(Boolean);
  return rows.filter(row => (schoolYear === 'All School Years' || row.schoolYear === schoolYear)
    && terms.every(term => normalize([row.name, row.controlNumber, row.school, row.course, row.municipality, row.barangay, row.schoolYear, row.semester, row.listStatus, row.reference, row.accountStatus].join(' ')).includes(term)));
};
export const scholarReportColumns = [
  ['controlNumber', 'Control Number'], ['name', 'Scholar Name'], ['school', 'Current School'], ['schoolYear', 'School Year'], ['semester', 'Semester'], ['accountStatus', 'Current Account Status'], ['listStatus', 'List Status'], ['reference', 'List Reference'], ['municipality', 'Municipality'], ['barangay', 'Barangay'], ['course', 'Current Course'],
].map(([field, label]) => ({ key: `scholar-${field}`, label, group: 'Scholar records', defaultSelected: false, value: record => record[field] }));
