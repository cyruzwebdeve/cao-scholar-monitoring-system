export const toManilaDateTimeInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isFinite(+date) ? new Date(+date + 8 * 60 * 60 * 1000).toISOString().slice(0, 16) : '';
};
export const fromManilaDateTimeInput = (value) => {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Enter a valid Philippine Standard Time date.');
  const date = new Date(`${value}:00+08:00`);
  if (!Number.isFinite(+date)) throw new Error('Enter a valid Philippine Standard Time date.');
  return date.toISOString();
};
export const announcementDisplayStatus = (notice, now = Date.now()) => notice.status === 'published' && notice.expiresAt && +new Date(notice.expiresAt) <= now ? 'expired' : notice.status;
