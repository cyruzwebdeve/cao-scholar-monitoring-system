const POLICY = Object.freeze({
  version: 'PGCEAP-2026.1',
  name: 'PGCEAP explainable eligibility policy',
  recommendationThreshold: 60,
  examMaximumScore: 20,
  weights: Object.freeze({
    financialNeed: 35,
    academicStanding: 25,
    examination: 30,
    priorityQualifications: 10,
  }),
});

const PRIORITY_LABELS = Object.freeze({
  graduatedHonors: 'Graduated with highest honors',
  championContest: 'Academic contest champion or first placer',
  alsPasser: 'Alternative Learning System passer',
  pwd: 'Person with disability',
  childOfPwd: 'Child of a person with disability',
  soloParent: 'Solo parent',
  indigenousGroup: 'Member of an indigenous group',
});

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

const makeFactor = ({ id, label, score, maxScore, status, explanation }) => ({
  id,
  label,
  score,
  maxScore,
  status,
  explanation,
});

const scoreFinancialNeed = (rawIncome) => {
  const income = String(rawIncome || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!income) return null;
  if (income.includes('below') && income.includes('50,000')) return 35;
  if (income.includes('50,000') && income.includes('100,000')) return 30;
  if (income.includes('100,001') && income.includes('150,000')) return 24;
  if (income.includes('150,001') && income.includes('200,000')) return 18;
  if (income.includes('above') && income.includes('200,000')) return 10;
  return null;
};

const scoreAcademicStanding = (rawGwa) => {
  if (rawGwa === null || rawGwa === undefined || String(rawGwa).trim() === '') return null;
  const gwa = Number(rawGwa);
  if (!Number.isFinite(gwa) || gwa < 0 || gwa > 100) return null;

  // Values from 1.00 to 5.00 use the common college scale where lower is better.
  if (gwa >= 1 && gwa <= 5) {
    if (gwa <= 1.25) return 25;
    if (gwa <= 1.5) return 22;
    if (gwa <= 1.75) return 19;
    if (gwa <= 2) return 16;
    if (gwa <= 2.5) return 12;
    return 6;
  }

  if (gwa >= 95) return 25;
  if (gwa >= 90) return 22;
  if (gwa >= 85) return 19;
  if (gwa >= 80) return 16;
  if (gwa >= 75) return 12;
  return 6;
};

const scoreExamination = (rawScore) => {
  const score = Number(rawScore);
  if (!Number.isFinite(score) || score < 0) return null;
  return Math.round((clamp(score, 0, POLICY.examMaximumScore) / POLICY.examMaximumScore) * POLICY.weights.examination);
};

