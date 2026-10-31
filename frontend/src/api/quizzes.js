import api from './client.js';

export const listTopics = (subjectId) => api.get(`/subjects/${subjectId}/topics`).then((res) => res.data.topics);
export const refreshTopics = (documentId) =>
  api.post(`/documents/${documentId}/topics`).then((res) => res.data.document);

export const listQuizzes = (subjectId) => api.get(`/subjects/${subjectId}/quizzes`).then((res) => res.data.quizzes);
export const createQuiz = (subjectId, body) =>
  api.post(`/subjects/${subjectId}/quizzes`, body).then((res) => res.data.quiz);
export const getQuiz = (id) => api.get(`/quizzes/${id}`).then((res) => res.data);
export const deleteQuiz = (id) => api.delete(`/quizzes/${id}`);
export const submitQuiz = (id, answers) => api.post(`/quizzes/${id}/submit`, { answers }).then((res) => res.data);
export const getAttempt = (id) => api.get(`/quiz-attempts/${id}`).then((res) => res.data);
