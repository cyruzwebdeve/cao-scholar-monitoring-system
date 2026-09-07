const HANDOFF_KEY = 'pgceap-processing-handoff';
const HANDOFF_TTL_MS = 10 * 60 * 1000;

export const saveProcessingHandoff = ({ periodId, applicantId, mode }) => {
  if (!['billing', 'payroll'].includes(mode) || !Number.isInteger(periodId) || !Number.isInteger(applicantId)) return false;
  try {
    sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ periodId, applicantId, mode, createdAt: Date.now() }));
    return true;
  } catch {
    return false;
  }
};

export const readProcessingHandoff = (mode) => {
  try {
    const handoff = JSON.parse(sessionStorage.getItem(HANDOFF_KEY) || 'null');
    const valid = handoff
      && handoff.mode === mode
      && Number.isInteger(handoff.periodId)
      && Number.isInteger(handoff.applicantId)
      && Date.now() - Number(handoff.createdAt) <= HANDOFF_TTL_MS;
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
