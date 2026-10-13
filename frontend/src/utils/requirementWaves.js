export const requirementScope = (document) => document?.academicPeriodId && document?.submissionWave ? {
  academicPeriodId: document.academicPeriodId, submissionWave: document.submissionWave,
  versionId: document.versionId || null, revision: document.revision || 0,
} : {};
export const requirementScopeQuery = (document) => {
  const scope = requirementScope(document);
  if (!scope.academicPeriodId) return '';
  const params = new URLSearchParams({ academicPeriodId: String(scope.academicPeriodId), submissionWave: scope.submissionWave });
  if (scope.versionId) params.set('versionId', scope.versionId);
  return `?${params}`;
};
