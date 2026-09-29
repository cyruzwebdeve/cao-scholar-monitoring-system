export const ROUTINE_DATA_REFRESH_MS = 5 * 60 * 1000;
export const TIME_SENSITIVE_DATA_REFRESH_MS = 2 * 60 * 1000;
export const RETURN_REFRESH_MIN_AGE_MS = 60 * 1000;

export const subscribeToVisibleRefresh = (
  refresh,
  {
    intervalMs = ROUTINE_DATA_REFRESH_MS,
    minReturnAgeMs = RETURN_REFRESH_MIN_AGE_MS,
    windowObject = window,
    documentObject = document,
    now = Date.now,
  } = {},
) => {
  let lastRefreshAt = now();
  let disposed = false;

  const refreshIfEligible = (force = false) => {
    if (disposed || documentObject.visibilityState !== 'visible') return false;
    const currentTime = now();
    if (!force && currentTime - lastRefreshAt < minReturnAgeMs) return false;
    lastRefreshAt = currentTime;
    refresh();
    return true;
  };

  const refreshOnReturn = () => refreshIfEligible(false);
  const refreshWhenVisible = () => {
    if (documentObject.visibilityState === 'visible') refreshOnReturn();
  };
  const timer = windowObject.setInterval(() => refreshIfEligible(true), intervalMs);

  windowObject.addEventListener('focus', refreshOnReturn);
  documentObject.addEventListener('visibilitychange', refreshWhenVisible);

  return () => {
    disposed = true;
    windowObject.clearInterval(timer);
    windowObject.removeEventListener('focus', refreshOnReturn);
    documentObject.removeEventListener('visibilitychange', refreshWhenVisible);
  };
};
