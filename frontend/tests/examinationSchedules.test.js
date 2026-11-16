import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createExaminationScheduleEditor,
  examinationSchedulePayload,
  examinationThumbnailKey,
  hydrateExaminationSchedules,
} from '../src/utils/examinationSchedules.js';

const templates = [
  { municipality: 'North', venue: 'North default venue', date: '', endDate: '' },
  { municipality: 'South', venue: 'South default venue', date: '', endDate: '' },
];
const periodA = { id: 1, schoolYear: '2026-2027', semester: 'First Semester', isActive: true };
const periodB = { id: 2, schoolYear: '2027-2028', semester: 'First Semester', isActive: true };
const northSchedule = { id: 10, municipality: 'North', venue: 'Saved North venue', date: '2026-07-12T12:00:00.000Z', endDate: '2026-07-13T12:00:00.000Z', isActive: true };
const serverPayload = (activePeriod = periodA, examinations = [northSchedule]) => ({ activePeriod, examinations });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

const manualTimers = () => {
  let nextId = 0;
  const pending = new Map();
  return {
    setTimer: callback => { const id = ++nextId; pending.set(id, callback); return id; },
    clearTimer: id => pending.delete(id),
    run: async () => {
      const callbacks = [...pending.values()];
      pending.clear();
      await Promise.all(callbacks.map(callback => callback()));
    },
    size: () => pending.size,
  };
};

const fixture = (options = {}) => {
  let currentPayload = options.payload || serverPayload();
  const loads = [], saves = [], photoReads = [], photoWrites = [], notifications = [];
  const photos = new Map(options.photos || []);
  const timers = manualTimers();
  const editor = createExaminationScheduleEditor({
    templates,
    ...timers,
    loadSchedules: async signal => {
      loads.push({ signal });
      return options.load ? options.load(signal, loads.length) : currentPayload;
    },
    saveSchedules: async (payload, signal) => {
      saves.push({ payload, signal });
      if (options.save) return options.save(payload, signal, saves.length);
      return { activePeriod: { id: payload.academicPeriodId, schoolYear: payload.academicYear },
        examinations: payload.examinations.map((exam, index) => ({ ...exam, id: 100 + index })) };
    },
    readThumbnails: schoolYear => { photoReads.push(schoolYear); return photos.get(schoolYear); },
    writeThumbnails: (schoolYear, value) => { photoWrites.push({ schoolYear, value }); photos.set(schoolYear, value); },
    onSaved: () => notifications.push(editor.getState().activePeriod.schoolYear),
  });
  return { editor, timers, loads, saves, photoReads, photoWrites, notifications,
    setPayload: value => { currentPayload = value; } };
};
const editNorthVenue = (editor, venue) => editor.updateExaminations(exams => exams.map(exam => exam.municipality === 'North' ? { ...exam, venue } : exam));

test('opening an empty academic year never saves default venues, dates, or activation', async () => {
  const { editor, saves, timers } = fixture({ payload: serverPayload(periodA, []) });
  await editor.load({ force: true });
  assert.equal(editor.getState().ready, true);
  assert.ok(editor.getState().examinations.every(exam => !exam.date && !exam.endDate && !exam.id));
  assert.deepEqual(editor.getState().activeExamMunicipalities, []);
  assert.equal(timers.size(), 0);
  await timers.run();
  await editor.flushSave();
  assert.equal(saves.length, 0);
});

test('changing from a saved year to an empty year clears prior schedules and does not PUT them', async () => {
  const { editor, saves, setPayload, timers } = fixture();
  await editor.load({ force: true });
  assert.equal(editor.getState().examinations[0].id, northSchedule.id);
  setPayload(serverPayload(periodB, []));
  await editor.load({ force: true });
  assert.equal(editor.getState().activePeriod.schoolYear, periodB.schoolYear);
  assert.ok(editor.getState().examinations.every(exam => !exam.date && !exam.id));
  assert.deepEqual(editor.getState().activeExamMunicipalities, []);
  await timers.run();
  await editor.flushSave();
  assert.equal(saves.length, 0);
});

test('partial API schedules leave missing or invalid dates blank and inactive', async () => {
  const { editor } = fixture({ payload: serverPayload(periodA, [northSchedule,
    { id: 11, municipality: 'South', venue: 'South venue', date: '', isActive: true }]) });
  await editor.load();
  const [north, south] = editor.getState().examinations;
  assert.equal(north.venue, northSchedule.venue);
  assert.ok(north.date && north.endDate);
  assert.equal(south.date, '');
  assert.equal(south.endDate, '');
  assert.deepEqual(editor.getState().activeExamMunicipalities, ['North']);
  const missing = hydrateExaminationSchedules(templates, [northSchedule]);
  assert.equal(missing[1].venue, templates[1].venue);
  assert.equal(missing[1].date, '');
});

