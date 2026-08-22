const assert = require('node:assert/strict');
const test = require('node:test');

const {
  getApplicationAvailability,
  resolveApplicationAvailability,
} = require('../services/applicationAvailability');

const windowSettings = {
  id: 1,
  is_enabled: true,
  opens_at: new Date('2026-08-22T00:00:00.000Z'),
  closes_at: new Date('2026-08-23T00:00:00.000Z'),
  updated_at: new Date('2026-08-21T00:00:00.000Z'),
};

test('applications remain open by default for backward compatibility', () => {
  const result = resolveApplicationAvailability(null, new Date('2026-08-22T12:00:00.000Z'));
  assert.equal(result.isOpen, true);
  assert.equal(result.state, 'open');
  assert.equal(result.opensAt, null);
  assert.equal(result.closesAt, null);
});

test('the administrator switch closes applications regardless of the schedule', () => {
  const result = resolveApplicationAvailability(
    { ...windowSettings, is_enabled: false },
    new Date('2026-08-22T12:00:00.000Z'),
  );
  assert.equal(result.isOpen, false);
  assert.equal(result.state, 'disabled');
});

test('a future application window is scheduled and not yet open', () => {
  const result = resolveApplicationAvailability(windowSettings, new Date('2026-08-21T23:59:59.999Z'));
  assert.equal(result.isOpen, false);
  assert.equal(result.state, 'scheduled');
});

test('applications are open from the opening instant until the closing instant', () => {
  const atOpening = resolveApplicationAvailability(windowSettings, new Date('2026-08-22T00:00:00.000Z'));
  const atClosing = resolveApplicationAvailability(windowSettings, new Date('2026-08-23T00:00:00.000Z'));
  assert.equal(atOpening.isOpen, true);
  assert.equal(atOpening.state, 'open');
  assert.equal(atClosing.isOpen, false);
  assert.equal(atClosing.state, 'ended');
});

test('loads the singleton settings record from the data client', async () => {
  let query;
  const result = await getApplicationAvailability({
    application_settings: {
      findUnique: async (payload) => {
        query = payload;
        return windowSettings;
      },
    },
  }, new Date('2026-08-22T12:00:00.000Z'));

  assert.deepEqual(query, { where: { id: 1 } });
  assert.equal(result.isOpen, true);
  assert.equal(result.serverTime, '2026-08-22T12:00:00.000Z');
});
