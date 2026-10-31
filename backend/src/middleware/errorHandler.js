import HttpError from '../utils/httpError.js';

// 404 for any /api route we don't define.
export function notFound(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.originalUrl}` } });
}

// Turns known kinds of errors into a status + message a student can act on.
function describe(err) {
  if (err instanceof HttpError) return { status: err.status, code: err.code, message: err.message };
  // Errors from express.json() when the request body is bad.
  if (err.type === 'entity.parse.failed') return { status: 400, code: 'BAD_JSON', message: 'The request body is not valid JSON' };
  if (err.type === 'entity.too.large') return { status: 413, code: 'TOO_LARGE', message: 'The request is too large' };
  if (err.name === 'ValidationError') return { status: 400, code: 'VALIDATION_ERROR', message: err.message };
  if (err.name === 'CastError') return { status: 404, code: 'NOT_FOUND', message: 'Not found' };
  // Anything else is a bug or an outage: log it, but don't show internals.
  return { status: 500, code: 'SERVER_ERROR', message: 'Something went wrong on the server. Please try again.' };
}

// Every error leaves the API in the same shape: { error: { code, message } }.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const { status, code, message } = describe(err);
  if (status >= 500) console.error(`${req.method} ${req.originalUrl} failed:`, err);
  res.status(status).json({ error: { code, message } });
}
