import api from './client.js';

export const listSubjects = () => api.get('/subjects').then((res) => res.data.subjects);
export const createSubject = (data) => api.post('/subjects', data).then((res) => res.data.subject);
export const updateSubject = (id, data) => api.patch(`/subjects/${id}`, data).then((res) => res.data.subject);
export const deleteSubject = (id) => api.delete(`/subjects/${id}`);
