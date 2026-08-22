const DEFAULT_APPLICATION_SETTINGS = Object.freeze({
  id: 1,
  is_enabled: true,
  opens_at: null,
  closes_at: null,
  updated_by: null,
  created_at: null,
  updated_at: null,
});

const resolveApplicationAvailability = (settings, now = new Date()) => {
  const effectiveSettings = { ...DEFAULT_APPLICATION_SETTINGS, ...(settings || {}) };
  const opensAt = effectiveSettings.opens_at ? new Date(effectiveSettings.opens_at) : null;
  const closesAt = effectiveSettings.closes_at ? new Date(effectiveSettings.closes_at) : null;
  const currentTime = now instanceof Date ? now : new Date(now);

  let state = 'open';
  let message = 'Scholarship applications are currently open.';

  if (!effectiveSettings.is_enabled) {
    state = 'disabled';
    message = 'Scholarship applications have been closed by the administrator.';
  } else if (opensAt && currentTime < opensAt) {
    state = 'scheduled';
    message = 'Scholarship applications are not open yet.';
  } else if (closesAt && currentTime >= closesAt) {
    state = 'ended';
    message = 'The scholarship application period has ended.';
  }

  return {
    isOpen: state === 'open',
    state,
    message,
    isEnabled: effectiveSettings.is_enabled,
    opensAt: opensAt?.toISOString() || null,
    closesAt: closesAt?.toISOString() || null,
    updatedAt: effectiveSettings.updated_at || null,
    serverTime: currentTime.toISOString(),
  };
};

const getApplicationAvailability = async (client, now = new Date()) => {
  const settings = await client.application_settings.findUnique({ where: { id: 1 } });
  return resolveApplicationAvailability(settings, now);
};

module.exports = {
  DEFAULT_APPLICATION_SETTINGS,
  getApplicationAvailability,
  resolveApplicationAvailability,
};
