const assert = require('node:assert/strict');
const test = require('node:test');
const {
  initializeWaves,
  resolveInitialRequirementPeriodId,
  getInitialRequirements,
  getEffectiveRequirements,
  getScopedDocument,
  saveWaveDocument,
} = require('../services/requirementWaves');
const { evaluateContinuingSchedule } = require('../services/continuingSchedule');

const file = (name = 'fixture.pdf', status = 'Approved') => ({
  fileName: name,
  fileType: 'application/pdf',
  fileData: 'synthetic document contents',
  status,
  versionId: `version-${name}`,
  revision: 1,
  reviewHistory: [{ decision: status, notes: 'Synthetic review' }],
});
const initialSet = (periodId, requirements, history = []) => ({
  academicPeriodId: periodId, wave: 'initial', requirements, history,
});
const fullInitialSet = periodId => initialSet(periodId, Object.fromEntries(
  ['tax_exemption', 'valid_id', 'grades', 'registration_form', 'tuition_receipt']
    .map(key => [key, file(`${key}.pdf`)]),
));
const upload = (docs, periodId, key, name, wave = 'initial') => saveWaveDocument(docs, {
  periodId, key, wave, file: file(name), actorId: 9,
  actorRole: wave === 'initial' ? 'SuperAdmin' : 'Scholar',
});

test('first initial uploads belong to their selected intake and remain available in later periods', () => {
  const docs = initializeWaves({}, 10);
  for (const key of ['tax_exemption', 'valid_id', 'grades', 'registration_form', 'tuition_receipt']) {
    upload(docs, 11, key, `${key}.pdf`);
  }
  assert.equal(docs.initialRequirementPeriodId, 11);
  assert.equal(getInitialRequirements(docs, 12, 10).originalPeriodId, 11);
  assert.deepEqual(Object.keys(getInitialRequirements(docs, 12, 10).requirements).sort(),
    ['grades', 'registration_form', 'tax_exemption', 'tuition_receipt', 'valid_id']);
  for (const schoolType of ['Public', 'Private']) {
    const access = evaluateContinuingSchedule({
      schedule: { uploads_open: true }, period: { id: 12, is_active: true },
      docs, schoolType, legacyPeriodId: 10,
    });
    assert.equal(access.initialApproved, true);
    assert.equal(access.isOpen, true);
  }
});

test('reads recover the sole initial set from a stale empty primary marker without changing stored JSON', () => {
  const docs = {
    initialRequirementPeriodId: 10,
    requirementSets: {
      '10:initial': initialSet(10, {}),
      '11:initial': fullInitialSet(11),
    },
    requirementWaves: { 12: { continuingOpenedAt: '2026-11-17T00:00:00Z' } },
  };
  const before = structuredClone(docs);
  assert.equal(resolveInitialRequirementPeriodId(docs, 10), 11);
  const inherited = getInitialRequirements(docs, 12, 10);
  assert.equal(inherited.originalPeriodId, 11);
  assert.equal(inherited.requirements.tax_exemption.fileName, 'tax_exemption.pdf');
  assert.equal(inherited.requirements.grades.status, 'Approved');
  assert.equal(initializeWaves(docs, 10).initialRequirementPeriodId, 11);
  assert.deepEqual(docs, before);
});

test('a missing origin resolves from a single saved initial period including sets without metadata', () => {
  const docs = { requirementSets: { '11:initial': { requirements: { valid_id: file('id.pdf') } } } };
  assert.equal(resolveInitialRequirementPeriodId(docs, 10), 11);
  assert.equal(getInitialRequirements(docs, 12, 10).requirements.valid_id.fileName, 'id.pdf');
});

test('a populated original marker stays fixed while a later period overrides only its own documents', () => {
  const original = fullInitialSet(11);
  const docs = initializeWaves({
    initialRequirementPeriodId: 11,
    requirementSets: { '11:initial': original },
  }, 10);
  const before = structuredClone(docs.requirementSets['11:initial']);
  upload(docs, 12, 'grades', 'current-grades.pdf');
  assert.equal(docs.initialRequirementPeriodId, 11);
  assert.equal(resolveInitialRequirementPeriodId(docs, 10), 11);
  assert.deepEqual(docs.requirementSets['11:initial'], before);
  assert.equal(getInitialRequirements(docs, 12, 10).requirements.grades.fileName, 'current-grades.pdf');
  assert.equal(getInitialRequirements(docs, 13, 10).requirements.grades.fileName, 'grades.pdf');
});

test('archived initial evidence preserves a known original period rather than redirecting it', () => {
  const history = [{ ...file('original.pdf'), requirementKey: 'grades', archivedAt: '2026-11-16T00:00:00Z' }];
  const docs = {
    initialRequirementPeriodId: 11,
    requirementSets: {
      '11:initial': initialSet(11, {}, history),
      '12:initial': fullInitialSet(12),
    },
  };
  assert.equal(resolveInitialRequirementPeriodId(docs, 10), 11);
  assert.equal(getInitialRequirements(docs, 13, 10).originalPeriodId, 11);
  assert.deepEqual(initializeWaves(docs, 10).requirementSets['11:initial'].history, history);
});

test('genuine legacy files migrate into their explicit original period without losing data', () => {
  const legacy = { tax_exemption: file('legacy-tax.pdf'), grades: file('legacy-grades.pdf') };
  const docs = { initialRequirementPeriodId: 9, requirements: legacy, unrelated: { retained: true } };
  const before = structuredClone(docs);
  const normalized = initializeWaves(docs, 10);
  assert.equal(normalized.initialRequirementPeriodId, 9);
  assert.deepEqual(normalized.requirementSets['9:initial'].requirements, legacy);
  assert.equal(normalized.requirementSets['9:initial'].legacy, true);
  assert.equal(normalized.requirementSets['10:initial'], undefined);
  assert.equal(getInitialRequirements(docs, 12, 10).requirements.grades.fileName, 'legacy-grades.pdf');
  assert.deepEqual(docs, before);
});

