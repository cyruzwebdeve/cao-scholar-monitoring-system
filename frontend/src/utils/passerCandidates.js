const positiveId = (value) => {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

export const getPasserCandidates = (applicants, postedMemberships, revisionOf = null) => {
  const revisionId = positiveId(revisionOf);
  const unavailable = new Set(postedMemberships
    .filter((member) => !revisionId || positiveId(member.listId) !== revisionId)
    .map((member) => positiveId(member.applicantId)));

  return applicants.filter((applicant) => (
    applicant.status === 'Passed'
    && positiveId(applicant.id)
    && positiveId(applicant.resultId)
    && !applicant.isScholar
    && !unavailable.has(positiveId(applicant.id))
  ));
};
