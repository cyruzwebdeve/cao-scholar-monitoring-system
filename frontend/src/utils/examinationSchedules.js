const validDate = value => Boolean(value) && !Number.isNaN(new Date(value).getTime());
const dateLabel = value => validDate(value)
  ? new Date(value).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';

export const examinationThumbnailKey = schoolYear => `examVenueThumbnails:${schoolYear}`;

export const hydrateExaminationSchedules = (templates, savedSchedules = [], thumbnails = {}) => {
  const savedByMunicipality = new Map(savedSchedules.map(exam => [exam.municipality, exam]));
  return templates.map(template => {
    const saved = savedByMunicipality.get(template.municipality);
    const date = dateLabel(saved?.date);
    return { ...template, id: saved?.id, venue: saved?.venue || template.venue,
      date, endDate: dateLabel(saved?.endDate) || date, thumbnail: thumbnails[template.municipality] || '' };
  });
};

export const examinationSchedulePayload = state => {
  if (!state.ready || !state.activePeriod) throw new Error('Load an active academic year before editing schedules.');
  const active = new Set(state.activeExamMunicipalities);
  if (state.examinations.some(exam => active.has(exam.municipality) && !validDate(exam.date))) {
    throw new Error('Set an examination date before activating a venue.');
  }
  return { academicPeriodId: state.activePeriod.id, academicYear: state.activePeriod.schoolYear,
    examinations: state.examinations.filter(exam => validDate(exam.date)).map(exam => ({
      municipality: exam.municipality, venue: exam.venue, date: exam.date,
      endDate: exam.endDate || exam.date, isActive: active.has(exam.municipality),
    })) };
};

