import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mongoStartupErrorMessage } from '../src/config/db.js';

describe('Mongo startup helpers', () => {
  it('explains the missing Visual C++ redistributable on Windows', () => {
    const err = {
      message: 'Failed to start server: Instance closed unexpectedly with code "3221225781" and signal "null"',
      code: '3221225781',
    };

    const message = mongoStartupErrorMessage(err);

    assert.match(message, /Visual C\+\+ Redistributable/i);
    assert.match(message, /MONGO_URI/i);
  });
});
