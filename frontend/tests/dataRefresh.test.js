import test from 'node:test';
import assert from 'node:assert/strict';
import { subscribeToVisibleRefresh } from '../src/utils/dataRefresh.js';

const createEventTarget = () => {
  const listeners = new Map();
  return {
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type, listener) { if (listeners.get(type) === listener) listeners.delete(type); },
    dispatch(type) { listeners.get(type)?.(); },
    has(type) { return listeners.has(type); },
  };
};

test('visible refresh polling pauses while hidden and refreshes a stale returning tab once', () => {
  let currentTime = 0;
  let intervalCallback;
  let refreshes = 0;
  const windowTarget = createEventTarget();
  const documentTarget = { ...createEventTarget(), visibilityState: 'visible' };
  const windowObject = {
    ...windowTarget,
    setInterval(callback) { intervalCallback = callback; return 7; },
    clearInterval(id) { assert.equal(id, 7); },
  };

  const dispose = subscribeToVisibleRefresh(() => { refreshes += 1; }, {
    intervalMs: 300_000,
    minReturnAgeMs: 60_000,
    windowObject,
    documentObject: documentTarget,
    now: () => currentTime,
  });

  currentTime = 30_000;
  windowObject.dispatch('focus');
  assert.equal(refreshes, 0);

  documentTarget.visibilityState = 'hidden';
  currentTime = 300_000;
  intervalCallback();
  assert.equal(refreshes, 0);

  documentTarget.visibilityState = 'visible';
  documentTarget.dispatch('visibilitychange');
  windowObject.dispatch('focus');
  assert.equal(refreshes, 1);

  currentTime = 600_000;
  intervalCallback();
  assert.equal(refreshes, 2);

  dispose();
  assert.equal(windowObject.has('focus'), false);
  assert.equal(documentTarget.has('visibilitychange'), false);
});
