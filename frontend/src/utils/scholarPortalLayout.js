export const getRequirementReviewStatus = (item) => {
  if (!item?.fileName) return 'missing';
  const status = String(item.status || '').toLowerCase();
  if (['approved', 'complete', 'completed'].includes(status)) return 'approved';
  if (['rejected', 'declined'].includes(status)) return 'rejected';
  return 'pending';
};

export const requirementStatusLabels = { missing: 'Missing', pending: 'Pending review', rejected: 'Returned', approved: 'Approved' };

// Presentation only. Backend upload permissions and decision rules remain authoritative.
export const buildScholarNextStep = ({ loading, error, continuingOpen, uploadsClosed, rejectedCount = 0,
  missingCount = 0, pendingReviewCount = 0, requirementsComplete, listed, guidance } = {}) => {
  if (loading || error) return { tone: 'waiting', title: error ? 'Refresh your scholar record' : 'Checking your record',
    description: error ? 'Your records could not be refreshed. Use Retry now before taking action.' : 'Your next step will appear once your records are available.' };
  if (!continuingOpen) return { tone: 'waiting', title: 'Wait for CAO verification',
    description: 'CAO manages your initial documents. Continuing uploads become available when your record is ready.', tab: 'initial', action: 'View initial documents' };
  if (uploadsClosed && !requirementsComplete) return { tone: 'waiting', title: 'Continuing uploads are closed',
    description: 'Review your document status below. Contact CAO if a correction is needed while uploads are closed.', tab: 'continuing', action: 'View requirements' };
  if (rejectedCount) return { tone: 'attention', title: 'Update your returned documents',
    description: `${rejectedCount} document${rejectedCount === 1 ? ' needs' : 's need'} correction. Read the review notes and upload a replacement.`, tab: 'continuing', action: 'Review returned documents' };
  if (missingCount) return { tone: 'attention', title: 'Complete your continuing requirements',
    description: `${missingCount} document${missingCount === 1 ? ' is' : 's are'} still missing. Submit your files for CAO review.`, tab: 'continuing', action: 'Upload missing documents' };
  if (pendingReviewCount) return { tone: 'waiting', title: 'Your documents are under review',
    description: 'Your files have been submitted. No further upload is needed unless CAO returns a document.', tab: 'continuing', action: 'View submitted documents' };
  if (requirementsComplete) return { tone: listed ? 'complete' : 'waiting',
    title: listed ? 'You are up to date' : 'Your continuing documents are approved',
    description: listed ? 'Your list record is available below. Check your updates for any new CAO instructions.' : 'CAO will review your record for list preparation. Watch this portal for updates.',
    tab: 'continuing', action: 'View approved documents' };
  return { tone: 'waiting', title: guidance?.headline || 'Watch for your next update',
    description: guidance?.description || 'Your scholarship record is being reviewed by CAO.', tab: 'initial', action: 'View requirements' };
};
