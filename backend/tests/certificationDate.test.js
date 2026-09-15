const assert = require('node:assert/strict');
const test = require('node:test');
const { certificationCreatedAt, latestCertificationCreatedAt } = require('../services/certificationDate');

test('private certification date uses generation time, not modification or release time', () => {
  assert.equal(certificationCreatedAt('Private', {
    batch_number: 'BILL-TEST', status: 'billed',
    prepared_at: new Date('2026-09-15T16:30:00Z'),
    updated_at: new Date('2026-09-17T00:00:00Z'),
    released_at: new Date('2026-09-18T00:00:00Z'),
  }), '2026-09-15T16:30:00.000Z');
});

test('billed legacy certification batches retain their generation date', () => {
  assert.equal(certificationCreatedAt('private', {
    status: 'billed', prepared_at: '2026-09-15T01:00:00Z',
  }), '2026-09-15T01:00:00.000Z');
});

test('public payroll and non-certification records do not expose a certification date', () => {
  const batch = { batch_number: 'BILL-TEST', prepared_at: new Date() };
  assert.equal(certificationCreatedAt('Public', batch), null);
  assert.equal(certificationCreatedAt('Private', { ...batch, batch_number: 'PAYROLL-TEST', status: 'generated' }), null);
});

test('missing and invalid certification dates remain unavailable', () => {
  assert.equal(certificationCreatedAt('Private', null), null);
  assert.equal(certificationCreatedAt('Private', { status: 'billed' }), null);
  assert.equal(certificationCreatedAt('Private', { status: 'billed', prepared_at: 'invalid' }), null);
});

test('private dashboard finds the latest historical certification without an active-period payroll claim', async () => {
  const client = {
    payroll_claims: { findMany: async (query) => {
      assert.deepEqual(query, { where: { applicant_id: 42 }, select: { payroll_batch_id: true } });
      return [{ payroll_batch_id: 1 }, { payroll_batch_id: 2 }, { payroll_batch_id: 1 }];
    } },
    payroll_batches: { findMany: async (query) => {
      assert.deepEqual(query.where.id, { in: [1, 2] });
      assert.deepEqual(query.where.OR, [{ batch_number: { startsWith: 'BILL-' } }, { status: 'billed' }]);
      return [
        { batch_number: 'BILL-OLD', prepared_at: '2026-08-01T01:00:00Z' },
        { batch_number: 'BILL-LATEST', prepared_at: '2026-09-15T16:30:00Z' },
      ];
    } },
  };
  assert.equal(await latestCertificationCreatedAt(client, 42, 'Private'), '2026-09-15T16:30:00.000Z');
});

test('historical date selection uses generation order rather than claim updates or query order', async () => {
  const client = {
    payroll_claims: { findMany: async () => [{ payroll_batch_id: 1 }, { payroll_batch_id: 2 }] },
    payroll_batches: { findMany: async () => [
      { status: 'billed', prepared_at: '2026-09-12T00:00:00Z' },
      { status: 'billed', prepared_at: '2026-08-10T00:00:00Z', updated_at: '2026-09-15T00:00:00Z' },
      { status: 'generated', batch_number: 'PAYROLL-TEST', prepared_at: '2026-09-16T00:00:00Z' },
    ] },
  };
  assert.equal(await latestCertificationCreatedAt(client, 42, 'private'), '2026-09-12T00:00:00.000Z');
});

test('public scholars and missing applicant identities do not query certification history', async () => {
  assert.equal(await latestCertificationCreatedAt({}, 42, 'Public'), null);
  assert.equal(await latestCertificationCreatedAt({}, null, 'Private'), null);
});

test('private scholars without historical list membership have no generated date', async () => {
  const client = { payroll_claims: { findMany: async () => [] } };
  assert.equal(await latestCertificationCreatedAt(client, 42, 'Private'), null);
});
