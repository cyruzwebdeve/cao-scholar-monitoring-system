const { PRIORITY_PROOFS } = require('./priorityEligibility');

const REQUIREMENT_DEFINITIONS = Object.freeze({
  tax_exemption: Object.freeze({ label: 'Certificate of Tax Exemption', statusField: 'cert_tax_exemption_review_status' }),
  indigency: Object.freeze({ label: 'Barangay Indigency', statusField: 'barangay_indigency_review_status' }),
  valid_id: Object.freeze({ label: 'Photocopy of ID (any valid ID)', statusField: 'valid_id_photocopy_review_status' }),
  grades: Object.freeze({ label: 'Certificate of Grades (previous semester attended)', statusField: 'grade_report_review_status' }),
  registration_form: Object.freeze({ label: 'Registration Form (current school year)', statusField: 'registration_form_review_status' }),
  tuition_receipt: Object.freeze({ label: 'Official Receipt of Tuition Fee', statusField: 'tuition_fee_receipt_review_status' }),
  ...PRIORITY_PROOFS,
});

const normalizeReviewStatus = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (['approved', 'complete', 'completed'].includes(normalized)) return 'approved';
  if (['rejected', 'declined'].includes(normalized)) return 'rejected';
  return 'pending';
};

const getRequirementDocument = (application, requirementKey) => (
  application?.initial_docs?.requirements?.[requirementKey] || null
);

const serializeReviewRecord = ({ application, applicant, account, requirementKey, file, reviewerName = null }) => ({
  id: `${application.id}:${requirementKey}`,
  applicationId: application.id,
  applicantId: application.applicant_id,
  scholarName: [applicant?.first_name, applicant?.middle_name, applicant?.last_name].filter(Boolean).join(' ').toUpperCase()
    || application.full_name
    || application.email,
  email: applicant?.email || application.email,
  controlNumber: account?.control_number || null,
  municipality: applicant?.municipality || application.address?.municipality || 'Not specified',
  requirementKey,
  requirementLabel: REQUIREMENT_DEFINITIONS[requirementKey].label,
  fileName: file.fileName,
  fileType: file.fileType || 'application/octet-stream',
  status: normalizeReviewStatus(file.status),
  uploadedAt: file.uploadedAt || application.updated_at,
  reviewedAt: file.reviewedAt || null,
  reviewedBy: file.reviewedBy || null,
  reviewerName,
  reviewNotes: file.reviewNotes || '',
  category: REQUIREMENT_DEFINITIONS[requirementKey].category || 'scholar_requirement',
  autoAcceptance: REQUIREMENT_DEFINITIONS[requirementKey].category === 'priority',
});

const buildReviewRecords = ({ applications, applicantsById, accountsByApplicant, reviewersById = new Map() }) => {
  const records = [];
  applications.forEach((application) => {
    Object.entries(application.initial_docs?.requirements || {}).forEach(([requirementKey, file]) => {
      if (!REQUIREMENT_DEFINITIONS[requirementKey] || !file?.fileName) return;
      records.push(serializeReviewRecord({
        application,
        applicant: applicantsById.get(application.applicant_id),
        account: accountsByApplicant.get(application.applicant_id),
        requirementKey,
        file,
        reviewerName: reviewersById.get(Number(file.reviewedBy)) || null,
      }));
    });
  });
  return records.sort((left, right) => new Date(right.uploadedAt) - new Date(left.uploadedAt));
};

const applyReviewDecision = ({ initialDocs, requirementKey, decision, reviewerId, notes, reviewedAt = new Date() }) => {
  const document = initialDocs?.requirements?.[requirementKey];
  if (!REQUIREMENT_DEFINITIONS[requirementKey] || !document?.fileName) return null;
  return {
    ...initialDocs,
    requirements: {
      ...initialDocs.requirements,
      [requirementKey]: {
        ...document,
        status: decision === 'approved' ? 'Approved' : 'Rejected',
        reviewedBy: reviewerId,
        reviewedAt: reviewedAt.toISOString(),
        reviewNotes: String(notes || '').trim(),
      },
    },
  };
};

const applyPendingApprovals = ({ initialDocs, reviewerId, notes = '', reviewedAt = new Date() }) => {
  const pendingKeys = Object.keys(initialDocs?.requirements || {}).filter((requirementKey) => {
    const document = getRequirementDocument({ initial_docs: initialDocs }, requirementKey);
    return REQUIREMENT_DEFINITIONS[requirementKey]
      && REQUIREMENT_DEFINITIONS[requirementKey].bulkApprovable !== false
      && document?.fileName
      && normalizeReviewStatus(document.status) === 'pending';
  });
  if (!pendingKeys.length) return null;

  const timestamp = reviewedAt instanceof Date ? reviewedAt : new Date(reviewedAt);
  const updatedDocuments = pendingKeys.reduce((documents, requirementKey) => applyReviewDecision({
    initialDocs: documents,
    requirementKey,
    decision: 'approved',
    reviewerId,
    notes,
    reviewedAt: timestamp,
  }), initialDocs);

  return { updatedDocuments, approvedKeys: pendingKeys };
};

module.exports = {
  REQUIREMENT_DEFINITIONS,
  applyPendingApprovals,
  applyReviewDecision,
  buildReviewRecords,
  getRequirementDocument,
  normalizeReviewStatus,
};
