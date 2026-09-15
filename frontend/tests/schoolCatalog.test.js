import assert from 'node:assert/strict';
import test from 'node:test';
import { formatSchoolClassification, savedSchoolCatalog } from '../src/utils/schoolCatalog.js';

test('missing, invalid and unclassified catalog values never display as Public', () => {
  for (const value of [undefined, null, '', 'unclassified', 'unknown']) {
    assert.equal(formatSchoolClassification(value), 'Unclassified');
  }
});

test('catalog renders only persisted API rows without manufacturing Public school entries', () => {
  assert.deepEqual(savedSchoolCatalog([]), []);
  assert.deepEqual(savedSchoolCatalog([{ id: 1, name: 'TEST SCHOOL', classification: '' }]), [{ id: 1, name: 'TEST SCHOOL', classification: 'Unclassified' }]);
});

test('explicit saved Public and Private types remain authoritative', () => {
  assert.equal(formatSchoolClassification(' PUBLIC '), 'Public');
  assert.equal(formatSchoolClassification('Private'), 'Private');
});
