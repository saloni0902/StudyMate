import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import HttpError from '../src/utils/httpError.js';

// Calls the error handler directly and returns what it sent.
function handle(err) {
  const sent = {};
  const res = {
    status(code) {
      sent.status = code;
      return this;
    },
    json(body) {
      sent.body = body;
    },
  };
  errorHandler(err, { method: 'GET', originalUrl: '/x' }, res, () => {});
  return sent;
}

describe('error handling', () => {
  it('answers bad JSON with a clear 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ')
      .expect(400);
    assert.deepEqual(res.body.error, { code: 'BAD_JSON', message: 'The request body is not valid JSON' });
  });

  it('answers unknown API routes with 404 JSON', async () => {
    const res = await request(app).get('/api/nope').expect(404);
    assert.equal(res.body.error.code, 'NOT_FOUND');
  });

  it('passes on HttpError messages', () => {
    assert.deepEqual(handle(new HttpError(409, 'Upload a PDF first')), {
      status: 409,
      body: { error: { code: 'CONFLICT', message: 'Upload a PDF first' } },
    });
  });

  it('hides internal details of unexpected errors', () => {
    const log = mock.method(console, 'error', () => {});
    const sent = handle(new TypeError("Cannot read properties of undefined (reading 'x')"));
    log.mock.restore();
    assert.equal(sent.status, 500);
    assert.equal(sent.body.error.message, 'Something went wrong on the server. Please try again.');
    assert.equal(log.mock.callCount(), 1); // but it is logged for the developer
  });
});
