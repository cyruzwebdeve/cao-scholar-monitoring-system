const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getContinuingRequirements, getEffectiveRequirements, getScopedDocument,
  getWaveSet, initializeWaves, saveWaveDocument,
} = require('../services/requirementWaves');

const firstSemester = { id: 11, school_year: '2028-2029', semester: '1st Semester' };
const file = (name, status = 'Approved') => ({
  fileName: `${name}.pdf`, fileData: 'synthetic-file-content', fileType: 'application/pdf',
  versionId: `version-${name}`, revision: 3, status,
  uploadedAt: '2026-11-17T01:00:00Z', uploadedBy: 9, uploadedByRole: 'SuperAdmin',
  reviewedAt: '2026-11-17T02:00:00Z', reviewedBy: 9, reviewNotes: 'Synthetic CAO review',
  reviewHistory: [{ status: 'Approved', notes: 'Synthetic review history' }],
});
const set = (periodId, wave, requirements, history = []) => ({
  academicPeriodId: periodId, wave, requirements, history,
});
const fixture = () => ({
  initialRequirementPeriodId: 11,
  requirementSets: {
    '11:initial': set(11, 'initial', {
      grades: file('initial-grades'), registration_form: file('initial-registration'),
      report_card: file('initial-report-card'), tuition_receipt: file('initial-tuition'),
      valid_id: file('initial-id'),
    }, [{ ...file('older-grades'), requirementKey: 'grades' }]),
  },
  requirementWaves: { 11: { continuingOpenedAt: '2026-11-17T03:00:00Z' } },
});
const reusableKeys = requirements => Object.keys(requirements).sort();

test('original first-semester COG and registration are reused with exact source identity and review evidence', () => {
  const docs = fixture();
  const original = structuredClone(docs);
  const result = getContinuingRequirements(docs, firstSemester, 10);
  assert.equal(result.wave, 'continuing');
  assert.equal(result.academicPeriodId, 11);
  assert.deepEqual(reusableKeys(result.requirements), ['grades', 'registration_form']);
  for (const key of ['grades', 'registration_form']) {
    assert.deepEqual(result.requirements[key], {
      ...original.requirementSets['11:initial'].requirements[key],
      reusedFromInitial: true, sourceAcademicPeriodId: 11, sourceSubmissionWave: 'initial',
    });
  }
  assert.deepEqual(docs, original);
  assert.equal(docs.requirementSets['11:continuing'], undefined);
  assert.equal(getWaveSet(docs, 11, 'continuing').requirements.grades, undefined);
});

test('source approval aliases and stored URL are supported without altering source statuses', () => {
  for (const status of ['Approved', ' approved ', 'Complete', 'COMPLETED']) {
    const docs = fixture();
    const grades = docs.requirementSets['11:initial'].requirements.grades;
    grades.status = status; delete grades.fileData; grades.fileUrl = 'synthetic-private-file-location';
    const result = getContinuingRequirements(docs, { ...firstSemester, semester: '  1st   SEMESTER ' });
    assert.equal(result.requirements.grades.status, status);
    assert.equal(result.requirements.grades.fileUrl, grades.fileUrl);
  }
});

test('missing, pending, rejected and inaccessible initial evidence is not reused', () => {
  for (const replacement of [undefined, file('pending', 'Pending'), file('rejected', 'Rejected'),
    { fileName: 'metadata-only.pdf', status: 'Approved' },
    { fileData: 'synthetic', status: 'Approved' }]) {
    const docs = fixture();
    if (replacement) docs.requirementSets['11:initial'].requirements.grades = replacement;
    else delete docs.requirementSets['11:initial'].requirements.grades;
    const result = getContinuingRequirements(docs, firstSemester);
    assert.equal(result.requirements.grades, undefined);
    assert.ok(result.requirements.registration_form);
  }
});

test('an initial Grade 12 report card never substitutes for COG and tuition/other initial files are excluded', () => {
  const docs = fixture(); delete docs.requirementSets['11:initial'].requirements.grades;
  const result = getContinuingRequirements(docs, firstSemester);
  assert.deepEqual(reusableKeys(result.requirements), ['registration_form']);
  assert.equal(result.requirements.grades, undefined);
  assert.equal(result.requirements.report_card, undefined);
  assert.equal(result.requirements.tuition_receipt, undefined);
  assert.equal(result.requirements.valid_id, undefined);
});

test('explicit continuing documents remain authoritative even when pending, rejected or empty', () => {
  for (const replacement of [file('new-grades', 'Pending'), file('returned-grades', 'Rejected'), {}, null]) {
    const docs = fixture();
    docs.requirementSets['11:continuing'] = set(11, 'continuing', { grades: replacement },
      [{ ...file('previous-continuing'), requirementKey: 'grades' }]);
    const original = structuredClone(docs);
    const result = getContinuingRequirements(docs, firstSemester);
    const physical = getWaveSet(docs, 11, 'continuing');
    assert.deepEqual(result.requirements.grades, physical.requirements.grades);
    assert.ok(result.requirements.registration_form.reusedFromInitial);
    assert.deepEqual(result.history, physical.history);
    assert.deepEqual(docs, original);
  }
});

