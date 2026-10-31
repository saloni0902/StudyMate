import api from './client.js';

export const listSummaries = (subjectId) =>
  api.get(`/subjects/${subjectId}/summaries`).then((res) => res.data.summaries);
export const createSummary = (subjectId, body) =>
  api.post(`/subjects/${subjectId}/summaries`, body).then((res) => res.data.summary);
export const getSummary = (id) => api.get(`/summaries/${id}`).then((res) => res.data.summary);
export const deleteSummary = (id) => api.delete(`/summaries/${id}`);
