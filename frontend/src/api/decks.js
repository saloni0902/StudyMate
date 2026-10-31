import api from './client.js';

export const listDecks = (subjectId) => api.get(`/subjects/${subjectId}/decks`).then((res) => res.data.decks);
export const createDeck = (subjectId, body) => api.post(`/subjects/${subjectId}/decks`, body).then((res) => res.data.deck);
export const getDeck = (id) => api.get(`/decks/${id}`).then((res) => res.data.deck);
export const markCard = (id, index, status) =>
  api.patch(`/decks/${id}/cards/${index}`, { status }).then((res) => res.data.counts);
export const resetDeck = (id) => api.post(`/decks/${id}/reset`).then((res) => res.data.deck);
export const deleteDeck = (id) => api.delete(`/decks/${id}`);
