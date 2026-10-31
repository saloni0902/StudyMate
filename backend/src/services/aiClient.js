import env from '../config/env.js';
import HttpError from '../utils/httpError.js';

// Small wrapper around the Python AI service. Every call sends the shared
// service key so the AI service only accepts requests from this backend.
async function request(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`${env.aiServiceUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Key': env.aiServiceKey,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    throw new HttpError(502, 'The AI service is not reachable. Is it running?', 'AI_SERVICE_UNREACHABLE');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Pass on the AI service's own message (e.g. "This PDF is password-protected").
    // Rate limits (429) and missing configuration (503) keep their status.
    const status = [429, 503].includes(res.status) ? res.status : 502;
    const err = new HttpError(status, data?.error?.message || `AI service error (${res.status})`, 'AI_SERVICE_ERROR');
    err.aiStatus = res.status;
    throw err;
  }
  return data;
}

export async function aiHealth() {
  try {
    const data = await request('/health');
    return data.status === 'ok' ? 'ok' : 'error';
  } catch {
    return 'unreachable';
  }
}

export const ingestDocument = (body) => request('/ingest', { method: 'POST', body });
export const askQuestion = (body) => request('/ask', { method: 'POST', body });
export const summarize = (body) => request('/summarize', { method: 'POST', body });
export const generateQuiz = (body) => request('/quiz', { method: 'POST', body });
export const generateFlashcards = (body) => request('/flashcards', { method: 'POST', body });
export const generateStudyPlan = (body) => request('/study-plan', { method: 'POST', body });
export const detectTopics = (subjectId, documentId) =>
  request(`/documents/${subjectId}/${documentId}/topics`, { method: 'POST' });
export const getDocumentPages = (subjectId, documentId) => request(`/documents/${subjectId}/${documentId}/pages`);
export const deleteDocumentData = (subjectId, documentId) =>
  request(`/documents/${subjectId}/${documentId}`, { method: 'DELETE' });
export const deleteSubjectData = (subjectId) => request(`/subjects/${subjectId}`, { method: 'DELETE' });

export default { request, aiHealth };
