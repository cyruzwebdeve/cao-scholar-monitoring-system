const assert = require('node:assert/strict');
const test = require('node:test');
const { certificationCreatedAt } = require('../services/certificationDate');

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
