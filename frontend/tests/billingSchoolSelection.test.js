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
  assert.deepEqual(billingSchoolSelection({ school: name, schoolType: 'Unclassified' }, []), { schoolId: SAVED_SCHOOL_VALUE, schoolClassification: 'Unclassified' });
});

test('a stale row classification without a saved catalog match is not authoritative', () => {
  assert.equal(billingSchoolSelection({ school: name, schoolType: 'Public' }, []).schoolClassification, 'Unclassified');
  assert.equal(billingSchoolSelection({ school: name }, []).schoolClassification, 'Unclassified');
});

test('a placeholder without a real school name does not become a saved-school option', () => {
  assert.equal(billingSchoolSelection({ school: 'Not specified' }, []).schoolId, '');
});

test('saving a known catalog school does not register or reclassify any school', async () => {
  assert.equal(await resolveBillingSchoolId({ schoolId: '1' }, {}, () => { throw new Error('Unexpected catalog write'); }), 1);
});

test('an unclassified saved catalog entry keeps its ID but cannot silently become Public', async () => {
  const selection = billingSchoolSelection({ school: name }, [{ id: 3, name, schoolType: 'Unclassified' }]);
  assert.deepEqual(selection, { schoolId: '3', schoolClassification: 'Unclassified' });
  await assert.rejects(resolveBillingSchoolId(selection), /School Catalog/);
});

test('missing catalog entries cannot register or reclassify schools from the billing editor', async () => {
  let calls = 0;
  await assert.rejects(resolveBillingSchoolId({ schoolId: SAVED_SCHOOL_VALUE, schoolClassification: 'Public' }, { school: name }, async () => { calls++; }), /School Catalog/);
  assert.equal(calls, 0);
});

test('UCN saved-name selection uses the saved Public catalog classification automatically', async () => {
  const selection = billingSchoolSelection({ school: '  University of Camarines Norte, Main Campus ' }, [{ id: 20, name: 'University of Camarines Norte, Main Campus', schoolType: 'Public' }]);
  assert.deepEqual(selection, { schoolId: '20', schoolClassification: 'Public' });
  assert.equal(await resolveBillingSchoolId(selection), 20);
});

test('known Private catalog classification wins over stale Public display data', () => {
  assert.equal(billingSchoolSelection({ schoolId: 2, schoolType: 'Public' }, catalog).schoolClassification, 'Private');
});
