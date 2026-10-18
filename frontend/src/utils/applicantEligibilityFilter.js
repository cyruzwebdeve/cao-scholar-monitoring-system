export const APPLICANT_ELIGIBILITY_CRITERIA = Object.freeze([
  { key: 'graduatedHonors', label: 'Graduated Valedictorian or with Highest Honors' },
  { key: 'championContest', label: 'Champion / 1st Placer in an Academic Contest' },
  { key: 'alsPasser', label: 'ALS (Alternative Learning System) Passer' },
  { key: 'pwd', label: 'Person with Disability (PWD)' },
  { key: 'childOfPwd', label: 'Child of a Person with Disability' },
  { key: 'soloParent', label: 'Solo Parent' },
  { key: 'indigenousGroup', label: 'Member of Indigenous Group' },
]);

const isDeclared = value => value === true || (typeof value === 'string' && value.trim().toLowerCase() === 'yes');

// Declarations only: this does not infer proof approval, eligibility or Scholar status.
export const matchesApplicantEligibility = (eligibility, filter = 'all') => {
  if (filter === 'all') return true;
  const declared = APPLICANT_ELIGIBILITY_CRITERIA.filter(({ key }) => isDeclared(eligibility?.[key]));
  if (filter === 'any') return declared.length > 0;
  if (filter === 'none') return declared.length === 0;
  return declared.some(({ key }) => key === filter);
};
