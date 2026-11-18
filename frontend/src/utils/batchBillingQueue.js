import { canQueueForProcessing } from './processingVisibility.js';

const positiveQueueId = value => Number.isSafeInteger(value) && value > 0;

// The 100-row limit applies to each save, not to the accumulated queue.
export const validPreparedQueuePayload = payload => positiveQueueId(payload?.periodId)
  && Array.isArray(payload.applicantIds) && payload.applicantIds.length > 0
  && payload.applicantIds.every(positiveQueueId)
  && new Set(payload.applicantIds).size === payload.applicantIds.length;

export const mergePreparedQueueRequest = (requests, payload, actorId, requestId) => {
  if (!validPreparedQueuePayload(payload) || !positiveQueueId(actorId) || !positiveQueueId(requestId)) return requests;
  const previous = requests[payload.periodId];
  return { ...requests, [payload.periodId]: { periodId: payload.periodId, actorId, requestId,
    applicantIds: [...new Set([...(previous?.actorId === actorId ? previous.applicantIds : []), ...payload.applicantIds])],
  } };
};

export const consumePreparedQueueRequest = (requests, periodId, requestId) => {
  if (requests[periodId]?.requestId !== requestId) return requests;
  const next = { ...requests };
  delete next[periodId];
  return next;
};

export const currentPreparedQueueIds = (request, records, periodId, actorId) => {
  if (!validPreparedQueuePayload(request) || !positiveQueueId(actorId)
    || request.actorId !== actorId || request.periodId !== periodId) return [];
  const byId = new Map(records.map(record => [record.applicantId, record]));
  return request.applicantIds.filter(id => {
    const record = byId.get(id);
    return record?.academicPeriodId === periodId && record.grantPrepared === true
      && canQueueForProcessing(record, 'billing');
  });
};
