const test = require('node:test');
const assert = require('node:assert/strict');
const municipalities = require('../data/municipality.json');
const barangays = require('../../brgy.json');
const { validateCreateApplication } = require('../middleware/validators');

const municipality = municipalities[0];
const barangay = barangays.find((item) => item.municipalityCode === municipality.code);

const buildBody = (familyOverrides = {}) => ({
  personalInfo: {
    identity: {
      firstName: 'JUAN',
      middleName: '',
      familyName: 'DELA CRUZ',
      nameExtension: '',
      email: 'applicant@example.com',
      mobile: '09123456789',
      birthday: '2004-01-01',
      birthplace: 'DAET',
      sex: 'Male',
      civilStatus: 'Single',
    },
    address: {
      houseNumber: 'PUROK 1',
      municipality: municipality.name,
      barangay: barangay.name,
    },
    schoolPlan: {
      school: 'TEST SCHOOL',
      course: 'TEST COURSE',
      incomingYearLevel: '1st Year',
    },
    family: {
      fatherName: 'PEDRO DELA CRUZ',
      fatherOccupation: 'FARMER',
      motherName: 'MARIA DELA CRUZ',
      motherOccupation: 'TEACHER',
      guardianName: 'MARIA DELA CRUZ',
      guardianOccupation: 'TEACHER',
      guardianSameAsParent: true,
      guardianParentRole: 'mother',
      familyIncome: 'Below \u20B150,000',
      gwa: '90',
      brothersCount: '0',
      sistersCount: '0',
      ...familyOverrides,
    },
    eligibility: {
      graduatedHonors: 'No',
      championContest: 'No',
      alsPasser: 'No',
      pwd: 'No',
      childOfPwd: 'No',
      soloParent: 'No',
      indigenousGroup: 'No',
    },
  },
});

const runValidation = (body) => {
  let nextCalled = false;
  let response;
  const req = { body, user: { id: 1 } };
  const res = {
    status(statusCode) {
      return {
        json(payload) {
          response = { statusCode, payload };
        },
      };
    },
  };
  validateCreateApplication(req, res, () => { nextCalled = true; });
  return { nextCalled, response };
};

test('accepts a selected parent as guardian without guardian address fields', () => {
  const result = runValidation(buildBody());
  assert.equal(result.nextCalled, true);
  assert.equal(result.response, undefined);
});

test('rejects guardian details that do not match the selected parent', () => {
  const result = runValidation(buildBody({ guardianName: 'SOMEONE ELSE' }));
  assert.equal(result.nextCalled, false);
  assert.equal(result.response.statusCode, 400);
  assert.equal(result.response.payload.message, 'Guardian details must match the selected parent.');
});
