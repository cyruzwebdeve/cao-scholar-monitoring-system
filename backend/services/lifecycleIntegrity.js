const ONLINE_REQUIREMENTS = [
  { key: 'tax_exemption', label: 'Certificate of Tax Exemption', fileField: 'cert_tax_exemption_file', statusField: 'cert_tax_exemption_review_status' },
  { key: 'indigency', label: 'Barangay Indigency', fileField: 'barangay_indigency_file', statusField: 'barangay_indigency_review_status' },
  { key: 'valid_id', label: 'Photocopy of ID', fileField: 'valid_id_photocopy_file', statusField: 'valid_id_photocopy_review_status' },
  { key: 'grades', label: 'Certificate of Grades', fileField: 'grade_report_file', statusField: 'grade_report_review_status' },
  { key: 'registration_form', label: 'Registration Form', fileField: 'registration_form_file', statusField: 'registration_form_review_status' },
  { key: 'tuition_receipt', label: 'Official Receipt of Tuition Fee', fileField: 'tuition_fee_receipt_file', statusField: 'tuition_fee_receipt_review_status' },
];

const APPROVED_STATUSES = new Set(['approved', 'complete', 'completed']);
const OVERRIDABLE_BILLING_REASON_CODES = new Set([
  'REQUIREMENT_MISSING',
  'REQUIREMENT_NOT_APPROVED',
  'PHYSICAL_FOLDER_MISSING',
]);

const normalizeStatus = (value) => String(value || '').trim().toLowerCase();

const getSchoolProcessRoute = (schoolType) => (
  normalizeStatus(schoolType) === 'private' ? 'billing' : 'payroll'
);

const getRequirementSnapshot = ({ initialDocs, requirement, schoolType = 'private' } = {}) => {
  const uploadedRequirements = initialDocs?.requirements || {};
  const applicableRequirements = getSchoolProcessRoute(schoolType) === 'billing'
    ? ONLINE_REQUIREMENTS
    : ONLINE_REQUIREMENTS.filter(({ key }) => key !== 'tuition_receipt');
  const online = applicableRequirements.map((definition) => {
    const uploaded = uploadedRequirements[definition.key];
    const submitted = Boolean(uploaded?.fileName || requirement?.[definition.fileField]);
    const status = normalizeStatus(uploaded?.status || requirement?.[definition.statusField] || 'pending');
    return {
      key: definition.key,
      label: definition.label,
      submitted,
      approved: submitted && APPROVED_STATUSES.has(status),
      status,
    };
  });

  return {
    online,
    onlineApproved: online.filter(({ approved }) => approved).length,
    onlineTotal: online.length,
    physicalFolderSubmitted: Boolean(requirement?.folder_physical_submitted),
  };
};

const evaluateBillingEligibility = ({ isActive, alreadyBilled, initialDocs, requirement, schoolType } = {}) => {
  const snapshot = getRequirementSnapshot({ initialDocs, requirement, schoolType });
  const reasons = [];

  if (!isActive) reasons.push({ code: 'SCHOLAR_INACTIVE', message: 'Scholar account is not active.' });
  snapshot.online.forEach((item) => {
    if (!item.submitted) reasons.push({ code: 'REQUIREMENT_MISSING', requirement: item.key, message: `${item.label} has not been uploaded.` });
    else if (!item.approved) reasons.push({ code: 'REQUIREMENT_NOT_APPROVED', requirement: item.key, message: `${item.label} has not been approved by a Moderator.` });
  });
  if (!snapshot.physicalFolderSubmitted) {
    reasons.push({ code: 'PHYSICAL_FOLDER_MISSING', message: 'The white long folder has not been received by CAO.' });
  }
  if (alreadyBilled) reasons.push({ code: 'ALREADY_BILLED', message: 'Scholar is already billed for this academic period.' });

  return { eligible: reasons.length === 0, reasons, snapshot };
};

const evaluateBillingOverride = ({ eligibility, reason } = {}) => {
  const normalizedReason = String(reason || '').trim().replace(/\s+/g, ' ');
  const eligibilityReasons = Array.isArray(eligibility?.reasons) ? eligibility.reasons : [];
  const hardBlockers = eligibilityReasons.filter(({ code }) => !OVERRIDABLE_BILLING_REASON_CODES.has(code));
  const errors = [];

  if (normalizedReason.length < 10) errors.push('Provide an override reason with at least 10 characters.');
  if (normalizedReason.length > 500) errors.push('The override reason must not exceed 500 characters.');
  if (!eligibilityReasons.length) errors.push('This scholar does not require a billing eligibility override.');
  if (hardBlockers.length) errors.push(...hardBlockers.map(({ message }) => message));

  return {
    allowed: errors.length === 0,
    reason: normalizedReason,
    errors,
    hardBlockers,
  };
};

const isPayableClaim = (claim) => {
  if (!claim) return false;
  const status = normalizeStatus(claim.claim_status);
  return !claim.claimed_date && !['paid', 'claimed', 'released'].includes(status);
};

module.exports = {
  APPROVED_STATUSES,
  ONLINE_REQUIREMENTS,
  OVERRIDABLE_BILLING_REASON_CODES,
  evaluateBillingEligibility,
  evaluateBillingOverride,
  getSchoolProcessRoute,
  getRequirementSnapshot,
  isPayableClaim,
};
