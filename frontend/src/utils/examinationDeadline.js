export const createDeadlineClock = (attempt, receivedAt) => {
  const deadline = Date.parse(attempt?.deadlineAt);
  const serverTime = Date.parse(attempt?.serverTime);
  if (!Number.isFinite(deadline) || !Number.isFinite(serverTime)) throw new Error('The timed examination deadline is unavailable. Reopen the examination from your dashboard.');
  return { remainingMs: Math.max(0, deadline - serverTime), receivedAt };
};
// Elapsed monotonic time handles delayed ticks, background tabs and local clock edits.
export const remainingAttemptSeconds = (clock, now) => clock
  ? Math.max(0, Math.ceil((clock.remainingMs - Math.max(0, now - clock.receivedAt)) / 1000))
  : 0;