// The server owns schedule data. Only explicit edits enter the save queue;
// response generations and serialized writes keep older requests out of a new year.
export const createExaminationScheduleEditor = ({ templates, loadSchedules, saveSchedules,
  readThumbnails = () => ({}), writeThumbnails = () => {}, onSaved = () => {},
  setTimer = setTimeout, clearTimer = clearTimeout, saveDelay = 450 }) => {
  let state = { examinations: hydrateExaminationSchedules(templates), activeExamMunicipalities: [],
    activePeriod: null, ready: false, loading: false, saving: false, error: '', scopeVersion: 0, saveVersion: 0 };
  const listeners = new Set();
  let epoch = 0, readRevision = 0, editRevision = 0, savedRevision = 0;
  let timer, readController, saveController, savePromise;
  let stopped = false;
  const publish = patch => { state = { ...state, ...patch }; listeners.forEach(listener => listener()); };
  const cancelTimer = () => { clearTimer(timer); timer = undefined; };
  const isDirty = () => editRevision !== savedRevision;

  const load = async ({ force = false, notice = '' } = {}) => {
    if (stopped) return;
    if (force) {
      epoch += 1;
      cancelTimer();
      saveController?.abort();
      editRevision = savedRevision = 0;
      publish({ ready: false, saving: false, activePeriod: null,
        examinations: hydrateExaminationSchedules(templates), activeExamMunicipalities: [],
        scopeVersion: epoch, error: notice });
    }
    readController?.abort();
    readController = new AbortController();
    const signal = readController.signal;
    const requestRevision = ++readRevision;
    const requestEpoch = epoch, editsAtStart = editRevision;
    const preserveAtStart = isDirty() || state.saving;
    publish({ loading: true });
    try {
      const payload = await loadSchedules(signal);
      if (stopped || signal.aborted || requestRevision !== readRevision || requestEpoch !== epoch) return;
      const period = payload?.activePeriod;
      if (period && (!Number.isInteger(period.id) || !period.schoolYear || period.isActive !== true)) {
        throw new Error('The examination academic year could not be verified. Reload to retry.');
      }
      const sameScope = period?.id === state.activePeriod?.id && period?.schoolYear === state.activePeriod?.schoolYear;
      if (sameScope && (preserveAtStart || isDirty() || state.saving || editsAtStart !== editRevision)) {
        publish({ loading: false, ready: Boolean(period), error: notice || (state.ready ? state.error : '') });
        return;
      }
      if (!sameScope) {
        epoch += 1;
        cancelTimer();
        saveController?.abort();
      }
      editRevision = savedRevision = 0;
      const schedules = period && Array.isArray(payload.examinations) ? payload.examinations : [];
      let thumbnails = {};
      try { thumbnails = period ? readThumbnails(period.schoolYear) || {} : {}; } catch { /* Optional local photos. */ }
      publish({ activePeriod: period || null, examinations: hydrateExaminationSchedules(templates, schedules, thumbnails),
        activeExamMunicipalities: schedules.filter(exam => exam.isActive && validDate(exam.date)).map(exam => exam.municipality),
        ready: Boolean(period), loading: false, saving: false, scopeVersion: epoch,
        error: notice || (period ? '' : 'No active academic year is configured. Choose one in Settings to manage examinations.') });
    } catch (error) {
      if (stopped || signal.aborted || requestRevision !== readRevision || requestEpoch !== epoch) return;
      publish({ loading: false, ready: false, error: error.message || 'Unable to load examination schedules. Reload to retry.' });
    }
  };

  const flushSave = () => {
    cancelTimer();
    if (stopped || !state.ready || !isDirty()) return Promise.resolve();
    if (savePromise) return savePromise;
    const saveEpoch = epoch;
    const run = async () => {
      while (!stopped && saveEpoch === epoch && state.ready && isDirty()) {
        const revision = editRevision;
        let payload;
        try {
          payload = examinationSchedulePayload(state);
          if (!payload.examinations.length) throw new Error('Choose an examination date to save this year’s schedule.');
        } catch (error) { publish({ error: error.message, saving: false }); return; }
        saveController = new AbortController();
        const signal = saveController.signal;
        publish({ saving: true, error: '' });
        try {
          const saved = await saveSchedules(payload, signal);
          if (stopped || signal.aborted || saveEpoch !== epoch) return;
          if (saved?.activePeriod?.id !== payload.academicPeriodId || saved?.activePeriod?.schoolYear !== payload.academicYear) {
            throw Object.assign(new Error('The academic year changed. Current schedules have been reloaded; review your changes.'), { status: 409 });
          }
          savedRevision = revision;
          const ids = new Map((saved.examinations || []).map(exam => [exam.municipality, exam.id]));
          publish({ examinations: state.examinations.map(exam => ({ ...exam, id: ids.get(exam.municipality) || exam.id })),
            saveVersion: state.saveVersion + 1 });
          onSaved();
        } catch (error) {
          if (stopped || signal.aborted || saveEpoch !== epoch) return;
          if (error.status === 409) await load({ force: true, notice: `${error.message} Review the current year before editing again.` });
          else publish({ saving: false, error: error.message || 'Unable to save schedules. Retry saving your changes.' });
          return;
        }
      }
      if (!stopped && saveEpoch === epoch) publish({ saving: false });
    };
    savePromise = run().finally(() => {
      savePromise = undefined;
      if (!stopped && saveEpoch !== epoch && state.ready && isDirty()) {
        cancelTimer();
        timer = setTimer(flushSave, saveDelay);
      }
    });
    return savePromise;
  };
  const markEdited = () => {
    editRevision += 1;
    cancelTimer();
    timer = setTimer(flushSave, saveDelay);
  };

  return {
    getState: () => state,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    load, flushSave,
    start: () => { stopped = false; },
    stop: () => { stopped = true; epoch += 1; readRevision += 1; cancelTimer(); readController?.abort(); saveController?.abort(); },
    updateExaminations: (updater, { photoOnly = false, scopeVersion = state.scopeVersion } = {}) => {
      if (stopped || !state.ready || scopeVersion !== state.scopeVersion) return;
      const examinations = updater(state.examinations);
      publish({ examinations });
      if (photoOnly) {
        try { writeThumbnails(state.activePeriod.schoolYear, Object.fromEntries(examinations.map(exam => [exam.municipality, exam.thumbnail || '']))); } catch { /* Preview remains available. */ }
      } else markEdited();
    },
    updateActivation: (updater, { scopeVersion = state.scopeVersion } = {}) => {
      if (stopped || !state.ready || scopeVersion !== state.scopeVersion) return;
      const activeExamMunicipalities = updater(state.activeExamMunicipalities);
      try { examinationSchedulePayload({ ...state, activeExamMunicipalities }); }
      catch (error) { publish({ error: error.message }); return; }
      publish({ activeExamMunicipalities });
      markEdited();
    },
  };
};
