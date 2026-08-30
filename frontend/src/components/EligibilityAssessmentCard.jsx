import { BadgeCheck, Scale } from 'lucide-react';
import '../styles/eligibility-assessment.css';

const recommendationLabels = {
  MEETS_CONFIGURED_CRITERIA: 'Met configured criteria',
  DOES_NOT_MEET_CRITERIA: 'Did not meet configured criteria',
  REVIEW_REQUIRED: 'Required human review',
};

export default function EligibilityAssessmentCard({ assessment }) {
  if (!assessment) return null;

  return (
    <article className="portal-eligibility-card" aria-labelledby="portal-eligibility-title">
      <header>
        <span><Scale size={18} /></span>
        <div><small>OFFICIAL DECISION EXPLANATION</small><h2 id="portal-eligibility-title">How your record was assessed</h2></div>
        <strong>{assessment.totalScore ?? '—'}<small> / {assessment.maxScore}</small></strong>
      </header>
      <div className="portal-eligibility-result">
        <BadgeCheck size={17} />
        <div><strong>{recommendationLabels[assessment.recommendation] || assessment.recommendation}</strong><p>{assessment.summary}</p></div>
      </div>
      <div className="portal-eligibility-factors">
        {(assessment.factors || []).map((factor) => (
          <div key={factor.id}>
            <span><strong>{factor.label}</strong><small>{factor.explanation}</small></span>
            <b>{factor.score ?? '—'} / {factor.maxScore}</b>
          </div>
        ))}
      </div>
      <footer>
        <span>Policy version {assessment.policyVersion}</span>
        <span>The recommendation supported a human decision; it did not decide your application automatically.</span>
      </footer>
    </article>
  );
}
