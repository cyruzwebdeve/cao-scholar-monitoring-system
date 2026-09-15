import assert from 'node:assert/strict';
import test from 'node:test';
import { billingSchoolSelection, resolveBillingSchoolId, SAVED_SCHOOL_VALUE } from '../src/utils/billingSchoolSelection.js';

const name = 'TEST PUBLIC SCHOOL';
const catalog = [{ id: 1, name, schoolType: 'Public' }, { id: 2, name: 'TEST PRIVATE SCHOOL', schoolType: 'Private' }];

test('an existing scholar school ID is automatically selected without re-entry', () => {
  assert.deepEqual(billingSchoolSelection({ schoolId: 1, school: name }, catalog), { schoolId: '1', schoolClassification: 'Public' });
});

test('a saved school name automatically selects its catalog match when the ID is missing', () => {
  assert.deepEqual(billingSchoolSelection({ school: '  test   public school  ' }, catalog), { schoolId: '1', schoolClassification: 'Public' });
});

test('a saved school absent from the catalog remains preselected rather than showing Select school', () => {
  assert.deepEqual(billingSchoolSelection({ school: name, schoolType: 'Unclassified' }, []), { schoolId: SAVED_SCHOOL_VALUE, schoolClassification: '' });
});

test('an explicitly stored classification is preserved but a missing one is not guessed', () => {
  assert.equal(billingSchoolSelection({ school: name, schoolType: 'Public' }, []).schoolClassification, 'Public');
  assert.equal(billingSchoolSelection({ school: name }, []).schoolClassification, '');
});

test('a placeholder without a real school name does not become a saved-school option', () => {
  assert.equal(billingSchoolSelection({ school: 'Not specified' }, []).schoolId, '');
});

test('saving a known catalog school does not register or reclassify any school', async () => {
  assert.equal(await resolveBillingSchoolId({ schoolId: '1' }, {}, () => { throw new Error('Unexpected catalog write'); }), 1);
});

test('saving a missing catalog link reuses the exact stored school name and confirmed classification', async () => {
  const id = await resolveBillingSchoolId({ schoolId: SAVED_SCHOOL_VALUE, schoolClassification: 'Public' }, { school: name }, async (body) => {
    assert.deepEqual(body, { name, classification: 'public' });
    return { school: { id: 3 } };
  });
  assert.equal(id, 3);
});

test('unconfirmed classification cannot create a Public default or call the registration API', async () => {
  await assert.rejects(resolveBillingSchoolId({ schoolId: SAVED_SCHOOL_VALUE, schoolClassification: '' }, { school: name }, () => { throw new Error('Unexpected catalog write'); }), /Confirm whether/);
});

test('failed catalog linking cannot submit an invalid school ID to the existing billing write', async () => {
  await assert.rejects(resolveBillingSchoolId({ schoolId: SAVED_SCHOOL_VALUE, schoolClassification: 'Private' }, { school: 'TEST PRIVATE SCHOOL' }, async () => ({})), /could not be linked/);
});
