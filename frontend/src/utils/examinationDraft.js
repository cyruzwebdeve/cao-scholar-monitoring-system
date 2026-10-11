const PREFIX = 'pgceap:exam-draft:v1:';
const emptyAnswers = () => ({ multipleChoice: {}, identification: {}, trueFalse: {} });
export const draftContext = (attempt, examId) => {
  const context = { applicantId: attempt?.applicantId, examId, id: attempt?.id, configurationId: attempt?.configurationId, startedAt: attempt?.startedAt, deadlineAt: attempt?.deadlineAt };
  if (![context.applicantId, context.examId, context.id].every((id) => Number.isSafeInteger(id) && id > 0)
    || !Number.isSafeInteger(context.configurationId) || context.configurationId < 0
    || !Number.isFinite(Date.parse(context.startedAt)) || !Number.isFinite(Date.parse(context.deadlineAt))) {
    throw new Error('Answer recovery is unavailable for this attempt. Keep this page open until you submit.');
  }
  return context;
};
export const draftKey = (context) => `${PREFIX}${context.applicantId}:${context.examId}:${context.id}:${context.configurationId}`;
const sanitizeAnswers = (answers, questions) => {
  const safe = emptyAnswers();
  for (const question of questions) {
    const id = question.id;
    if (question.type === 'multiple-choice') {
      const answer = answers?.multipleChoice?.[id];
      if (Number.isInteger(answer) && answer >= 0 && answer < question.options.length) safe.multipleChoice[id] = answer;
    } else if (question.type === 'identification') {
      const answer = answers?.identification?.[id];
      if (typeof answer === 'string') safe.identification[id] = answer.slice(0, 500);
    } else if (question.type === 'true-false') {
      const answer = answers?.trueFalse?.[id];
      if (['TRUE', 'FALSE'].includes(answer)) safe.trueFalse[id] = answer;
    }
  }
  return safe;
};
export const removeDraft = (context, storage = localStorage) => storage.removeItem(draftKey(context));
export const readDraft = (context, questions, storage = localStorage, now = Date.now()) => {
  const key = draftKey(context);
  const raw = storage.getItem(key);
  if (!raw) return null;
  let record;
  try { record = JSON.parse(raw); } catch { storage.removeItem(key); return null; }
  if (record?.schema !== 1 || Object.keys(context).some((field) => record.context?.[field] !== context[field]) || Date.parse(context.deadlineAt) <= now) {
    storage.removeItem(key); return null;
  }
  return sanitizeAnswers(record.answers, questions);
};
export const saveDraftPatch = (context, patch, questions, storage = localStorage, now = Date.now()) => {
  if (Date.parse(context.deadlineAt) <= now) { removeDraft(context, storage); return false; }
  const current = readDraft(context, questions, storage, now) || emptyAnswers();
  const next = Object.fromEntries(Object.keys(current).map((type) => [type, { ...current[type], ...patch[type] }]));
  storage.setItem(draftKey(context), JSON.stringify({ schema: 1, context, answers: sanitizeAnswers(next, questions) }));
  return true;
};
export const clearExaminationDrafts = (storage = localStorage, { now = Date.now(), applicantId } = {}) => {
  const keys = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key?.startsWith(PREFIX)) keys.push(key);
  }
  for (const key of keys) {
    if (applicantId === undefined && now === null) { storage.removeItem(key); continue; }
    let record;
    try { record = JSON.parse(storage.getItem(key)); } catch { /* Corrupt records are removed. */ }
    if (!record?.context || !Number.isFinite(Date.parse(record.context.deadlineAt)) || Date.parse(record.context.deadlineAt) <= now || (applicantId !== undefined && record.context.applicantId !== applicantId)) storage.removeItem(key);
  }
};