test('venue photos are scoped by school year and never trigger a schedule save', async () => {
  const photos = [[periodA.schoolYear, { North: 'photo-A' }], [periodB.schoolYear, { North: 'photo-B' }]];
  const { editor, saves, setPayload, photoReads, photoWrites, timers } = fixture({ photos });
  assert.notEqual(examinationThumbnailKey(periodA.schoolYear), examinationThumbnailKey(periodB.schoolYear));
  await editor.load();
  assert.equal(editor.getState().examinations[0].thumbnail, 'photo-A');
  editor.updateExaminations(exams => exams.map(exam => ({ ...exam, thumbnail: 'updated-A' })), { photoOnly: true });
  assert.equal(photoWrites[0].schoolYear, periodA.schoolYear);
  assert.equal(timers.size(), 0);
  await editor.flushSave();
  setPayload(serverPayload(periodB, []));
  await editor.load({ force: true });
  assert.equal(editor.getState().examinations[0].thumbnail, 'photo-B');
  assert.deepEqual(photoReads, [periodA.schoolYear, periodB.schoolYear]);
  assert.equal(saves.length, 0);
});

test('late photo callbacks from another academic year cannot update state or cache', async () => {
  const { editor, setPayload, photoWrites } = fixture();
  await editor.load();
  const oldScope = editor.getState().scopeVersion;
  setPayload(serverPayload(periodB, []));
  await editor.load({ force: true });
  editor.updateExaminations(exams => exams.map(exam => ({ ...exam, thumbnail: 'late-A' })), { photoOnly: true, scopeVersion: oldScope });
  assert.ok(editor.getState().examinations.every(exam => !exam.thumbnail));
  assert.equal(photoWrites.length, 0);
});

test('late schedule and activation callbacks cannot edit the newly loaded academic year', async () => {
  const { editor, setPayload, saves, timers } = fixture();
  await editor.load();
  const oldScope = editor.getState().scopeVersion;
  const delayedEdit = () => editor.updateExaminations(exams => exams.map(exam => ({ ...exam, venue: 'Late old-year venue' })), { scopeVersion: oldScope });
  const delayedActivation = () => editor.updateActivation(() => ['North'], { scopeVersion: oldScope });
  setPayload(serverPayload(periodB, [{ ...northSchedule, id: 20, venue: 'New-year venue', date: '2027-07-12T12:00:00.000Z', isActive: false }]));
  await editor.load({ force: true });
  delayedEdit();
  delayedActivation();
  assert.equal(editor.getState().examinations[0].venue, 'New-year venue');
  assert.deepEqual(editor.getState().activeExamMunicipalities, []);
  assert.equal(timers.size(), 0);
  await editor.flushSave();
  assert.equal(saves.length, 0);
});

test('saving a fresh schedule publishes its new ID and save revision to subscribers', async () => {
  const { editor, saves } = fixture({ payload: serverPayload(periodA, []) });
  const observations = [];
  const unsubscribe = editor.subscribe(() => {
    const state = editor.getState();
    observations.push({ saveVersion: state.saveVersion, id: state.examinations[0].id });
  });
  await editor.load();
  assert.equal(editor.getState().saveVersion, 0);
  editor.updateExaminations(exams => exams.map(exam => exam.municipality === 'North'
    ? { ...exam, date: 'July 12, 2026', endDate: 'July 13, 2026' } : exam));
  assert.equal(editor.getState().saveVersion, 0);
  await editor.flushSave();
  assert.equal(saves.length, 1);
  assert.equal(editor.getState().saveVersion, 1);
  assert.equal(editor.getState().examinations[0].id, 100);
  assert.ok(observations.some(snapshot => snapshot.saveVersion === 1 && snapshot.id === 100));
  editor.updateExaminations(exams => exams.map(exam => ({ ...exam, thumbnail: 'Local photo' })), { photoOnly: true });
  assert.equal(editor.getState().saveVersion, 1);
  editNorthVenue(editor, 'Second schedule change');
  await editor.flushSave();
  assert.equal(editor.getState().saveVersion, 2);
  assert.ok(observations.some(snapshot => snapshot.saveVersion === 2 && snapshot.id === 100));
  unsubscribe();
});

test('a schedule edit saves its verified period/year and omits unscheduled templates', async () => {
  const { editor, saves, notifications } = fixture();
  await editor.load();
  editNorthVenue(editor, 'Changed North venue');
  await editor.flushSave();
  assert.equal(saves.length, 1);
  assert.equal(saves[0].payload.academicPeriodId, periodA.id);
  assert.equal(saves[0].payload.academicYear, periodA.schoolYear);
  assert.deepEqual(saves[0].payload.examinations.map(exam => exam.municipality), ['North']);
  assert.equal(saves[0].payload.examinations[0].venue, 'Changed North venue');
  assert.equal(saves[0].payload.examinations[0].isActive, true);
  assert.equal(editor.getState().examinations[0].id, 100);
  assert.deepEqual(notifications, [periodA.schoolYear]);
  await editor.flushSave();
  assert.equal(saves.length, 1);
});

