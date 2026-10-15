const { getInitialRequirements, INITIAL_KEYS, continuingIsOpen } = require('./requirementWaves');
const { resolveRequirementSubmission } = require('./requirementSubmission');
const initialApproved = (docs, periodId, schoolType, legacyPeriodId = periodId) => {
  const type = String(schoolType || '').toLowerCase();
  if (!['public', 'private'].includes(type)) return false;
  const files = getInitialRequirements(docs, periodId, legacyPeriodId).requirements;
  return INITIAL_KEYS.filter((key) => key !== 'indigency' && (type === 'private' || key !== 'tuition_receipt')).every((key) =>
    files[key]?.fileName && ['approved', 'complete', 'completed'].includes(String(files[key]?.status || '').toLowerCase()));
};
const loadContinuingSchedule = (client, periodId) => client.continuing_requirement_schedules
  ? client.continuing_requirement_schedules.findUnique({ where: { academic_period_id: periodId } })
  : Promise.resolve(null); // Older test facades have no schedule model.
const evaluateContinuingSchedule = ({ schedule, period, docs, applicantId, schoolType, legacyPeriodId = period.id, now = new Date() }) => {
  if (!schedule) {
    const legacy = resolveRequirementSubmission(period, now);
    const opened = continuingIsOpen(docs, period.id);
    return { ...legacy, initialApproved: initialApproved(docs, period.id, schoolType, legacyPeriodId), isOpen: opened && legacy.isOpen, visible: opened, state: !opened ? 'waiting' : legacy.state, scheduled: false };
  }
  const ready = initialApproved(docs, period.id, schoolType, legacyPeriodId);
  const current = new Date(now).getTime();
  const opens = new Date(schedule.opens_at).getTime();
  const closes = new Date(schedule.closes_at).getTime();
  const allowedLate = schedule.late_scope === 'all' || schedule.late_applicant_ids.includes(applicantId);
  const lateOpens = schedule.late_opens_at ? new Date(schedule.late_opens_at).getTime() : null;
  const lateCloses = schedule.late_closes_at ? new Date(schedule.late_closes_at).getTime() : null;
  const regular = current >= opens && current <= closes;
  const late = allowedLate && lateOpens !== null && current >= lateOpens && current <= lateCloses;
  const state = !ready ? 'waiting_initial' : current < opens ? 'scheduled' : regular ? 'open' : late ? 'late_open' : allowedLate && lateOpens !== null && current < lateOpens ? 'late_scheduled' : 'closed';
  return { scheduled: true, initialApproved: ready, visible: ready && current >= opens, isOpen: ready && (regular || late), state,
    opensAt: new Date(schedule.opens_at).toISOString(), deadline: new Date(late || state === 'late_scheduled' ? schedule.late_closes_at : schedule.closes_at).toISOString(),
    regularDeadline: new Date(schedule.closes_at).toISOString(), lateOpensAt: allowedLate && schedule.late_opens_at ? new Date(schedule.late_opens_at).toISOString() : null,
    serverTime: new Date(now).toISOString() };
};
const projectContinuingAccess = (docs, periodId, access) => {
  if (!access.scheduled) return docs;
  const projected = JSON.parse(JSON.stringify(docs || {}));
  projected.requirementWaves ||= {};
  if (access.visible) projected.requirementWaves[periodId] = { ...projected.requirementWaves[periodId], continuingOpenedAt: access.opensAt };
  else delete projected.requirementWaves[periodId];
  return projected;
};
module.exports = { initialApproved, loadContinuingSchedule, evaluateContinuingSchedule, projectContinuingAccess };
