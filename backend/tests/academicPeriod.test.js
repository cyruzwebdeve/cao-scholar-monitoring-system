const test = require('node:test');
const assert = require('node:assert/strict');
const { findPrimaryActivePeriod } = require('../services/academicPeriod');

test('primary period wins over a more recently updated active secondary period', async () => {
  const calls = [];
  const client = { academic_periods: { findFirst: async (query) => { calls.push(query); return query.where.is_primary ? { id: 1, school_year: '2026-2027' } : { id: 2, school_year: '2027-2028' }; } } };
  assert.equal((await findPrimaryActivePeriod(client)).id, 1); assert.equal(calls.length, 1);
});

test('period selection retains deterministic active fallback and does not create a period', async () => {
  const calls = [];
  const client = { academic_periods: { findFirst: async (query) => { calls.push(query); return query.where.is_primary ? null : { id: 2 }; } } };
  assert.equal((await findPrimaryActivePeriod(client)).id, 2);
  assert.deepEqual(calls[1].orderBy, [{ updated_at: 'desc' }, { id: 'desc' }]);
  client.academic_periods.findFirst = async () => null;
  assert.equal(await findPrimaryActivePeriod(client), null);
});