const evaluateEligibility = ({ application, result, generatedAt = new Date() } = {}) => {
  const family = application?.family && typeof application.family === 'object' ? application.family : {};
  const eligibility = application?.eligibility && typeof application.eligibility === 'object' ? application.eligibility : {};
  const missingInputs = [];

  const financialScore = scoreFinancialNeed(family.familyIncome);
  if (financialScore === null) missingInputs.push('annual family income');

  const academicScore = scoreAcademicStanding(family.gwa);
  if (academicScore === null) missingInputs.push('GWA');

  const examScore = scoreExamination(result?.score);
  if (!result || examScore === null || typeof result.passed !== 'boolean') missingInputs.push('verified examination result');

  const priorityMatches = Object.entries(PRIORITY_LABELS)
    .filter(([key]) => String(eligibility[key] || '').toLowerCase() === 'yes')
    .map(([, label]) => label);
  const priorityScore = Math.min(POLICY.weights.priorityQualifications, priorityMatches.length * 2);

  const factors = [
    makeFactor({
      id: 'financial_need',
      label: 'Financial need',
      score: financialScore,
      maxScore: POLICY.weights.financialNeed,
      status: financialScore === null ? 'needs_review' : 'evaluated',
      explanation: financialScore === null
        ? 'Annual family income is missing or does not match a configured band.'
        : `Configured income band: ${family.familyIncome}.`,
    }),
    makeFactor({
      id: 'academic_standing',
      label: 'Academic standing',
      score: academicScore,
      maxScore: POLICY.weights.academicStanding,
      status: academicScore === null ? 'needs_review' : 'evaluated',
      explanation: academicScore === null
        ? 'A valid GWA is required for this factor.'
        : `Submitted GWA: ${family.gwa}.`,
    }),
    makeFactor({
      id: 'examination',
      label: 'Qualifying examination',
      score: examScore,
      maxScore: POLICY.weights.examination,
      status: !result ? 'needs_review' : result.passed ? 'passed' : 'not_met',
      explanation: !result
        ? 'No verified examination result is available.'
        : `Recorded score: ${Number(result.score)}; passing score: ${Number(result.passing_score ?? 14)}.`,
    }),
    makeFactor({
      id: 'priority_qualifications',
      label: 'Priority qualifications',
      score: priorityScore,
      maxScore: POLICY.weights.priorityQualifications,
      status: 'evaluated',
      explanation: priorityMatches.length
        ? `${priorityMatches.length} declared qualification${priorityMatches.length === 1 ? '' : 's'}: ${priorityMatches.join(', ')}.`
        : 'No priority qualification was declared.',
    }),
  ];

  const availableScores = factors.map(({ score }) => score).filter(Number.isFinite);
  const totalScore = missingInputs.length ? null : availableScores.reduce((sum, score) => sum + score, 0);
  let recommendation = 'REVIEW_REQUIRED';
  let summary = `Human review is required because ${missingInputs.join(', ')} ${missingInputs.length === 1 ? 'is' : 'are'} unavailable.`;

  if (!missingInputs.length && !result.passed) {
    recommendation = 'DOES_NOT_MEET_CRITERIA';
    summary = 'The verified examination result does not meet the required passing condition.';
  } else if (!missingInputs.length && totalScore >= POLICY.recommendationThreshold) {
    recommendation = 'MEETS_CONFIGURED_CRITERIA';
    summary = 'The record meets the configured score threshold and examination requirement. A staff member must still make the final decision.';
  } else if (!missingInputs.length) {
    recommendation = 'DOES_NOT_MEET_CRITERIA';
    summary = `The score is below the configured ${POLICY.recommendationThreshold}-point recommendation threshold.`;
  }

  return {
    policyVersion: POLICY.version,
    policyName: POLICY.name,
    recommendation,
    totalScore,
    maxScore: 100,
    threshold: POLICY.recommendationThreshold,
    summary,
    requiresHumanDecision: true,
    requiresOverrideReason: recommendation !== 'MEETS_CONFIGURED_CRITERIA',
    missingInputs,
    factors,
    generatedAt: generatedAt.toISOString(),
    inputSnapshot: {
      applicationId: application?.id || null,
      resultId: result?.id || null,
      familyIncome: family.familyIncome || null,
      gwa: family.gwa ?? null,
      examScore: result?.score === null || result?.score === undefined ? null : Number(result.score),
      passingScore: result?.passing_score === null || result?.passing_score === undefined ? null : Number(result.passing_score),
      examPassed: typeof result?.passed === 'boolean' ? result.passed : null,
      priorityQualifications: Object.keys(PRIORITY_LABELS).filter((key) => String(eligibility[key] || '').toLowerCase() === 'yes'),
    },
  };
};

const serializeAssessment = (assessment) => {
  if (!assessment) return null;
  return {
    id: assessment.id,
    policyVersion: assessment.policy_version,
    policyName: assessment.policy_name,
    recommendation: assessment.recommendation,
    totalScore: assessment.total_score === null ? null : Number(assessment.total_score),
    maxScore: assessment.max_score,
    threshold: assessment.threshold_score,
    summary: assessment.summary,
    requiresHumanDecision: true,
    factors: assessment.scorecard,
    generatedAt: assessment.generated_at,
    decision: assessment.review_decision,
    decisionReason: assessment.review_reason || null,
    reviewedAt: assessment.reviewed_at || null,
  };
};

module.exports = {
  POLICY,
  PRIORITY_LABELS,
  evaluateEligibility,
  scoreAcademicStanding,
  scoreFinancialNeed,
  serializeAssessment,
};