test('legacy files without an original marker retain the supplied legacy period', () => {
  const docs = { requirements: { valid_id: file('legacy-id.pdf') } };
  const normalized = initializeWaves(docs, 10);
  assert.equal(normalized.initialRequirementPeriodId, 10);
  assert.equal(normalized.requirementSets['10:initial'].requirements.valid_id.fileName, 'legacy-id.pdf');
  upload(normalized, 11, 'grades', 'later-grades.pdf');
  assert.equal(normalized.initialRequirementPeriodId, 10);
  assert.equal(getInitialRequirements(normalized, 12, 10).requirements.valid_id.fileName, 'legacy-id.pdf');
});

test('continuing files and non-requirement proofs never establish an initial origin', () => {
  const docs = initializeWaves({
    requirements: { priority_pwd: file('priority.pdf') },
    requirementSets: {
      '11:continuing': { academicPeriodId: 11, wave: 'continuing', requirements: { grades: file('continuing.pdf') } },
    },
  }, 10);
  upload(docs, 12, 'registration_form', 'continuing-registration.pdf', 'continuing');
  assert.equal(resolveInitialRequirementPeriodId(docs, 10), 10);
  assert.equal(docs.initialRequirementPeriodId, 10);
  assert.deepEqual(getInitialRequirements(docs, 13, 10).requirements, {});
  assert.equal(docs.requirements.priority_pwd.fileName, 'priority.pdf');
});

test('ambiguous initial histories keep the existing marker or fallback without guessing by time or id', () => {
  const sets = {
    '11:initial': initialSet(11, { grades: { ...file('earlier-id.pdf'), uploadedAt: '2026-11-17T00:00:00Z' } }),
    '12:initial': initialSet(12, { grades: { ...file('earlier-time.pdf'), uploadedAt: '2026-11-16T00:00:00Z' } }),
  };
  assert.equal(resolveInitialRequirementPeriodId({ requirementSets: sets }, 10), 10);
  assert.equal(resolveInitialRequirementPeriodId({ initialRequirementPeriodId: 9, requirementSets: sets }, 10), 9);
  const unmarked = initializeWaves({ requirementSets: sets }, 10);
  upload(unmarked, 13, 'valid_id', 'unmarked-new-id.pdf');
  assert.equal(unmarked.initialRequirementPeriodId, 10);
  const docs = initializeWaves({ initialRequirementPeriodId: 9, requirementSets: sets }, 10);
  upload(docs, 13, 'valid_id', 'new-id.pdf');
  assert.equal(docs.initialRequirementPeriodId, 9);
  assert.deepEqual(getInitialRequirements(docs, 14, 10).requirements, {});
});

test('invalid period keys, mismatched set metadata and empty placeholders cannot establish an origin', () => {
  const docs = {
    initialRequirementPeriodId: 'not-a-period',
    requirementSets: {
      '0:initial': initialSet(0, { grades: file('zero-period.pdf') }),
      '11:initial': initialSet(12, { grades: file('mismatched-period.pdf') }),
      '12:initial': { academicPeriodId: 12, wave: 'continuing', requirements: { grades: file('wrong-wave.pdf') } },
      '13:initial': initialSet(13, { grades: {} }),
    },
  };
  assert.equal(resolveInitialRequirementPeriodId(docs, 10), 10);
  const normalized = initializeWaves(docs, 10);
  assert.equal(normalized.initialRequirementPeriodId, 10);
  upload(normalized, 14, 'valid_id', 'actual-initial.pdf');
  assert.equal(normalized.initialRequirementPeriodId, 14);
});

test('correcting the origin preserves replacement history, other periods and continuing review state', () => {
  const docs = initializeWaves({
    initialRequirementPeriodId: 10,
    requirementSets: {
      '11:initial': fullInitialSet(11),
      '12:continuing': { academicPeriodId: 12, wave: 'continuing', requirements: { grades: file('pending.pdf', 'Pending') }, history: [] },
    },
    requirementWaves: { 12: { continuingOpenedAt: '2026-11-17T00:00:00Z' } },
  }, 10);
  const before = structuredClone(docs);
  const priorGrades = docs.requirementSets['11:initial'].requirements.grades;
  upload(docs, 11, 'grades', 'replacement.pdf');
  assert.equal(docs.initialRequirementPeriodId, 11);
  assert.deepEqual(docs.requirementSets['12:continuing'], before.requirementSets['12:continuing']);
  assert.deepEqual(docs.requirementWaves, before.requirementWaves);
  assert.equal(docs.requirementSets['11:initial'].requirements.tax_exemption.fileData,
    before.requirementSets['11:initial'].requirements.tax_exemption.fileData);
  assert.deepEqual(getScopedDocument(docs, 11, 'initial', 'grades', priorGrades.versionId, 10).reviewHistory,
    priorGrades.reviewHistory);
  assert.equal(getScopedDocument(docs, 11, 'initial', 'grades', priorGrades.versionId, 10).fileData,
    priorGrades.fileData);
  const effective = getEffectiveRequirements(docs, 12, 10).requirements;
  assert.equal(effective.tax_exemption.fileName, 'tax_exemption.pdf');
  assert.equal(effective.grades.fileName, 'pending.pdf');
  assert.equal(effective.grades.status, 'Pending');
});
