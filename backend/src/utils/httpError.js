// An error that carries an HTTP status and a short code, so the error
// handler can turn it into { error: { code, message } }.
export default class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code || defaultCode(status);
  }
}

function defaultCode(status) {
  return (
    {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
    }[status] || 'SERVER_ERROR'
  );
}
