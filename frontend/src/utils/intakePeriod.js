export const intakeYearQuery = year => year ? `?schoolYear=${encodeURIComponent(year)}` : '';

export const applicationIntakeScope = period => {
  const match = /^(\d{4})-(\d{4})$/.exec(period?.schoolYear || '');
  if (!period || !Number.isSafeInteger(period.id) || period.id <= 0 || !match || Number(match[2]) !== Number(match[1]) + 1) {
    throw new Error('Load the application intake year before submitting.');
  }
  return { academicPeriodId: period.id, academicYear: period.schoolYear };
};

export const intakeScopeLabel = (scope, period) => scope?.isCurrentIntake
  ? `${scope.schoolYear || period?.schoolYear} · Current intake`
  : scope?.schoolYear === 'all' ? 'All intake years · History'
    : scope?.schoolYear ? `${scope.schoolYear} · Historical intake` : 'Intake year unavailable';

export const createIntakeRequestGuard = () => {
  let revision = 0, controller;
  return {
    cancel: () => { revision += 1; controller?.abort(); },
    run: async (request, { onSuccess, onError, onLoading } = {}) => {
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal, current = ++revision;
      const valid = () => current === revision && !signal.aborted;
      onLoading?.(true);
      try {
        const value = await request(signal);
        if (valid()) { onSuccess?.(value); return value; }
      } catch (error) { if (valid()) onError?.(error); }
      finally { if (valid()) onLoading?.(false); }
    },
  };
};
