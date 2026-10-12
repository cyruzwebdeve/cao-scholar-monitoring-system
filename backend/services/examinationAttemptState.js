const onlineAttemptState = (slot, now = Date.now()) => {
  if (!slot?.online_started_at) return 'not_started';
  const deadline = +new Date(slot.online_deadline_at);
  if (!slot.online_deadline_at || !Number.isFinite(deadline)) return 'unavailable';
  return deadline <= +now ? 'expired' : 'active';
};
module.exports = { onlineAttemptState };
