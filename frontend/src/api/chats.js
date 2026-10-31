import api from './client.js';

export const listChats = (subjectId) => api.get(`/subjects/${subjectId}/chats`).then((res) => res.data.chats);
export const createChat = (subjectId) => api.post(`/subjects/${subjectId}/chats`).then((res) => res.data.chat);
export const getChat = (id) => api.get(`/chats/${id}`).then((res) => res.data.chat);
export const deleteChat = (id) => api.delete(`/chats/${id}`);
export const sendMessage = (chatId, content) =>
  api.post(`/chats/${chatId}/messages`, { content }).then((res) => res.data);
