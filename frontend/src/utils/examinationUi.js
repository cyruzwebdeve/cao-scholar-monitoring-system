export const resultAcceptanceNotice = (result, initialVerified) => {
  if (result.isScholar) return { tone: 'complete', title: 'Scholar acceptance recorded', message: `Scholar account active${result.scholarId ? ` · ${result.scholarId}` : ''}. The examination result is locked after acceptance.` };
  if (result.status !== 'Passed') return { tone: 'waiting', title: result.status === 'Failed' ? 'Passing result required' : 'Awaiting a passing result', message: 'Only applicants whose latest examination result is passing can be accepted as scholars.' };
  if (result.resultId && !result.resultPublishedAt) return { tone: 'waiting', title: 'Publish the reviewed result first', message: 'The passing score is saved. Publish the reviewed result before Scholar acceptance.' };
  if (!initialVerified) return { tone: 'waiting', title: 'Initial verification required', message: 'Approve the required initial documents before accepting this applicant as a scholar.' };
  return { tone: 'ready', title: 'Ready for Scholar acceptance', message: 'A versioned recommendation snapshot and the staff decision will be recorded.' };
};

export const filterExamRoster = (rows, query, attendance) => {
  const search = String(query || '').trim().toLowerCase();
  return rows.filter(row => (!search || [row.name, row.email, row.controlNo].some(value => String(value || '').toLowerCase().includes(search)))
    && (attendance === 'all' || (row.attendanceStatus === 'Present' ? 'Present' : 'Pending') === attendance));
};
