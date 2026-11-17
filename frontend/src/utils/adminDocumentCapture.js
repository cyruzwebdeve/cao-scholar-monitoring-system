export const MAX_CAPTURE_DRAFT_BYTES = 32 * 1024 * 1024;

export const createCaptureDraft = (id, number) => ({
  id, label: `Document ${number}`, requirementKey: '', pages: [],
});

export const captureDraftHasContent = draft => Boolean(draft?.pages?.length
  || (draft?.file?.fileName && draft?.file?.fileData));

export const captureDraftBytes = drafts => Object.values(drafts || {}).reduce((total, draft) => total
  + (draft.pages || []).reduce((bytes, page) => bytes + page.length, 0)
  + (draft.file?.fileData?.length || 0), 0);

export const updateCaptureDraftContent = (drafts, id, content) => {
  if (!drafts[id]) throw new Error('This scanned document is no longer available. Start a new document.');
  const draft = { ...drafts[id], ...content };
  if (!captureDraftHasContent(draft)) draft.requirementKey = '';
  const next = { ...drafts, [id]: draft };
  if (captureDraftBytes(next) > MAX_CAPTURE_DRAFT_BYTES) {
    throw new Error('The scanned documents are too large for this session. Upload a document or remove an unused draft before adding more.');
  }
  return next;
};

const assertAvailableRequirement = (drafts, id, requirementKey, requirements, saved) => {
  if (!requirements.some(document => document.requirementKey === requirementKey)) {
    throw new Error('Choose a requirement from this initial checklist.');
  }
  if (saved[requirementKey]) throw new Error('This requirement was already uploaded. Close and reopen the scanner to upload a correction.');
  if (Object.entries(drafts).some(([otherId, draft]) => otherId !== id && draft.requirementKey === requirementKey)) {
    throw new Error('Another scanned document is assigned to this requirement. Change its assignment first.');
  }
};

export const assignCaptureDraft = (drafts, id, requirementKey, requirements, saved = {}) => {
  const draft = drafts[id];
  if (!draft) throw new Error('This scanned document is no longer available.');
  if (requirementKey) {
    if (!captureDraftHasContent(draft)) throw new Error('Scan or choose this document before assigning its requirement.');
    assertAvailableRequirement(drafts, id, requirementKey, requirements, saved);
  }
  return { ...drafts, [id]: { ...draft, requirementKey } };
};

// A requirement row may replace its selected document without losing either
// scan. Validate the replacement before releasing the previous row binding.
export const assignCaptureRequirement = (drafts, requirementKey, draftId, requirements, saved = {}) => {
  if (!requirements.some(document => document.requirementKey === requirementKey)) {
    throw new Error('Choose a requirement from this initial checklist.');
  }
  if (saved[requirementKey]) throw new Error('This requirement was already uploaded. Close and reopen the scanner to upload a correction.');
  if (draftId !== '') {
    const draft = drafts[draftId];
    if (!draft) throw new Error('This scanned document is no longer available.');
    if (!captureDraftHasContent(draft)) throw new Error('Scan or choose this document before assigning its requirement.');
    if (draft.requirementKey && draft.requirementKey !== requirementKey) {
      throw new Error('This scanned document is assigned to another requirement. Clear that assignment first.');
    }
  }
  const next = Object.fromEntries(Object.entries(drafts).map(([id, draft]) => [id,
    draft.requirementKey === requirementKey && id !== draftId ? { ...draft, requirementKey: '' } : draft,
  ]));
  return draftId === '' ? next : assignCaptureDraft(next, draftId, requirementKey, requirements, saved);
};

export const getCaptureUploadTarget = (drafts, id, requirements, saved = {}) => {
  const draft = drafts[id];
  if (!captureDraftHasContent(draft)) throw new Error('Scan or choose this document before uploading.');
  if (!draft.requirementKey) throw new Error('Assign this document to a requirement before uploading.');
  assertAvailableRequirement(drafts, id, draft.requirementKey, requirements, saved);
  return draft.requirementKey;
};

// Validate the whole pending selection before a caller starts any upload.
// Partial checklists are allowed; existing uploads and unassigned scans stay out.
export const getCaptureUploadBatch = (drafts, requirements, saved = {}) => {
  const pending = Object.entries(drafts)
    .filter(([, draft]) => draft.requirementKey && !saved[draft.requirementKey])
    .map(([draftId]) => ({ draftId, requirementKey: getCaptureUploadTarget(drafts, draftId, requirements, saved) }));
  const order = new Map(requirements.map((document, index) => [document.requirementKey, index]));
  return pending.sort((left, right) => order.get(left.requirementKey) - order.get(right.requirementKey));
};

export const captureDraftUploadReady = (drafts, id, requirements, saved = {}) => {
  try { getCaptureUploadTarget(drafts, id, requirements, saved); return true; }
  catch { return false; }
};