test('an undated venue cannot be activated or produce a fabricated saved date', async () => {
  const { editor, saves } = fixture({ payload: serverPayload(periodA, []) });
  await editor.load();
  editor.updateActivation(() => ['North']);
  assert.deepEqual(editor.getState().activeExamMunicipalities, []);
  assert.match(editor.getState().error, /date before activating/);
  await editor.flushSave();
  assert.equal(saves.length, 0);
  assert.throws(() => examinationSchedulePayload({ ...editor.getState(), activeExamMunicipalities: ['North'] }), /date before activating/);
});

test('no active period disables schedule, activation, and photo edits without writing', async () => {
  const { editor, saves, photoWrites } = fixture({ payload: serverPayload(null, []) });
  await editor.load();
  assert.equal(editor.getState().ready, false);
  assert.equal(editor.getState().activePeriod, null);
  editNorthVenue(editor, 'Forbidden edit');
  editor.updateActivation(() => ['North']);
  editor.updateExaminations(exams => exams.map(exam => ({ ...exam, thumbnail: 'Forbidden photo' })), { photoOnly: true });
  await editor.flushSave();
  assert.equal(editor.getState().examinations[0].venue, templates[0].venue);
  assert.deepEqual(editor.getState().activeExamMunicipalities, []);
  assert.equal(saves.length, 0);
  assert.equal(photoWrites.length, 0);
  assert.throws(() => examinationSchedulePayload(editor.getState()), /active academic year/);
});

test('debounced edits coalesce before sending a single save', async () => {
  const { editor, timers, saves } = fixture();
  await editor.load();
  editNorthVenue(editor, 'First edit');
  editNorthVenue(editor, 'Latest edit');
  assert.equal(timers.size(), 1);
  assert.equal(saves.length, 0);
  await timers.run();
  assert.equal(saves.length, 1);
  assert.equal(saves[0].payload.examinations[0].venue, 'Latest edit');
});

test('in-flight saves serialize later edits and send only the latest queued revision', async () => {
  const firstSave = deferred();
  let activeSaves = 0, peakSaves = 0;
  const { editor, saves } = fixture({ save: async (payload, signal, call) => {
    activeSaves += 1; peakSaves = Math.max(peakSaves, activeSaves);
    if (call === 1) await firstSave.promise;
    activeSaves -= 1;
    return { activePeriod: periodA, examinations: payload.examinations };
  } });
  await editor.load();
  editNorthVenue(editor, 'First save');
  const pending = editor.flushSave();
  assert.equal(saves.length, 1);
  editNorthVenue(editor, 'Intermediate edit');
  editNorthVenue(editor, 'Latest edit');
  void editor.flushSave();
  assert.equal(saves.length, 1);
  firstSave.resolve();
  await pending;
  assert.equal(saves.length, 2);
  assert.equal(saves[1].payload.examinations[0].venue, 'Latest edit');
  assert.equal(peakSaves, 1);
  assert.equal(editor.getState().saving, false);
  await editor.flushSave();
  assert.equal(saves.length, 2);
});

test('older GET responses are ignored even if the transport does not honor abort', async () => {
  const first = deferred(), second = deferred();
  const { editor, loads } = fixture({ load: (signal, call) => call === 1 ? first.promise : second.promise });
  const oldLoad = editor.load({ force: true });
  const newLoad = editor.load({ force: true });
  assert.equal(loads[0].signal.aborted, true);
  second.resolve(serverPayload(periodB, []));
  await newLoad;
  first.resolve(serverPayload());
  await oldLoad;
  assert.equal(editor.getState().activePeriod.schoolYear, periodB.schoolYear);
  assert.ok(editor.getState().examinations.every(exam => !exam.date));
});

test('older PUT responses cannot overwrite the new year or publish a saved notification', async () => {
  const firstSave = deferred();
  const { editor, setPayload, saves, notifications } = fixture({ save: () => firstSave.promise });
  await editor.load();
  editNorthVenue(editor, 'Old year draft');
  const pending = editor.flushSave();
  setPayload(serverPayload(periodB, []));
  await editor.load({ force: true });
  assert.equal(saves[0].signal.aborted, true);
  firstSave.resolve(serverPayload());
  await pending;
  assert.equal(editor.getState().activePeriod.schoolYear, periodB.schoolYear);
  assert.ok(editor.getState().examinations.every(exam => !exam.date && !exam.id));
  assert.deepEqual(notifications, []);
});

