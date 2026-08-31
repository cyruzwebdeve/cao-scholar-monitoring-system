const assert = require('node:assert/strict');
const test = require('node:test');

const {
  applyPendingApprovals,
  applyReviewDecision,
  buildReviewRecords,
  normalizeReviewStatus,
} = require('../services/documentReview');

test('normalizes new, legacy, approved, and rejected document states', () => {
  assert.equal(normalizeReviewStatus('Submitted'), 'pending');
  assert.equal(normalizeReviewStatus('Pending'), 'pending');
  assert.equal(normalizeReviewStatus('Complete'), 'approved');
  assert.equal(normalizeReviewStatus('Rejected'), 'rejected');
});

test('approval preserves the uploaded file and records review metadata', () => {
  const reviewedAt = new Date('2026-08-20T10:00:00Z');
  const result = applyReviewDecision({
    initialDocs: { requirements: { valid_id: { fileName: 'id.pdf', fileUrl: 'private-url', status: 'Pending' } } },
    requirementKey: 'valid_id',
    decision: 'approved',
    reviewerId: 4,
    notes: 'Readable and current.',
    reviewedAt,
  });

  assert.equal(result.requirements.valid_id.fileName, 'id.pdf');
  assert.equal(result.requirements.valid_id.fileUrl, 'private-url');
  assert.equal(result.requirements.valid_id.status, 'Approved');
  assert.equal(result.requirements.valid_id.reviewedBy, 4);
  assert.equal(result.requirements.valid_id.reviewedAt, reviewedAt.toISOString());
});

test('rejection stores the correction reason without deleting the upload', () => {
  const result = applyReviewDecision({
    initialDocs: { requirements: { grades: { fileName: 'grades.jpg', status: 'Pending' } } },
    requirementKey: 'grades',
    decision: 'rejected',
    reviewerId: 5,
    notes: 'The lower half is unreadable.',
  });

  assert.equal(result.requirements.grades.status, 'Rejected');
  assert.equal(result.requirements.grades.reviewNotes, 'The lower half is unreadable.');
  assert.equal(result.requirements.grades.fileName, 'grades.jpg');
});

test('refuses decisions for missing or unsupported requirement documents', () => {
  assert.equal(applyReviewDecision({ initialDocs: {}, requirementKey: 'valid_id', decision: 'approved', reviewerId: 1 }), null);
  assert.equal(applyReviewDecision({ initialDocs: { requirements: { unknown: { fileName: 'x.pdf' } } }, requirementKey: 'unknown', decision: 'approved', reviewerId: 1 }), null);
});

test('[SUCCESS] bulk approval updates only pending supported documents', () => {
  const reviewedAt = new Date('2026-08-20T12:00:00Z');
  const result = applyPendingApprovals({
    initialDocs: {
      requirements: {
        tax_exemption: { fileName: 'tax.pdf', status: 'Pending' },
        indigency: { fileName: 'indigency.pdf', status: 'Approved', reviewedBy: 2 },
        grades: { fileName: 'grades.pdf', status: 'Rejected', reviewNotes: 'Unreadable.' },
        unsupported: { fileName: 'other.pdf', status: 'Pending' },
      },
    },
    reviewerId: 9,
    reviewedAt,
  });

  assert.deepEqual(result.approvedKeys, ['tax_exemption']);
  assert.equal(result.updatedDocuments.requirements.tax_exemption.status, 'Approved');
  assert.equal(result.updatedDocuments.requirements.tax_exemption.reviewedBy, 9);
  assert.equal(result.updatedDocuments.requirements.tax_exemption.reviewedAt, reviewedAt.toISOString());
  assert.equal(result.updatedDocuments.requirements.indigency.reviewedBy, 2);
  assert.equal(result.updatedDocuments.requirements.grades.status, 'Rejected');
  assert.equal(result.updatedDocuments.requirements.unsupported.status, 'Pending');
});

test('[FAILED] bulk approval refuses a scholar with no pending supported documents', () => {
  const result = applyPendingApprovals({
    initialDocs: { requirements: { valid_id: { fileName: 'id.pdf', status: 'Approved' } } },
    reviewerId: 9,
  });
  assert.equal(result, null);
});

test('priority proofs require an individual decision and are marked as auto-acceptance reviews', () => {
  const initialDocs = { requirements: { priority_pwd: { fileName: 'pwd-id.pdf', status: 'Pending' } } };
  assert.equal(applyPendingApprovals({ initialDocs, reviewerId: 9 }), null);

  const [record] = buildReviewRecords({
    applications: [{ id: 15, applicant_id: 8, email: 'applicant@example.com', initial_docs: initialDocs }],
    applicantsById: new Map([[8, { first_name: 'Mia', last_name: 'Reyes' }]]),
    accountsByApplicant: new Map(),
  });
  assert.equal(record.category, 'priority');
  assert.equal(record.autoAcceptance, true);
  assert.match(record.requirementLabel, /disability/i);
});

test('builds a review queue without exposing private URLs or encoded file data', () => {
  const records = buildReviewRecords({
    applications: [{
      id: 12,
      applicant_id: 7,
      email: 'scholar@example.com',
      updated_at: new Date('2026-08-20T09:00:00Z'),
      initial_docs: { requirements: { tax_exemption: { fileName: 'tax.pdf', fileType: 'application/pdf', fileUrl: 'secret-url', fileData: 'secret-data', status: 'Pending', uploadedAt: '2026-08-20T08:00:00Z' } } },
    }],
    applicantsById: new Map([[7, { first_name: 'Ana', last_name: 'Cruz', email: 'scholar@example.com', municipality: 'Daet' }]]),
    accountsByApplicant: new Map([[7, { control_number: 'PGCEAP-007' }]]),
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].scholarName, 'ANA CRUZ');
  assert.equal(records[0].status, 'pending');
  assert.equal(Object.hasOwn(records[0], 'fileUrl'), false);
  assert.equal(Object.hasOwn(records[0], 'fileData'), false);
});
