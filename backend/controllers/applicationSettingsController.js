const prisma = require('../config/prisma');
const { getApplicationAvailability, resolveApplicationAvailability } = require('../services/applicationAvailability');

const getApplicationSettings = async (req, res) => {
  try {
    const availability = await getApplicationAvailability(prisma);
    res.set('Cache-Control', 'no-store');
    return res.json({ availability });
  } catch (error) {
    console.error('Unable to fetch application availability:', error);
    return res.status(500).json({ message: 'Unable to load application availability.' });
  }
};

const parseOptionalTimestamp = (value, fieldLabel) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw new Error(`${fieldLabel} must be a valid date and time.`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`${fieldLabel} must be a valid date and time.`);
  return parsed;
};

const updateApplicationSettings = async (req, res) => {
  try {
    if (typeof req.body?.isEnabled !== 'boolean') {
      return res.status(400).json({ message: 'Application availability must be turned on or off.' });
    }

    let opensAt;
    let closesAt;
    try {
      opensAt = parseOptionalTimestamp(req.body.opensAt, 'Opening time');
      closesAt = parseOptionalTimestamp(req.body.closesAt, 'Closing time');
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    if ((opensAt && !closesAt) || (!opensAt && closesAt)) {
      return res.status(400).json({ message: 'Set both the opening and closing time, or clear both fields.' });
    }
    if (opensAt && closesAt && closesAt <= opensAt) {
      return res.status(400).json({ message: 'Closing time must be later than the opening time.' });
    }

    const settings = await prisma.application_settings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        is_enabled: req.body.isEnabled,
        opens_at: opensAt,
        closes_at: closesAt,
        updated_by: req.user.id,
      },
      update: {
        is_enabled: req.body.isEnabled,
        opens_at: opensAt,
        closes_at: closesAt,
        updated_by: req.user.id,
      },
    });

    const availability = resolveApplicationAvailability(settings);
    res.locals.auditTargetId = settings.id;
    res.locals.auditDescription = `Updated application availability (${availability.state}).`;
    return res.json({ message: 'Application availability updated.', availability });
  } catch (error) {
    console.error('Unable to update application availability:', error);
    return res.status(500).json({ message: 'Unable to update application availability.' });
  }
};

module.exports = { getApplicationSettings, updateApplicationSettings };