test('a stale-save conflict reloads the current year without resubmitting the old draft', async () => {
  const { editor, setPayload, saves, loads, timers } = fixture({ save: async () => {
    setPayload(serverPayload(periodB, []));
    throw Object.assign(new Error('The academic year changed.'), { status: 409 });
  } });
  await editor.load();
  editNorthVenue(editor, 'Old year draft');
  await editor.flushSave();
  assert.equal(loads.length, 2);
  assert.equal(saves.length, 1);
  assert.equal(editor.getState().activePeriod.schoolYear, periodB.schoolYear);
  assert.equal(editor.getState().examinations[0].venue, templates[0].venue);
  assert.match(editor.getState().error, /academic year changed/);
  await timers.run();
  await editor.flushSave();
  assert.equal(saves.length, 1);
});

test('an unexpected year in a successful save response is treated as a stale-save conflict', async () => {
  const { editor, setPayload, saves, notifications } = fixture({ save: async () => {
    setPayload(serverPayload(periodB, []));
    return serverPayload(periodB, [{ ...northSchedule, id: 999 }]);
  } });
  await editor.load();
  editNorthVenue(editor, 'Old year draft');
  await editor.flushSave();
  assert.equal(saves.length, 1);
  assert.equal(editor.getState().activePeriod.schoolYear, periodB.schoolYear);
  assert.ok(editor.getState().examinations.every(exam => !exam.id && !exam.date));
  assert.deepEqual(notifications, []);
  assert.match(editor.getState().error, /academic year changed/);
});

test('routine refresh preserves dirty same-period edits but loads a changed period', async () => {
  const { editor, setPayload, saves } = fixture();
  await editor.load();
  editNorthVenue(editor, 'Local unsaved draft');
  setPayload(serverPayload(periodA, [{ ...northSchedule, venue: 'Remote same-year venue' }]));
  await editor.load();
  assert.equal(editor.getState().examinations[0].venue, 'Local unsaved draft');
  assert.equal(editor.getState().ready, true);
  setPayload(serverPayload(periodB, []));
  await editor.load();
  assert.equal(editor.getState().activePeriod.schoolYear, periodB.schoolYear);
  assert.equal(editor.getState().examinations[0].venue, templates[0].venue);
  await editor.flushSave();
  assert.equal(saves.length, 0);
});

test('same-school-year semester changes retain saved schedules without creating duplicates', async () => {
  const { editor, setPayload, saves } = fixture();
  await editor.load();
  const secondSemester = { ...periodA, id: 3, semester: 'Second Semester' };
  setPayload(serverPayload(secondSemester));
  await editor.load();
  assert.equal(editor.getState().activePeriod.id, secondSemester.id);
  assert.equal(editor.getState().examinations[0].id, northSchedule.id);
  assert.deepEqual(editor.getState().activeExamMunicipalities, ['North']);
  await editor.flushSave();
  assert.equal(saves.length, 0);
});

test('new-year edits still save when an aborted old-year request has not yet settled', async () => {
  const oldSave = deferred();
  const { editor, setPayload, saves, timers } = fixture({ save: (payload, signal, call) => call === 1 ? oldSave.promise
    : Promise.resolve({ activePeriod: periodB, examinations: payload.examinations }) });
  await editor.load();
  editNorthVenue(editor, 'Old year draft');
  const oldPending = editor.flushSave();
  setPayload(serverPayload(periodB, [{ ...northSchedule, id: 20, date: '2027-07-12T12:00:00.000Z' }]));
  await editor.load({ force: true });
  editNorthVenue(editor, 'New year draft');
  const newPending = editor.flushSave();
  oldSave.resolve(serverPayload());
  await Promise.all([oldPending, newPending]);
  assert.equal(timers.size(), 1, 'new-year changes remain queued after the old request settles');
  await timers.run();
  assert.equal(saves.length, 2);
  assert.equal(saves[1].payload.academicYear, periodB.schoolYear);
  assert.equal(saves[1].payload.examinations[0].venue, 'New year draft');
  assert.equal(editor.getState().saving, false);
});

test('a successful same-period reload restores editing after a failed refresh with dirty data', async () => {
  let failRefresh = false;
  const { editor } = fixture({ load: async () => {
    if (failRefresh) throw new Error('Temporary load failure');
    return serverPayload();
  } });
  await editor.load();
  editNorthVenue(editor, 'Preserved draft');
  failRefresh = true;
  await editor.load();
  assert.equal(editor.getState().ready, false);
  failRefresh = false;
  await editor.load();
  assert.equal(editor.getState().ready, true);
  assert.equal(editor.getState().examinations[0].venue, 'Preserved draft');
  assert.equal(editor.getState().error, '');
});
