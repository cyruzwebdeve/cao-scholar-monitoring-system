// Attendance is a review signal, never proof of completion or a passing result.
const isEarlyStatus = (status) => /^(pending|applied|submitted|for review)$/i.test(String(status || 'Pending'));
const resolveExaminationProgress = ({ result, scholar, examSlot, fallbackStatus = 'Pending', applicationStatus, applicantFacing = false } = {}) => {
  const isScholar = Boolean(scholar?.is_active);
  const completed = Boolean(result);
  const attendanceStatus = examSlot?.appeared ? 'Present' : examSlot?.forfeited_at ? 'Absent' : 'Pending';
  const normalizedFallback = String(applicationStatus && !isEarlyStatus(applicationStatus) ? applicationStatus : fallbackStatus || 'Pending');
  const earlyStatus = isEarlyStatus(normalizedFallback);
  const status = isScholar ? 'Accepted as scholar'
    : completed ? (applicantFacing ? 'Waiting for results' : result.passed ? 'Passed' : 'Exam Completed')
      : attendanceStatus === 'Present' && earlyStatus ? 'For review'
        : normalizedFallback.toLowerCase() === 'pending' ? 'Pending' : normalizedFallback;
  const resultStatus = completed ? (result.passed ? 'Passed' : 'Failed')
    : isScholar ? 'Accepted as scholar'
      : !earlyStatus ? normalizedFallback : attendanceStatus === 'Present' ? 'For review' : 'Pending';
  return { status, resultStatus: applicantFacing ? status : resultStatus, attendanceStatus, completed, isScholar };
};

module.exports = { resolveExaminationProgress };
