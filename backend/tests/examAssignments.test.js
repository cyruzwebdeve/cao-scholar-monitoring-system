const assert = require('node:assert/strict');
const test = require('node:test');

const {
  assignApplicantToMunicipalityExam,
  assignApplicantsToMunicipalityExams,
  buildExamSlotAssignments,
  countScheduledApplicants,
} = require('../services/examAssignments');

const academicYear = '2026-2027';
const exams = [
  { id: 10, municipality: 'Daet', academic_year: academicYear, updated_at: new Date('2026-08-20T10:00:00Z') },
  { id: 11, municipality: 'Basud', academic_year: academicYear, updated_at: new Date('2026-08-20T11:00:00Z') },
];

test('builds one current-year exam-slot assignment per matching municipality', () => {
  const assignments = buildExamSlotAssignments({
    academicYear,
    exams,
    applicants: [
      { id: 1, municipality: ' daet ' },
      { id: 2, municipality: 'BASUD' },
      { id: 3, municipality: 'Labo' },
    ],
  });

  assert.deepEqual(assignments, [
    { applicant_id: 1, exam_id: 10, appeared: false },
    { applicant_id: 2, exam_id: 11, appeared: false },
  ]);
});

test('scheduled metric counts municipality matches even before every slot is persisted', () => {
  const scheduled = countScheduledApplicants({
    academicYear,
    legacySchoolYear: '2025-2026',
    exams,
    applicants: [
      { id: 1, municipality: 'Daet', school_year: academicYear },
      { id: 2, municipality: 'Basud', school_year: academicYear },
      { id: 3, municipality: 'Labo', school_year: academicYear },
      { id: 4, municipality: 'Daet', school_year: '2024-2025' },
    ],
    slots: [{ applicant_id: 1, exam_id: 10 }],
  });

  assert.equal(scheduled, 2);
});

test('assigns a newly submitted applicant to the municipality schedule without marking attendance', async () => {
  let upsertPayload;
  const client = {
    exams: { findFirst: async () => exams[0] },
    exam_slots: {
      upsert: async (payload) => {
        upsertPayload = payload;
        return { id: 25, ...payload.create };
      },
    },
  };

  const slot = await assignApplicantToMunicipalityExam(client, {
    applicantId: 7,
    municipality: 'Daet',
    academicYear,
  });

  assert.equal(slot.exam_id, 10);
  assert.equal(slot.appeared, false);
  assert.deepEqual(upsertPayload.where, { applicant_id_exam_id: { applicant_id: 7, exam_id: 10 } });
});

test('bulk assignment uses duplicate-safe inserts for matching existing applicants', async () => {
  let createManyPayload;
  const client = {
    applicants: {
      findMany: async () => [
        { id: 1, municipality: 'Daet' },
        { id: 2, municipality: 'Basud' },
      ],
    },
    exam_slots: {
      createMany: async (payload) => {
        createManyPayload = payload;
        return { count: 1 };
      },
    },
  };

  const result = await assignApplicantsToMunicipalityExams(client, {
    exams,
    academicYear,
    legacySchoolYear: '2025-2026',
  });

  assert.deepEqual(result, { matched: 2, created: 1 });
  assert.equal(createManyPayload.skipDuplicates, true);
  assert.equal(createManyPayload.data.length, 2);
});
