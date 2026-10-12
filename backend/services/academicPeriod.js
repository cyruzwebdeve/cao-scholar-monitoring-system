const findPrimaryActivePeriod = async (client) => await client.academic_periods.findFirst({
  where: { is_active: true, is_primary: true }, orderBy: { updated_at: 'desc' },
}) || await client.academic_periods.findFirst({
  where: { is_active: true }, orderBy: [{ updated_at: 'desc' }, { id: 'desc' }],
});
module.exports = { findPrimaryActivePeriod };
