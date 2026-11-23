import { request } from './http.js';

export const register = (username, password) => request('/api/auth/register', { method: 'POST', body: { username, password } });
export const login = (username, password) => request('/api/auth/login', { method: 'POST', body: { username, password } });
export const logout = () => request('/api/auth/logout', { method: 'POST', body: {} });
