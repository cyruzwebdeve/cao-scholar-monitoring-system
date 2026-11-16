const test = require('node:test');
const assert = require('node:assert/strict');
const { isScholarPeriodEligible, assertScholarPeriodEligible } = require('../services/scholarProcessingPeriod');

test('a newly admitted Scholar starts processing in their recorded entry year and continues in later years', () => {
  const applicant = { school_year: '2027-2028' };
  assert.equal(isScholarPeriodEligible(applicant, { school_year: '2026-2027' }), false);
  assert.equal(isScholarPeriodEligible(applicant, { school_year: '2027-2028' }), true);
  assert.equal(isScholarPeriodEligible(applicant, { school_year: '2028-2029' }), true);
  assert.throws(() => assertScholarPeriodEligible(applicant, { school_year: '2026-2027' }), error => error.statusCode === 409 && /2027-2028/.test(error.message));
  assert.doesNotThrow(() => assertScholarPeriodEligible(applicant, { school_year: '2027-2028' }));
});

test('unknown legacy entry years retain existing access without inferring or rewriting a year', () => {
  for (const schoolYear of [null, undefined, '', 'Legacy period', '2025–2026', '2027-2029']) {
    const applicant = { school_year: schoolYear };
    assert.equal(isScholarPeriodEligible(applicant, { school_year: '2026-2027' }), true);
    assert.doesNotThrow(() => assertScholarPeriodEligible(applicant, { school_year: '2026-2027' }));
    assert.equal(applicant.school_year, schoolYear);
  }
});
