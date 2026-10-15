const { getWaveSet } = require('./requirementWaves');
// Initial sets always enter Payroll. Later Private sets use certification except
// actual submissions in an authorized late window, which enter Payroll too.
const resolveProcessingRoute = ({ schoolType, docs, period, schedule, applicantId, legacyPeriodId = period.id }) => {
  const initialPeriodId = docs?.initialRequirementPeriodId || legacyPeriodId;
  if (initialPeriodId === period.id) return 'payroll';
  const allowedLate = schedule && (schedule.late_scope === 'all' || (schedule.late_applicant_ids || []).includes(applicantId));
  const from = schedule?.late_opens_at ? +new Date(schedule.late_opens_at) : NaN;
  const to = schedule?.late_closes_at ? +new Date(schedule.late_closes_at) : NaN;
  const late = allowedLate && Object.values(getWaveSet(docs, period.id, 'continuing', legacyPeriodId).requirements).some((file) => {
    const at = +new Date(file.uploadedAt);
    return at >= from && at <= to;
  });
  return late || String(schoolType).toLowerCase() !== 'private' ? 'payroll' : 'billing';
};
module.exports = { resolveProcessingRoute };