test('later semesters, later academic years and absent semester context do not reuse initial files', () => {
  const docs = fixture();
  for (const period of [
    { ...firstSemester, id: 12, semester: '2nd Semester' },
    { ...firstSemester, semester: '2nd Semester' },
    { ...firstSemester, semester: 'Summer' },
    { ...firstSemester, id: 21, school_year: '2029-2030' },
    { id: 11 },
    { ...firstSemester, semester: 'First Semester' },
  ]) assert.deepEqual(getContinuingRequirements(docs, period).requirements, {});
  assert.deepEqual(getEffectiveRequirements(docs, 11).requirements, { valid_id: docs.requirementSets['11:initial'].requirements.valid_id,
    report_card: docs.requirementSets['11:initial'].requirements.report_card });
});

test('effective requirements use matching context only and preserve the initial state before continuing opens', () => {
  const docs = fixture();
  const effective = getEffectiveRequirements(docs, 11, 10, firstSemester).requirements;
  assert.ok(effective.grades.reusedFromInitial);
  assert.ok(effective.registration_form.reusedFromInitial);
  assert.equal(effective.tuition_receipt, undefined);
  assert.equal(effective.valid_id.fileName, 'initial-id.pdf');
  assert.equal(getEffectiveRequirements(docs, 11, 10, { ...firstSemester, id: 21 }).requirements.grades, undefined);
  delete docs.requirementWaves[11];
  assert.equal(getEffectiveRequirements(docs, 11, 10, firstSemester).requirements.grades.reusedFromInitial, undefined);
  assert.equal(getEffectiveRequirements(docs, 11, 10, firstSemester).requirements.tuition_receipt.fileName, 'initial-tuition.pdf');
});

test('sole saved initial period recovers an empty stale origin before deciding reuse without modifying JSON', () => {
  const docs = fixture(); docs.initialRequirementPeriodId = 10;
  docs.requirementSets['10:initial'] = set(10, 'initial', {});
  const original = structuredClone(docs);
  assert.ok(getContinuingRequirements(docs, firstSemester, 10).requirements.grades.reusedFromInitial);
  assert.deepEqual(docs, original);
  assert.equal(getContinuingRequirements(docs, { ...firstSemester, id: 10 }, 10).requirements.grades, undefined);
});

test('a populated original period and ambiguous histories cannot reuse a later initial set', () => {
  const docs = fixture(); docs.initialRequirementPeriodId = 10;
  docs.requirementSets['10:initial'] = set(10, 'initial', { grades: file('original-grades') });
  assert.deepEqual(getContinuingRequirements(docs, firstSemester, 10).requirements, {});
  delete docs.initialRequirementPeriodId;
  assert.deepEqual(getContinuingRequirements(docs, firstSemester, 10).requirements, {});
});

test('legacy same-period files can be reused while source and continuing history remain independently scoped', () => {
  const legacy = { initialRequirementPeriodId: 11, requirements: { grades: file('legacy-grades'), registration_form: file('legacy-registration') } };
  const original = structuredClone(legacy);
  const result = getContinuingRequirements(legacy, firstSemester, 10);
  assert.ok(result.requirements.grades.reusedFromInitial);
  result.requirements.grades.reviewHistory[0].notes = 'Changed projection only';
  assert.deepEqual(legacy, original);
  assert.equal(getScopedDocument(legacy, 11, 'continuing', 'grades'), undefined);
  assert.equal(getScopedDocument(legacy, 11, 'initial', 'grades').fileName, 'legacy-grades.pdf');
});

test('Scholar replacement creates Pending continuing evidence while retaining approved originals and later versions', () => {
  const docs = initializeWaves(fixture(), 10);
  const initial = structuredClone(docs.requirementSets['11:initial']);
  const upload = name => saveWaveDocument(docs, { periodId: 11, wave: 'continuing', key: 'grades',
    file: file(name), actorId: 7, actorRole: 'Scholar' });
  const replacement = upload('scholar-replacement');
  assert.equal(replacement.status, 'Pending');
  assert.equal(getContinuingRequirements(docs, firstSemester).requirements.grades.reusedFromInitial, undefined);
  assert.equal(getContinuingRequirements(docs, firstSemester).requirements.grades.fileName, 'scholar-replacement.pdf');
  upload('scholar-second-replacement');
  assert.equal(getScopedDocument(docs, 11, 'continuing', 'grades', replacement.versionId).fileName, 'scholar-replacement.pdf');
  assert.deepEqual(docs.requirementSets['11:initial'], initial);
  assert.equal(getContinuingRequirements(docs, firstSemester).requirements.registration_form.fileName, 'initial-registration.pdf');
});
