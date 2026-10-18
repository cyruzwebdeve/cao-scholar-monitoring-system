import { APPLICANT_ELIGIBILITY_CRITERIA } from '../utils/applicantEligibilityFilter';

export default function ApplicantEligibilityFilter({ value, onChange }) {
  return <label className="applicant-filter applicant-eligibility-filter"><span>Eligibility criteria</span>
    <select value={value} onChange={event => onChange(event.target.value)} aria-describedby="applicant-eligibility-filter-hint">
      <option value="all">All eligibility criteria</option>
      <option value="any">Any declared criterion</option>
      <option value="none">No criteria declared</option>
      {APPLICANT_ELIGIBILITY_CRITERIA.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
    </select>
    <small id="applicant-eligibility-filter-hint">Applicant declarations, not proof approval.</small>
  </label>;
}
