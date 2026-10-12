export const getApplicantExaminationSummary = (examination = {}) => {
  if (examination.isScholar) return { title: 'Accepted as scholar', description: 'CAO has recorded your scholarship acceptance.' };
  if (['Rejected', 'Declined', 'Withdrawn'].includes(examination.status)) return { title: examination.status, description: 'Contact CAO for guidance on the recorded application decision.' };
  if (examination.published) return {
    title: examination.status,
    description: examination.status === 'Passed'
      ? 'You passed the examination. Scholarship acceptance remains subject to CAO review.'
      : 'You did not meet the examination passing score. Contact CAO for guidance; this is not a final application rejection.',
  };
  if (examination.completed) return {
    title: 'Result under review',
    description: examination.deliveryMode === 'paper'
      ? 'CAO has recorded your paper examination score. Your examination result is under review.'
      : 'Your examination submission was recorded. CAO will publish the reviewed result.',
  };
  if (examination.attemptExpired || examination.status === 'Attempt expired') return { title: 'Attempt expired', description: 'Your examination was not submitted before its deadline. Contact CAO for guidance; reopening does not restart the timer.' };
  if (examination.attendance?.status === 'Present') return {
    title: 'For review',
    description: examination.deliveryMode === 'paper'
      ? 'Your attendance is confirmed. Await CAO recording and review of your paper examination result.'
      : 'Your attendance is confirmed. Complete the online examination during your authorized schedule.',
  };
  if (examination.schedule) return { title: 'Scheduled', description: 'Review your examination date, venue, and instructions below.' };
  return { title: 'Not scheduled', description: 'CAO will publish your examination schedule.' };
};
