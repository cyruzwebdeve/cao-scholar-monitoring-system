import { API_BASE, authHeaders } from '../services/api.js';
export const attendanceLabels = {
  not_marked: 'Not marked',
  present: 'Present',
  absent: 'Absent',
};
export const receiptLabel = (receipt) =>
  receipt?.status === 'received'
    ? 'Received — scholar-confirmed'
    : 'Not confirmed';
export const localReceiptDate = (value = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
export async function participationRequest(token, path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  const body = await response.json();
  if (!response.ok)
    throw Object.assign(
      new Error(body.message || 'Unable to load or save this record.'),
      { status: response.status }
    );
  return body;
}
