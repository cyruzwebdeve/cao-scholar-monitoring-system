import { canQueueForProcessing } from './processingVisibility.js';

const HANDOFF_KEY = 'pgceap-processing-handoff';
const HANDOFF_TTL_MS = 10 * 60 * 1000;

const validIds = (ids) => Array.isArray(ids) && ids.length > 0 && ids.length <= 100
  && ids.every((id) => Number.isSafeInteger(id) && id > 0) && new Set(ids).size === ids.length;

export const saveProcessingHandoff = ({ periodId, applicantId, applicantIds, actorId, mode }) => {
  if (!['billing', 'payroll'].includes(mode) || !Number.isSafeInteger(periodId) || periodId <= 0) return false;
  const batch = applicantIds !== undefined;
  if (batch ? mode !== 'billing' || !validIds(applicantIds) || !Number.isSafeInteger(actorId) || actorId <= 0
    : !Number.isSafeInteger(applicantId) || applicantId <= 0) return false;
  try {
    const selection = batch ? { applicantIds, actorId, queuePrepared: true } : { applicantId };
    sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ periodId, ...selection, mode, createdAt: Date.now() }));
    return true;
  } catch {
    return false;
  }
};

export const readProcessingHandoff = (mode, actorId) => {
  try {
    const handoff = JSON.parse(sessionStorage.getItem(HANDOFF_KEY) || 'null');
    const valid = handoff
      && handoff.mode === mode
      && Number.isSafeInteger(handoff.periodId) && handoff.periodId > 0
      && (handoff.queuePrepared === true
        ? mode === 'billing' && validIds(handoff.applicantIds) && handoff.actorId === actorId && Number.isSafeInteger(actorId) && actorId > 0
        : Number.isSafeInteger(handoff.applicantId) && handoff.applicantId > 0)
      && Number.isFinite(handoff.createdAt) && Date.now() >= handoff.createdAt
      && Date.now() - handoff.createdAt <= HANDOFF_TTL_MS;
    if (!valid) {
      if (handoff && (handoff.mode === mode || Date.now() - Number(handoff.createdAt) > HANDOFF_TTL_MS)) sessionStorage.removeItem(HANDOFF_KEY);
      return null;
    }
    return handoff;
  } catch {
    try { sessionStorage.removeItem(HANDOFF_KEY); } catch { /* Session storage is optional. */ }
    return null;
  }
};

export const clearProcessingHandoff = () => {
  try { sessionStorage.removeItem(HANDOFF_KEY); } catch { /* Session storage is optional. */ }
};
export const preparedBillingQueueIds = (handoff, records, periodId, actorId) => {
  if (!handoff || handoff.queuePrepared !== true || handoff.mode !== 'billing'
    || !Number.isSafeInteger(actorId) || actorId <= 0 || !Number.isSafeInteger(periodId) || periodId <= 0
    || handoff.actorId !== actorId || handoff.periodId !== periodId || !validIds(handoff.applicantIds)) return [];
  return handoff.applicantIds.filter((id) => records.some((record) => record.applicantId === id
    && record.academicPeriodId === periodId && record.grantPrepared === true && canQueueForProcessing(record, 'billing')));
};
