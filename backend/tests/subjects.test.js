import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import { clearDB, startTestDB, stopTestDB } from './helpers.js';

async function signUp(email) {
  const res = await request(app).post('/api/auth/register').send({ name: 'Student', email, password: 'secret123' });
  return `Bearer ${res.body.token}`;
}

describe('subjects', () => {
  let alice;
  let bob;

  before(startTestDB);
  after(stopTestDB);
  beforeEach(async () => {
    await clearDB();
    alice = await signUp('alice@example.com');
    bob = await signUp('bob@example.com');
  });

  it('requires login', async () => {
    await request(app).get('/api/subjects').expect(401);
  });

  it('creates, lists, renames and deletes a subject', async () => {
    const created = await request(app)
      .post('/api/subjects')
      .set('Authorization', alice)
      .send({ name: 'Operating Systems', description: 'Sem 5' })
      .expect(201);
    const { id } = created.body.subject;

    const list = await request(app).get('/api/subjects').set('Authorization', alice).expect(200);
    assert.equal(list.body.subjects.length, 1);

    const renamed = await request(app)
      .patch(`/api/subjects/${id}`)
      .set('Authorization', alice)
      .send({ name: 'OS' })
      .expect(200);
    assert.equal(renamed.body.subject.name, 'OS');

    await request(app).delete(`/api/subjects/${id}`).set('Authorization', alice).expect(204);
    await request(app).get(`/api/subjects/${id}`).set('Authorization', alice).expect(404);
  });

  it('rejects an empty name and a duplicate name (any case)', async () => {
    await request(app).post('/api/subjects').set('Authorization', alice).send({ name: '  ' }).expect(400);
    await request(app).post('/api/subjects').set('Authorization', alice).send({ name: 'DBMS' }).expect(201);
    await request(app).post('/api/subjects').set('Authorization', alice).send({ name: 'dbms' }).expect(409);
    // A different student may use the same name.
    await request(app).post('/api/subjects').set('Authorization', bob).send({ name: 'DBMS' }).expect(201);
  });

  it("hides one student's subjects from another", async () => {
    const created = await request(app).post('/api/subjects').set('Authorization', alice).send({ name: 'Networks' });
    const { id } = created.body.subject;

    const bobList = await request(app).get('/api/subjects').set('Authorization', bob).expect(200);
    assert.equal(bobList.body.subjects.length, 0);
    await request(app).get(`/api/subjects/${id}`).set('Authorization', bob).expect(404);
    await request(app).patch(`/api/subjects/${id}`).set('Authorization', bob).send({ name: 'Hacked' }).expect(404);
    await request(app).delete(`/api/subjects/${id}`).set('Authorization', bob).expect(404);
  });

  it('returns 404 for an invalid id', async () => {
    await request(app).get('/api/subjects/not-an-id').set('Authorization', alice).expect(404);
  });
});
