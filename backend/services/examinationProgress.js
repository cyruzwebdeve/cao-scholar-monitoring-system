const { onlineAttemptState } = require('./examinationAttemptState');
const { isExaminationApplicationEligible } = require('./examinationEligibility');
// Attendance is a review signal, never proof of completion or a passing result.
const isEarlyStatus = (status) => /^(pending|applied|submitted|for review)$/i.test(String(status || 'Pending'));
const resolveExaminationProgress = ({ result, scholar, examSlot, fallbackStatus = 'Pending', applicationStatus, applicantFacing = false, scheduledExam, now = Date.now() } = {}) => {
  const isScholar = Boolean(scholar?.is_active);
  const completed = Boolean(result);
  const attendanceStatus = examSlot?.appeared ? 'Present' : examSlot?.forfeited_at ? 'Absent' : 'Pending';
  const normalizedFallback = String(applicationStatus && !isEarlyStatus(applicationStatus) ? applicationStatus : fallbackStatus || 'Pending');
  const earlyStatus = isEarlyStatus(normalizedFallback);
  const published = Boolean(result?.published_at);
  const applicantResultStatus = published ? result.passed ? 'Passed' : 'Did not pass' : result?.delivery_mode ? 'Result under review' : 'Waiting for results';
  const status = isScholar ? 'Accepted as scholar'
    : completed ? (applicantFacing ? applicantResultStatus : result.passed ? 'Passed' : 'Exam Completed')
      : attendanceStatus === 'Present' && earlyStatus ? 'For review'
        : applicantFacing && earlyStatus && scheduledExam?.is_active ? 'Scheduled'
          : normalizedFallback.toLowerCase() === 'pending' ? 'Pending' : normalizedFallback;
  const attemptExpired = !completed && !isScholar && onlineAttemptState(examSlot, now) === 'expired' && isExaminationApplicationEligible({ status: normalizedFallback });
  const effectiveStatus = attemptExpired ? 'Attempt expired' : status;
  const resultStatus = completed ? (result.passed ? 'Passed' : 'Failed')
    : isScholar ? 'Accepted as scholar'
      : !earlyStatus ? normalizedFallback : attendanceStatus === 'Present' ? 'For review' : 'Pending';
  return { status: effectiveStatus, resultStatus: attemptExpired ? effectiveStatus : applicantFacing ? status : resultStatus, attemptExpired, attendanceStatus, completed, isScholar, published };
};

module.exports = { resolveExaminationProgress };
