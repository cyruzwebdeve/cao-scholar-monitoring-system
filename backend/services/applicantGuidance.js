const { getRequirementSnapshot } = require('./lifecycleIntegrity');

const REJECTED_STATUSES = new Set(['rejected', 'declined']);

const formatCount = (count, singular, plural = `${singular}s`) => (
  `${count} ${count === 1 ? singular : plural}`
);

const makeTimelineItem = ({ id, label, status, detail, completedAt = null }) => ({
  id,
  label,
  status,
  detail,
  completedAt,
});

const makeAction = ({ id, type, title, description, priority = 'normal', route = null }) => ({
  id,
  type,
  title,
  description,
  priority,
  route,
});

const buildApplicantGuidance = ({
  application,
  result,
  scholar,
  scholarRequirement,
  payrollClaim,
  payrollBatch,
  scheduledExam,
} = {}) => {
  if (!application) {
    return {
      state: 'action_required',
      headline: 'Complete your scholarship application',
      description: 'Submit the application form before the Scholarship Office can review your record.',
      actions: [makeAction({
        id: 'submit-application',
        type: 'application',
        title: 'Submit your application',
        description: 'Complete all required application sections and submit the form.',
        priority: 'high',
        route: 'application',
      })],
      timeline: [],
    };
  }

  const hasResult = Boolean(result);
  const isScholar = Boolean(scholar?.is_active);
  const examBypassed = isScholar && !hasResult && String(scholar?.notes || '').includes('verified proof');
  const examScheduled = Boolean(scheduledExam?.is_active);
  const requirementSnapshot = getRequirementSnapshot({
    initialDocs: application.initial_docs,
    requirement: scholarRequirement,
  });
  const rejectedRequirements = requirementSnapshot.online.filter(({ status }) => REJECTED_STATUSES.has(status));
  const missingRequirements = requirementSnapshot.online.filter(({ submitted }) => !submitted);
  const pendingRequirements = requirementSnapshot.online.filter(({ submitted, approved, status }) => (
    submitted && !approved && !REJECTED_STATUSES.has(status)
  ));
  const requirementsComplete = requirementSnapshot.onlineApproved === requirementSnapshot.onlineTotal
    && requirementSnapshot.physicalFolderSubmitted;
  const includedInPayrollList = Boolean(payrollClaim);

  const timeline = [
    makeTimelineItem({
      id: 'application',
      label: 'Application submitted',
      status: 'completed',
      detail: 'Your application was received by the Scholarship Office.',
      completedAt: application.submitted_at || null,
    }),
    makeTimelineItem({
      id: 'examination',
      label: 'Qualifying examination',
      status: hasResult || examBypassed ? 'completed' : 'current',
      detail: examBypassed
        ? 'The qualifying examination was bypassed after CAO verified a priority eligibility proof.'
        : hasResult
          ? 'Your examination submission has been recorded.'
        : examScheduled
          ? 'Your examination schedule is available.'
          : 'The Scholarship Office has not published your examination schedule yet.',
      completedAt: result?.created_at || (examBypassed ? scholar?.issued_at || null : null),
    }),
    makeTimelineItem({
      id: 'decision',
      label: 'Scholarship decision',
      status: isScholar ? 'completed' : hasResult ? 'current' : 'upcoming',
      detail: isScholar
        ? 'You have been accepted as an active scholar.'
        : hasResult
          ? 'Your examination and application are awaiting the official decision.'
          : 'This stage begins after the qualifying examination.',
      completedAt: scholar?.issued_at || null,
    }),
    makeTimelineItem({
      id: 'requirements',
      label: 'Scholar requirements',
      status: requirementsComplete ? 'completed' : isScholar ? 'current' : 'upcoming',
      detail: requirementsComplete
        ? 'All online requirements and the physical folder are recorded.'
        : isScholar
          ? `${requirementSnapshot.onlineApproved} of ${requirementSnapshot.onlineTotal} online requirements are approved.`
          : 'Requirements become available after scholar acceptance.',
      completedAt: requirementsComplete ? scholarRequirement?.updated_at || null : null,
    }),
    makeTimelineItem({
      id: 'payroll_list',
      label: 'Payroll list',
      status: includedInPayrollList ? 'completed' : requirementsComplete ? 'current' : 'upcoming',
      detail: includedInPayrollList
        ? 'You are included in the generated payroll list for the academic period.'
        : requirementsComplete
          ? 'Your record is ready for payroll-list preparation.'
          : 'Payroll-list preparation follows requirement completion.',
      completedAt: payrollClaim?.created_at || payrollBatch?.prepared_at || null,
    }),
  ];

  if (!hasResult) {
    if (examScheduled) {
      return {
        state: 'action_required',
        headline: 'Your examination is scheduled',
        description: 'Review the published schedule and prepare for the qualifying examination.',
        actions: [makeAction({
          id: 'complete-examination',
          type: 'examination',
          title: 'Review your examination schedule',
          description: scheduledExam.venue
            ? `Your assigned venue is ${scheduledExam.venue}.`
            : 'Open the examination details to review your assigned schedule.',
          priority: 'high',
          route: 'examination',
        })],
        timeline,
      };
    }
    return {
      state: 'waiting',
      headline: 'Wait for your examination schedule',
      description: 'Your application is recorded. CAO will publish the schedule assigned to your municipality.',
      actions: [makeAction({
        id: 'wait-exam-schedule',
        type: 'waiting',
        title: 'No action is required right now',
        description: 'Check this portal for the date, venue, and examination instructions.',
      })],
      timeline,
    };
  }

  if (!isScholar) {
    return {
      state: 'waiting',
      headline: 'Your examination is under review',
      description: 'The Scholarship Office will publish the official decision after reviewing your application and examination.',
      actions: [makeAction({
        id: 'wait-official-decision',
        type: 'waiting',
        title: 'No action is required right now',
        description: 'Keep your contact information available and monitor this portal for the official result.',
      })],
      timeline,
    };
  }

  const actions = [];
  if (rejectedRequirements.length) {
    actions.push(makeAction({
      id: 'replace-rejected-requirements',
      type: 'requirements',
      title: `Replace ${formatCount(rejectedRequirements.length, 'returned document')}`,
      description: rejectedRequirements.map(({ label }) => label).join(', '),
      priority: 'high',
      route: 'requirements',
    }));
  }
  if (missingRequirements.length) {
    actions.push(makeAction({
      id: 'upload-missing-requirements',
      type: 'requirements',
      title: `Upload ${formatCount(missingRequirements.length, 'missing requirement')}`,
      description: missingRequirements.map(({ label }) => label).join(', '),
      priority: 'high',
      route: 'requirements',
    }));
  }
  if (!requirementSnapshot.physicalFolderSubmitted) {
    actions.push(makeAction({
      id: 'submit-physical-folder',
      type: 'physical_requirement',
      title: 'Submit your white long folder',
      description: 'Bring the physical folder with fastener directly to the Community Affairs Office.',
      priority: 'normal',
      route: 'requirements',
    }));
  }

  if (actions.length) {
    return {
      state: 'action_required',
      headline: 'Your requirements need attention',
      description: 'Complete the items below so your record can proceed to payroll-list preparation.',
      actions,
      timeline,
    };
  }

  if (pendingRequirements.length) {
    return {
      state: 'waiting',
      headline: 'Your documents are being reviewed',
      description: `${formatCount(pendingRequirements.length, 'uploaded document')} awaiting moderator review.`,
      actions: [makeAction({
        id: 'wait-document-review',
        type: 'waiting',
        title: 'No upload is required right now',
        description: 'If a moderator returns a file, its reason and replacement option will appear in your requirements list.',
      })],
      timeline,
    };
  }

  if (!includedInPayrollList) {
    return {
      state: 'waiting',
      headline: 'Your requirements are complete',
      description: 'Your record is ready for CAO to include in the official payroll list.',
      actions: [makeAction({
        id: 'wait-payroll-list',
        type: 'waiting',
        title: 'Wait for payroll-list generation',
        description: 'No further scholar action is required while CAO prepares the list.',
      })],
      timeline,
    };
  }

  return {
    state: 'complete',
    headline: 'You are included in the payroll list',
    description: 'Payroll-list generation is the final stage recorded by this system for the academic period.',
    actions: [makeAction({
      id: 'payroll-list-generated',
      type: 'complete',
      title: 'No pending actions',
      description: 'Contact CAO directly for matters that occur after payroll-list generation.',
    })],
    timeline,
  };
};

module.exports = { buildApplicantGuidance };
