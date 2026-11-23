import { request } from './http.js';

const qs = (params) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const listNotes = (params) => request(`/api/notes${qs({ limit: 20, ...params })}`);
export const listMyNotes = (params) => request(`/api/my-notes${qs({ limit: 20, ...params })}`);
export const getNote = (id) => request(`/api/notes/${encodeURIComponent(id)}`);
export const createNote = (payload) => request('/api/notes', { method: 'POST', body: payload, timeoutMs: 30000 });
export const deleteNote = (id, deleteKey) =>
  request(`/api/notes/${encodeURIComponent(id)}`, { method: 'DELETE', headers: deleteKey ? { 'x-delete-key': deleteKey } : {} });
export const onThisDay = ({ month, day }) => request(`/api/on-this-day${qs({ month, day })}`);
export const photoUrl = (id) => `/api/notes/${encodeURIComponent(id)}/photo`;

// Moderation (the admin key is sent as a bearer token and is only ever held in memory).
const bearer = (key) => ({ authorization: `Bearer ${key}` });
export const adminPing = (key) => request('/api/admin/ping', { headers: bearer(key) });
export const adminList = (key, params) => request(`/api/admin/notes${qs({ limit: 30, ...params })}`, { headers: bearer(key) });
export const adminDelete = (key, id) => request(`/api/admin/notes/${encodeURIComponent(id)}`, { method: 'DELETE', headers: bearer(key) });
