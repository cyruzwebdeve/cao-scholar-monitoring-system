export const filterMetricRows = (rows, query, columns) => {
  const search = String(query || '').trim().toLowerCase();
  return search ? rows.filter(row => columns.some(column => String(row[column.key] ?? '').toLowerCase().includes(search))) : rows;
};
export const metricPage = (rows, page = 1, pageSize = 25) => {
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.max(1, Math.min(Number(page) || 1, pages));
  return { rows: rows.slice((current - 1) * pageSize, current * pageSize), total, page: current, pages };
};
export const personColumns = [{ key: 'name', label: 'Name' }, { key: 'controlNo', label: 'Control no.' }, { key: 'municipality', label: 'Municipality' }, { key: 'status', label: 'Status' }];

export const scholarMetricRows = (rows, label) => rows.filter(row => label === 'Active Scholars' ? row.status === 'Active' : label === 'Documents Complete' ? row.documentStatus === 'Complete' : label === 'For Review' ? row.documentStatus === 'Review' : true);
export const resultMetricRows = (rows, label) => rows.filter(row => label === 'For Review' ? row.status === 'For review' : label === 'Passed' ? row.status === 'Passed' : label === 'Failed' ? row.status === 'Failed' : ['Scored', 'Completed'].includes(label) ? ['Passed', 'Failed'].includes(row.status) : true);
export const documentMetricRows = (rows, label) => rows.filter(row => label === 'Pending review' ? row.status === 'pending' : label === 'Approved' ? row.status === 'approved' : label === 'Rejected' ? row.status === 'rejected' : true);
export const staffMetricRows = (rows, label) => rows.filter(row => label === 'Active staff' ? row.isActive : label === 'Inactive staff' ? !row.isActive : label === 'Provincial admins' ? row.isActive && row.role === 'SuperAdmin' : true);
export const billingMetricRows = (rows, label) => rows.filter(row => label === 'For Payroll' ? !row.inPayroll : ['In Payroll', 'Generated Lists'].includes(label) ? row.inPayroll : label === 'For Certification' ? !row.billed : label === 'Certification Listed' ? row.billed : true);
