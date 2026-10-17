import assert from 'node:assert/strict';
import test from 'node:test';
import { certificateReferenceFor } from '../src/utils/certificateReference.js';

test('individual references identify the scholar and are reused across academic periods', () => {
  assert.equal(certificateReferenceFor({ id: 34, academicPeriodId: 10 }), 'PGCEAP-CERT#0034');
  assert.equal(certificateReferenceFor({ id: 34, academicPeriodId: 10 }), certificateReferenceFor({ id: 34, academicPeriodId: 11 }));
  assert.notEqual(certificateReferenceFor({ id: 34, academicPeriodId: 10 }), certificateReferenceFor({ id: 35, academicPeriodId: 10 }));
  assert.equal(certificateReferenceFor({ id: 10000, academicPeriodId: 10001 }), 'PGCEAP-CERT#10000');
});

test('profile edits do not alter a scholar reference and missing IDs cannot create a generic duplicate', () => {
  const record = { id: 34, academicPeriodId: 10, name: 'SYNTHETIC NAME', controlNumber: 'TEST-034' };
  assert.equal(certificateReferenceFor(record), certificateReferenceFor({ ...record, name: 'UPDATED TEST NAME', controlNumber: 'TEST-NEW' }));
  for (const input of [null, {}, { id: 0 }, { id: -1 }, { id: 34.5 }, { id: Number.MAX_SAFE_INTEGER + 1 }]) {
    assert.throws(() => certificateReferenceFor(input), /Refresh the scholar record/);
  }
});
