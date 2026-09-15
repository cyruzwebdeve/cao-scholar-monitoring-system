const resolveRequirementSubmission = (period, now = new Date()) => {
  const currentTime = now instanceof Date ? now : new Date(now);
  const parsedDeadline = period?.requirements_deadline
    ? new Date(period.requirements_deadline)
    : null;
  const deadline = parsedDeadline && !Number.isNaN(parsedDeadline.getTime())
    ? parsedDeadline
    : null;
  const isOpen = !deadline || currentTime <= deadline;

  return {
    isOpen,
    state: deadline ? isOpen ? 'open' : 'closed' : 'unscheduled',
    deadline: deadline?.toISOString() || null,
    serverTime: currentTime.toISOString(),
  };
};

module.exports = { resolveRequirementSubmission };
