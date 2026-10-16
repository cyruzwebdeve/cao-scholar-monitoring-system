const { getInitialRequirements, INITIAL_KEYS } = require('./requirementWaves');
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
const evaluateContinuingSchedule = ({ schedule, period, docs, schoolType, legacyPeriodId = period.id, now = new Date() }) => {
  const ready = initialApproved(docs, period.id, schoolType, legacyPeriodId);
  const enabled = period.is_active !== false && schedule?.uploads_open !== false;
  return { scheduled: true, initialApproved: ready, visible: ready, isOpen: ready && enabled,
    state: !ready ? 'waiting_initial' : enabled ? 'open' : 'closed',
    opensAt: null, deadline: null, regularDeadline: null, lateOpensAt: null,
    serverTime: new Date(now).toISOString() };
};
const projectContinuingAccess = (docs, periodId, access) => {
  if (!access.scheduled) return docs;
  const projected = JSON.parse(JSON.stringify(docs || {}));
  projected.requirementWaves ||= {};
  if (access.visible) projected.requirementWaves[periodId] = { ...projected.requirementWaves[periodId], continuingOpenedAt: projected.requirementWaves[periodId]?.continuingOpenedAt || 'period-access' };
  else delete projected.requirementWaves[periodId];
  return projected;
};
module.exports = { initialApproved, loadContinuingSchedule, evaluateContinuingSchedule, projectContinuingAccess };
