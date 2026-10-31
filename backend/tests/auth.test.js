import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import { clearDB, startTestDB, stopTestDB } from './helpers.js';

const student = { name: 'Asha', email: 'Asha@Example.com', password: 'secret123' };

describe('auth', () => {
  before(startTestDB);
  after(stopTestDB);
  beforeEach(clearDB);

  it('registers a user and returns a token without the password', async () => {
    const res = await request(app).post('/api/auth/register').send(student).expect(201);
    assert.ok(res.body.token);
    assert.equal(res.body.user.email, 'asha@example.com');
    assert.equal(res.body.user.passwordHash, undefined);
  });

  it('rejects a duplicate email', async () => {
    await request(app).post('/api/auth/register').send(student).expect(201);
    const res = await request(app).post('/api/auth/register').send(student).expect(409);
    assert.equal(res.body.error.code, 'CONFLICT');
  });

  it('validates register input', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'A', email: 'not-an-email', password: '123' })
      .expect(400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  it('logs in with the right password only', async () => {
    await request(app).post('/api/auth/register').send(student).expect(201);
    await request(app).post('/api/auth/login').send({ email: student.email, password: 'wrong-pass' }).expect(401);
    const res = await request(app).post('/api/auth/login').send({ email: 'asha@example.com', password: student.password }).expect(200);
    assert.ok(res.body.token);
  });

  it('returns the current user for a valid token', async () => {
    const { body } = await request(app).post('/api/auth/register').send(student);
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${body.token}`).expect(200);
    assert.equal(res.body.user.name, 'Asha');
  });

  it('rejects a valid token whose account no longer exists', async () => {
    const { body } = await request(app).post('/api/auth/register').send(student);
    await clearDB(); // e.g. the database was reset
    const res = await request(app).get('/api/subjects').set('Authorization', `Bearer ${body.token}`).expect(401);
    assert.match(res.body.error.message, /account was not found/);
  });

  it('rejects missing or bad tokens', async () => {
    await request(app).get('/api/auth/me').expect(401);
    await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-token').expect(401);
  });
});
