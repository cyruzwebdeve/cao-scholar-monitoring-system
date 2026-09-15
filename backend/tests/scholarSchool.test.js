const assert = require('node:assert/strict');
const test = require('node:test');
const { normalizeSchoolName, resolveScholarSchool } = require('../services/scholarSchool');

const publicSchool = { id: 1, name: 'TEST PUBLIC SCHOOL', school_type: 'public' };
const privateSchool = { id: 2, name: 'TEST PRIVATE SCHOOL', school_type: 'private' };
const indexes = {
  schoolById: new Map([[1, publicSchool], [2, privateSchool]]),
  schoolByName: new Map([publicSchool, privateSchool].map((school) => [normalizeSchoolName(school.name), school])),
};

test('a valid academic-period school retains precedence over applicant and planned schools', () => {
  assert.equal(resolveScholarSchool({ ...indexes, requirement: { school_id: 2 }, applicant: { school_id: 1 }, application: { school_plan: { school: publicSchool.name } } }), privateSchool);
});

test('dangling period school reference does not hide the valid Public applicant school', () => {
  assert.equal(resolveScholarSchool({ ...indexes, requirement: { school_id: 999 }, applicant: { school_id: 1 } }), publicSchool);
});

test('string-valued legacy school references resolve to catalog IDs', () => {
  assert.equal(resolveScholarSchool({ ...indexes, applicant: { school_id: '1' } }), publicSchool);
});

test('missing and dangling references fall back to the normalized planned school name', () => {
  assert.equal(resolveScholarSchool({ ...indexes, applicant: { school_id: 999 }, application: { school_plan: { school: '  test   PUBLIC\n SCHOOL  ' } } }), publicSchool);
});

test('unresolved school names remain unknown rather than being assumed Public or Private', () => {
  assert.equal(resolveScholarSchool({ ...indexes, application: { school_plan: { school: 'UNKNOWN SCHOOL' } } }), null);
  assert.equal(normalizeSchoolName({ label: 'TEST PUBLIC SCHOOL' }), '');
});
