// Persisted staff choice applies only to this period. Generated membership remains
// authoritative in list/history projections; upload timestamps never choose a route.
const resolveProcessingRoute = ({ schoolType, docs, period, requirement, legacyPeriodId = period.id }) => {
  if (requirement?.payroll_requested_at) return 'payroll';
  if ((docs?.initialRequirementPeriodId || legacyPeriodId) === period.id) return 'payroll';
  return String(schoolType).toLowerCase() === 'private' ? 'billing' : 'payroll';
};
const assertProcessingRoutes = async (tx, period, eligibility, applications, legacyPeriodId, expected) => {
  const requirements = await tx.scholar_requirements.findMany({ where: { billing_period_id: period.id, applicant_id: { in: eligibility.map(item => item.applicantId) } } });
  for (const item of eligibility) {
    const route = resolveProcessingRoute({ schoolType: item.schoolType, docs: applications.get(item.applicantId)?.initial_docs, period, requirement: requirements.find(row => row.applicant_id === item.applicantId), legacyPeriodId });
    if (route !== expected) throw Object.assign(new Error('The processing destination changed. Refresh the list before generating.'), { statusCode: 409 });
  }
};
module.exports = { resolveProcessingRoute, assertProcessingRoutes };
