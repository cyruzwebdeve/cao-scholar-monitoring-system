export const PAYOUT_CLAIM_NOTICE = 'Scholars have one week (7 days) only to claim their payout. Follow the claiming dates and instructions announced by CAO.';
export const scheduleTime = value => value ? new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }) : '';
export const scheduleLocalInput = value => value ? new Date(new Date(value).getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 16) : '';
export const scheduleIso = value => value ? new Date(`${value}:00+08:00`).toISOString() : null;
export const filterScheduleScholars = (scholars, municipality, school, query) => scholars.filter(row => (!municipality || row.municipality === municipality) && (!school || row.school === school) && (!query.trim() || row.name.toLowerCase().includes(query.trim().toLowerCase())));
