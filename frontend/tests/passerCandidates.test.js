import test from 'node:test';
import assert from 'node:assert/strict';
import { getPasserCandidates } from '../src/utils/passerCandidates.js';

const passer = (id, fields = {}) => ({ id, status: 'Passed', resultId: id, isScholar: false, ...fields });
const ids = (records) => records.map((record) => record.id);

test('posted membership immediately removes a passer from new-list selection', () => {
  const applicants = [passer(1), passer(2)];
  assert.deepEqual(ids(getPasserCandidates(applicants, [])), [1, 2]);
  assert.deepEqual(ids(getPasserCandidates(applicants, [{ listId: 10, applicantId: 1 }])), [2]);
  assert.equal(applicants[0].status, 'Passed');
  assert.equal(applicants[0].isScholar, false);
});

test('a revision can reuse its own members and add unposted passers but excludes another active list', () => {
  const applicants = [passer(1), passer(2), passer(3)];
  const memberships = [{ listId: 10, applicantId: 1 }, { listId: 11, applicantId: 2 }];
  assert.deepEqual(ids(getPasserCandidates(applicants, memberships, '10')), [1, 3]);
  assert.deepEqual(ids(getPasserCandidates(applicants, memberships)), [3]);
});

test('duplicate memberships cannot bypass another list when revising a legacy duplicate', () => {
  const applicants = [passer(1), passer(2)];
  const memberships = [
    { listId: 10, applicantId: 1 }, { listId: 10, applicantId: 1 },
    { listId: 11, applicantId: 1 }, { listId: 10, applicantId: 2 },
  ];
  assert.deepEqual(ids(getPasserCandidates(applicants, memberships, 10)), [2]);
  assert.deepEqual(ids(getPasserCandidates(applicants, memberships, 11)), []);
});

test('complete membership metadata excludes members beyond the retained-list display limit', () => {
  const memberships = Array.from({ length: 105 }, (_, index) => ({ listId: index + 1, applicantId: index + 1 }));
  const applicants = [passer(1), passer(101), passer(105), passer(106)];
  assert.deepEqual(ids(getPasserCandidates(applicants, memberships)), [106]);
});

test('a member removed by a posted revision becomes available after its original is superseded', () => {
  const applicants = [passer(1), passer(2)];
  const original = [{ listId: 10, applicantId: 1 }, { listId: 10, applicantId: 2 }];
  const revised = [{ listId: 11, applicantId: 2 }];
  assert.deepEqual(ids(getPasserCandidates(applicants, original)), []);
  assert.deepEqual(ids(getPasserCandidates(applicants, revised)), [1]);
});

test('failed, unrecorded and accepted applicants remain ineligible for list preparation', () => {
  const applicants = [
    passer(1), passer(2, { status: 'Failed' }), passer(3, { isScholar: true }),
    passer(4, { resultId: null }), passer(5, { resultId: 0 }), passer(6, { resultId: -1 }),
    passer(7, { resultId: 'invalid' }), passer(8, { resultId: true }),
  ];
  assert.deepEqual(ids(getPasserCandidates(applicants, [])), [1]);
});

test('invalid revision IDs cannot turn posted passers into new-list candidates', () => {
  const applicants = [passer(1)];
  const memberships = [{ listId: 10, applicantId: 1 }];
  for (const revisionOf of [null, undefined, '', 0, -10, 'invalid', true]) {
    assert.deepEqual(ids(getPasserCandidates(applicants, memberships, revisionOf)), []);
  }
});

test('filtering preserves source data and supports numeric IDs from select controls', () => {
  const applicants = [passer(1), passer(2, { resultId: '2' })];
  const memberships = [{ listId: '10', applicantId: '1' }];
  const applicantsBefore = structuredClone(applicants);
  const membershipsBefore = structuredClone(memberships);
  const result = getPasserCandidates(applicants, memberships, '10');
  assert.deepEqual(ids(result), [1, 2]);
  assert.equal(result[0], applicants[0]);
  assert.deepEqual(applicants, applicantsBefore);
  assert.deepEqual(memberships, membershipsBefore);
});
