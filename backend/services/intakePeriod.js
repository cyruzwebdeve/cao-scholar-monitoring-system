const failure = (message, statusCode = 409) => Object.assign(new Error(message), { statusCode });

const readIntakeSettings = async (client) => {
  if (!client.intake_settings?.findUnique) {
    throw failure('Application and examination intake is unavailable. Please try again later or contact CAO.', 503);
  }
  try {
    return await client.intake_settings.findUnique({ where: { id: 1 } });
  } catch (error) {
    if (['P2021', 'P2022'].includes(error.code)) {
      throw failure('Application and examination intake is unavailable. Please try again later or contact CAO.', 503);
    }
    throw error;
  }
};

const findIntakePeriod = async (client) => {
  const settings = await readIntakeSettings(client);
  if (!settings?.academic_period_id) return null;
  // Processing activation and primary flags belong to Scholars/Billing/Payroll.
  // Intake selection may use a configured upcoming or archived processing period.
  return client.academic_periods.findUnique({ where: { id: settings.academic_period_id } });
};

const requireIntakePeriod = async (client, academicPeriodId, academicYear) => {
  const period = await findIntakePeriod(client);
  if (!period || period.id !== Number(academicPeriodId) || period.school_year !== academicYear) {
    throw failure('The application and examination intake changed or is unavailable. Reload the intake before continuing.');
  }
  return period;
};

const lockIntakePeriod = async (client, academicPeriodId, academicYear) => {
  await client.$queryRaw`SELECT id FROM intake_settings WHERE id = 1 FOR SHARE`;
  return requireIntakePeriod(client, academicPeriodId, academicYear);
};

const serializeIntakePeriod = (period) => period ? {
  id: period.id,
  schoolYear: period.school_year,
  semester: period.semester,
  startDate: period.start_date,
  endDate: period.end_date,
  status: period.status,
  isActive: Boolean(period.is_active),
  isPrimary: Boolean(period.is_primary),
  isCurrentIntake: true,
  createdAt: period.created_at,
  updatedAt: period.updated_at,
} : null;

module.exports = { readIntakeSettings, findIntakePeriod, requireIntakePeriod, lockIntakePeriod, serializeIntakePeriod };
