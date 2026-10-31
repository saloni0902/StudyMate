import api from './client.js';

export const getProgress = (subjectId) => api.get(`/subjects/${subjectId}/progress`).then((res) => res.data);
export const createStudyPlan = (subjectId, days) =>
  api.post(`/subjects/${subjectId}/study-plan`, { days }).then((res) => res.data.studyPlan);
