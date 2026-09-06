const assert = require('node:assert/strict');
const test = require('node:test');

const { assessApplicantDataQuality } = require('../services/dataQuality');

const completeApplicant = (overrides = {}) => ({
  id: 1,
  first_name: 'Ana',
  middle_name: 'Reyes',
  last_name: 'Santos',
  name_ext: null,
  phone: '09171234567',
  street: 'Rizal Street',
  barangay: 'Gubat',
  municipality: 'Daet',
  school_id: 3,
  gender: 'Female',
  date_of_birth: new Date('2005-02-03T00:00:00Z'),
  birthplace: 'Daet',
  ...overrides,
});

test('reports a complete applicant as clean with a perfect score', () => {
  const result = assessApplicantDataQuality({
    applicants: [completeApplicant()],
    controlAccounts: [{ applicant_id: 1 }],
  });
  assert.equal(result.qualityScore, 100);
  assert.equal(result.cleanRecords, 1);
  assert.deepEqual(result.issues, []);
});

test('counts incomplete fields without exposing applicant data', () => {
  const result = assessApplicantDataQuality({
    applicants: [completeApplicant({ phone: '', street: '', school_id: null })],
    controlAccounts: [],
  });
  assert.equal(result.affectedRecords, 1);
  assert.deepEqual(result.issues.map(({ code }) => code), [
    'MISSING_CONTROL_NUMBER',
    'INCOMPLETE_LOCATION',
    'UNLINKED_SCHOOL',
    'INVALID_PHONE',
  ]);
  assert.equal(Object.hasOwn(result.issues[0], 'applicantIds'), false);
});

test('flags every record participating in a likely duplicate group', () => {
  const applicants = [
    completeApplicant(),
    completeApplicant({ id: 2, phone: '09998887777' }),
  ];
  const result = assessApplicantDataQuality({
    applicants,
    controlAccounts: [{ applicant_id: 1 }, { applicant_id: 2 }],
  });
  const duplicateIssue = result.issues.find(({ code }) => code === 'DUPLICATE_IDENTITY');
  assert.equal(duplicateIssue.count, 2);
  assert.equal(result.cleanRecords, 0);
});

test('returns a safe empty-state score when there are no applicants', () => {
  const result = assessApplicantDataQuality();
  assert.equal(result.qualityScore, 100);
  assert.equal(result.totalRecords, 0);
  assert.equal(result.affectedRecords, 0);
});
