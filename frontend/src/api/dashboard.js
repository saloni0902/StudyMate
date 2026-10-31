import api from './client.js';

export const getDashboard = () => api.get('/dashboard').then((res) => res.data);
