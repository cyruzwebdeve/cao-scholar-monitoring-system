export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3601/api';

export const authHeaders = (token) => {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
};
