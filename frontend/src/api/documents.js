import api from './client.js';

export const listDocuments = (subjectId) =>
  api.get(`/subjects/${subjectId}/documents`).then((res) => res.data.documents);

export function uploadDocument(subjectId, file, onProgress) {
  const form = new FormData();
  form.append('file', file);
  return api
    .post(`/subjects/${subjectId}/documents`, form, {
      onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded / e.total) * 100)),
    })
    .then((res) => res.data.document);
}

export const getDocumentText = (id) => api.get(`/documents/${id}/text`).then((res) => res.data);
export const retryDocument = (id) => api.post(`/documents/${id}/retry`).then((res) => res.data.document);
export const deleteDocument = (id) => api.delete(`/documents/${id}`);
