import { request } from './http.js';

export const listVisitors = ({ before, limit = 12 } = {}) =>
  request(`/api/visitors?limit=${limit}${before ? `&before=${encodeURIComponent(before)}` : ''}`);

export const createVisitor = (payload) => request('/api/visitors', { method: 'POST', body: payload });
