import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeadlineClock, remainingAttemptSeconds } from '../src/utils/examinationDeadline.js';
test('countdown follows server remaining time and elapsed time even after missed ticks', () => {
  const clock = createDeadlineClock({ serverTime: '2026-10-11T10:00:00Z', deadlineAt: '2026-10-11T10:45:00Z' }, 500);
  assert.equal(remainingAttemptSeconds(clock, 500), 2700);
  assert.equal(remainingAttemptSeconds(clock, 60500), 2640);
  assert.equal(remainingAttemptSeconds(clock, 2700500), 0);
  assert.equal(remainingAttemptSeconds(clock, 3000500), 0);
});
test('reopening derives remaining time rather than a fresh 45-minute countdown', () => {
  const clock = createDeadlineClock({ serverTime: '2026-10-11T10:30:00Z', deadlineAt: '2026-10-11T10:45:00Z' }, 100);
  assert.equal(remainingAttemptSeconds(clock, 100), 900);
  assert.throws(() => createDeadlineClock({}, 0), /deadline/);
});
