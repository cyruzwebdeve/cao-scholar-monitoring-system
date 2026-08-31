const PRIORITY_CRITERIA = Object.freeze({
  graduatedHonors: Object.freeze({ proofKey: 'priority_graduated_honors', label: 'Graduated Valedictorian or with Highest Honors' }),
  championContest: Object.freeze({ proofKey: 'priority_champion_contest', label: 'Champion / 1st Placer in an Academic Contest' }),
  alsPasser: Object.freeze({ proofKey: 'priority_als_passer', label: 'ALS (Alternative Learning System) Passer' }),
  pwd: Object.freeze({ proofKey: 'priority_pwd', label: 'Person with Disability (PWD)' }),
  childOfPwd: Object.freeze({ proofKey: 'priority_child_of_pwd', label: 'Child of a Person with Disability' }),
  soloParent: Object.freeze({ proofKey: 'priority_solo_parent', label: 'Solo Parent' }),
  indigenousGroup: Object.freeze({ proofKey: 'priority_indigenous_group', label: 'Member of Indigenous Group' }),
});

const PRIORITY_PROOFS = Object.freeze(Object.fromEntries(
  Object.entries(PRIORITY_CRITERIA).map(([eligibilityKey, definition]) => [definition.proofKey, Object.freeze({
    ...definition,
    eligibilityKey,
    category: 'priority',
    statusField: null,
    bulkApprovable: false,
  })]),
));

const selectedPriorityCriteria = (eligibility = {}) => Object.entries(PRIORITY_CRITERIA)
  .filter(([key]) => String(eligibility?.[key] || '').toLowerCase() === 'yes')
  .map(([key, definition]) => ({ key, ...definition }));

const isDeclaredPriorityProof = ({ eligibility, proofKey }) => {
  const definition = PRIORITY_PROOFS[proofKey];
  return Boolean(definition && String(eligibility?.[definition.eligibilityKey] || '').toLowerCase() === 'yes');
};

module.exports = { PRIORITY_CRITERIA, PRIORITY_PROOFS, isDeclaredPriorityProof, selectedPriorityCriteria };
