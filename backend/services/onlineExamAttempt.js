const { loadConfiguration, assertAutomaticGrading } = require('./onlineExamConfiguration');
const ATTEMPT_DURATION_MS = 45 * 60 * 1000;
class AttemptError extends Error {
  constructor(message, status = 409) { super(message); this.status = status; }
}
const assertAttemptOpen = (slot, now = Date.now()) => {
  if (!slot?.online_started_at || !slot.online_deadline_at || !Number.isFinite(new Date(slot.online_started_at).getTime()) || !Number.isFinite(new Date(slot.online_deadline_at).getTime()) || !Number.isSafeInteger(slot.online_configuration_id) || slot.online_configuration_id < 0) {
    throw new AttemptError('Reopen the examination from your dashboard to start a timed attempt.');
  }
  if (new Date(slot.online_deadline_at).getTime() <= now) {
    throw new AttemptError('Your 45-minute examination time has expired. Late answers cannot be submitted. Contact CAO.', 410);
  }
};
const getOrStartAttempt = async (client, slot, now = Date.now()) => {
  if (!slot.online_started_at) {
    const configuration = await loadConfiguration(client);
    try { assertAutomaticGrading(configuration); }
    catch { throw new AttemptError('The online question bank requires CAO review before this examination can start. Contact the Scholarship Office.'); }
    // Only the first opener can claim this slot. Concurrent tabs reread its winner.
    await client.exam_slots.updateMany({
      where: { id: slot.id, online_started_at: null },
      data: { online_started_at: new Date(now), online_deadline_at: new Date(now + ATTEMPT_DURATION_MS), online_configuration_id: configuration.id },
    });
    slot = await client.exam_slots.findUnique({ where: { id: slot.id } });
  }
  assertAttemptOpen(slot, now);
  const configuration = await loadConfiguration(client, slot.online_configuration_id);
  try { assertAutomaticGrading(configuration); }
  catch { throw new AttemptError('This question version requires CAO review before continuing the examination.'); }
  return { slot, configuration };
};
module.exports = { ATTEMPT_DURATION_MS, AttemptError, assertAttemptOpen, getOrStartAttempt };
