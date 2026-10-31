import axios from 'axios';

const TOKEN_KEY = 'studymate_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

// One axios instance for the whole app; every request carries the JWT.
// AI requests (summaries, quizzes) can take up to a couple of minutes with retries.
const api = axios.create({ baseURL: '/api', timeout: 180_000 });

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// AuthContext registers a handler so an expired token logs the user out.
let onUnauthorized = () => {};
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isAuthCall = err.config?.url?.startsWith('/auth/login') || err.config?.url?.startsWith('/auth/register');
    if (err.response?.status === 401 && !isAuthCall) onUnauthorized(err.response.data?.error?.message);
    return Promise.reject(err);
  }
);

// Turn API errors ({ error: { message } }) into a readable message.
export function errorMessage(err) {
  if (err?.response?.data?.error?.message) return err.response.data.error.message;
  if (err?.code === 'ECONNABORTED') return 'The server took too long to answer. Please try again.';
  // No response at all, or an empty 502-504 from the dev proxy: the backend is down.
  if ((err?.request && !err.response) || [502, 503, 504].includes(err?.response?.status)) {
    return "Can't reach the StudyMate server. Check that the backend is running.";
  }
  if (err?.response?.status >= 500) return 'The StudyMate server had a problem. Please try again in a moment.';
  return err?.message || 'Something went wrong';
}

export default api;
