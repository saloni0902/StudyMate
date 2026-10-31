import api from './client.js';

export const register = (data) => api.post('/auth/register', data).then((res) => res.data);
export const login = (data) => api.post('/auth/login', data).then((res) => res.data);
export const getMe = () => api.get('/auth/me').then((res) => res.data.user);
