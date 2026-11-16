const recordedYearStart = (schoolYear) => {
  const match = /^(\d{4})-(\d{4})$/.exec(String(schoolYear || '').trim());
  return match && Number(match[2]) === Number(match[1]) + 1 ? Number(match[1]) : null;
};

const isScholarPeriodEligible = (applicant, period) => {
  const entryYear = recordedYearStart(applicant?.school_year);
  const targetYear = recordedYearStart(period?.school_year);
  // Existing records without a usable recorded year retain their legacy access.
  // Never infer an entry year from acceptance dates or the processing primary.
  return entryYear === null || targetYear === null || targetYear >= entryYear;
};

const assertScholarPeriodEligible = (applicant, period) => {
  if (!isScholarPeriodEligible(applicant, period)) {
    throw Object.assign(new Error(`This Scholar enters in ${applicant.school_year}. Select that school year or a later academic period for processing.`), { statusCode: 409 });
  }
};

module.exports = { isScholarPeriodEligible, assertScholarPeriodEligible };
