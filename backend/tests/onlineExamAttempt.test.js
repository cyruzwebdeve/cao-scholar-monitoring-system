const test = require('node:test');
const assert = require('node:assert/strict');
const { getOrStartAttempt, assertAttemptOpen } = require('../services/onlineExamAttempt');
const { objectiveConfiguration } = require('./fixtures/objectiveExam');
test('concurrent first openers receive one persisted start, deadline and marking version', async () => {
  const config = objectiveConfiguration();
  let saved = { id: 9 };
  let claims = 0;
  const client = {
    online_exam_configurations: { findFirst: async () => ({ ...config, id: 1, passing_score: 14 }), findUnique: async () => ({ ...config, id: 1, passing_score: 14 }) },
    exam_slots: {
      updateMany: async ({ data }) => { if (saved.online_started_at) return { count: 0 }; claims++; saved = { ...saved, ...data }; return { count: 1 }; },
      findUnique: async () => saved,
    },
  };
  const [a, b] = await Promise.all([getOrStartAttempt(client, { id: 9 }, 1000), getOrStartAttempt(client, { id: 9 }, 2000)]);
  assert.equal(claims, 1);
  assert.equal(a.slot.online_deadline_at.getTime(), b.slot.online_deadline_at.getTime());
  assert.equal(a.slot.online_configuration_id, b.slot.online_configuration_id);
});
test('deadline boundary is strict and incomplete attempts cannot submit', () => {
  const slot = { online_started_at: new Date(1000), online_deadline_at: new Date(2701000), online_configuration_id: 1 };
  assert.doesNotThrow(() => assertAttemptOpen(slot, 2700999));
  assert.throws(() => assertAttemptOpen(slot, 2701000), (error) => error.status === 410);
  assert.throws(() => assertAttemptOpen({}, 1000), (error) => error.status === 409);
  assert.throws(() => assertAttemptOpen({ ...slot, online_deadline_at: 'invalid' }, 1000), (error) => error.status === 409);
});
