const { randomUUID, createHash } = require('node:crypto');
const INITIAL_KEYS = Object.freeze(['tax_exemption', 'indigency', 'valid_id', 'grades', 'report_card', 'registration_form', 'tuition_receipt']);
const CONTINUING_KEYS = Object.freeze(['grades', 'registration_form', 'tuition_receipt']);
const WAVES = new Set(['initial', 'continuing']);
const clone = (value) => JSON.parse(JSON.stringify(value || {}));
const conflict = (message = 'This document changed while you were working. Refresh and try again.') => Object.assign(new Error(message), { statusCode: 409 });

const initializeWaves = (initialDocs, legacyPeriodId) => {
  const docs = clone(initialDocs);
  if (!docs.requirementSets) {
    const requirements = Object.fromEntries(Object.entries(docs.requirements || {}).filter(([key]) => INITIAL_KEYS.includes(key)));
    docs.requirementSets = {};
    if (Object.keys(requirements).length) docs.requirementSets[`${legacyPeriodId}:initial`] = {
      academicPeriodId: legacyPeriodId, wave: 'initial', legacy: true, requirements, history: [],
    };
  }
  Object.values(docs.requirementSets).forEach((set) => Object.values(set.requirements || {}).forEach((file) => {
    file.versionId ||= `legacy-${createHash('sha256').update(JSON.stringify([file.fileName, file.fileUrl, file.fileData, file.uploadedAt])).digest('hex').slice(0, 24)}`;
    file.revision ||= 0;
  }));
  docs.initialRequirementPeriodId ||= legacyPeriodId;
  docs.requirementWaves ||= {};
  return docs;
};
const getWaveSet = (initialDocs, periodId, wave, legacyPeriodId = periodId) => {
  if (!WAVES.has(wave)) return null;
  const docs = initializeWaves(initialDocs, legacyPeriodId);
  return docs.requirementSets[`${periodId}:${wave}`] || { academicPeriodId: periodId, wave, requirements: {}, history: [] };
};
// Initial intake belongs to the original period. Later continuing periods reference
// those originals instead of asking CAO to upload the initial set again.
const getInitialRequirements = (initialDocs, periodId, legacyPeriodId = periodId) => {
  const docs = initializeWaves(initialDocs, legacyPeriodId);
  const originalPeriodId = docs.initialRequirementPeriodId;
  const original = getWaveSet(docs, originalPeriodId, 'initial', legacyPeriodId);
  const current = getWaveSet(docs, periodId, 'initial', legacyPeriodId);
  return { requirements: { ...original.requirements, ...current.requirements }, originalPeriodId, original, current };
};
const continuingIsOpen = (docs, periodId) => Boolean(docs?.requirementWaves?.[periodId]?.continuingOpenedAt);
const getEffectiveRequirements = (docs, periodId, legacyPeriodId = periodId) => {
  const initial = getInitialRequirements(docs, periodId, legacyPeriodId).requirements;
  if (!continuingIsOpen(docs, periodId)) return { requirements: initial };
  const continuing = getWaveSet(docs, periodId, 'continuing', legacyPeriodId).requirements;
  return { requirements: { ...Object.fromEntries(Object.entries(initial).filter(([key]) => !CONTINUING_KEYS.includes(key))), ...continuing } };
};
const getScopedDocument = (docs, periodId, wave, key, versionId, legacyPeriodId = periodId) => {
  const set = getWaveSet(docs, periodId, wave, legacyPeriodId);
  const current = set?.requirements[key];
  if (!versionId || current?.versionId === versionId) return current;
  return set?.history?.find((item) => item.requirementKey === key && item.versionId === versionId);
};
const saveWaveDocument = (docs, { periodId, wave, key, file, actorId, actorRole }) => {
  const setKey = `${periodId}:${wave}`;
  const set = docs.requirementSets[setKey] ||= { academicPeriodId: periodId, wave, requirements: {}, history: [] };
  const previous = set.requirements[key];
  if (previous) (set.history ||= []).push({ ...previous, versionId: previous.versionId || randomUUID(), requirementKey: key, archivedAt: new Date().toISOString() });
  const uploadedAt = new Date().toISOString();
  set.requirements[key] = {
    ...file, versionId: randomUUID(), revision: 1, uploadedAt, uploadedBy: actorId, uploadedByRole: actorRole,
    status: wave === 'initial' ? 'Approved' : 'Pending',
    ...(wave === 'initial' ? { reviewedAt: uploadedAt, reviewedBy: actorId, reviewNotes: 'Initial document checked and uploaded by CAO staff.' } : {}),
    reviewHistory: [],
  };
  return set.requirements[key];
};

// Compare the complete JSON snapshot inside a transaction. A competing upload/review
// retries against fresh data; an exact-file review can reject a replaced version.
const mutateRequirementWaves = async (prisma, applicationId, legacyPeriodId, mutate) => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const application = await tx.application_submissions.findUnique({ where: { id: applicationId } });
        if (!application) throw Object.assign(new Error('Application record not found.'), { statusCode: 404 });
        const docs = initializeWaves(application.initial_docs, legacyPeriodId);
        const result = await mutate(docs, tx, application);
        const updated = await tx.application_submissions.updateMany({
          where: { id: applicationId, initial_docs: { equals: application.initial_docs } },
          data: { initial_docs: docs },
        });
        if (updated.count !== 1) throw conflict();
        return { ...result, application: { ...application, initial_docs: docs } };
      });
    } catch (error) {
      if ((error.code === 'P2034' || error.statusCode === 409) && !error.exactFileConflict && attempt < 3) continue;
      throw error;
    }
  }
};
module.exports = { INITIAL_KEYS, CONTINUING_KEYS, WAVES, conflict, initializeWaves, getWaveSet, getInitialRequirements, getEffectiveRequirements, continuingIsOpen, getScopedDocument, saveWaveDocument, mutateRequirementWaves };
