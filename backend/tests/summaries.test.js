import { after, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import Document from '../src/models/Document.js';
import { clearDB, startTestDB, stopTestDB } from './helpers.js';

// Stand-in for the AI service: /summarize answers, deletes succeed.
let calls;
let reply;
function mockAiService() {
  calls = [];
  reply = {
    status: 200,
    body: {
      summary: 'Your notes cover processes [1].',
      citations: [{ n: 1, documentId: 'd', fileName: 'os.pdf', page: 1, snippet: 'A process…' }],
      grounded: true,
      truncated: false,
    },
  };
  mock.method(globalThis, 'fetch', async (url, options = {}) => {
    const { pathname } = new URL(url);
    calls.push({ pathname, method: options.method, body: options.body && JSON.parse(options.body) });
    if (pathname === '/summarize') return Response.json(reply.body, { status: reply.status });
    return Response.json({ deleted: true });
  });
}

async function signUp(email) {
  const res = await request(app).post('/api/auth/register').send({ name: 'Student', email, password: 'secret123' });
  return { token: `Bearer ${res.body.token}`, userId: res.body.user.id };
}

describe('summaries', () => {
  let alice;
  let subjectId;

  const addDocument = (status = 'ready') =>
    Document.create({ userId: alice.userId, subjectId, originalName: 'os.pdf', storedName: 'x.pdf', size: 10, status });

  const create = (body, token = alice.token) =>
    request(app).post(`/api/subjects/${subjectId}/summaries`).set('Authorization', token).send(body);

  before(startTestDB);
  after(stopTestDB);
  beforeEach(async () => {
    await clearDB();
    mock.restoreAll();
    mockAiService();
    alice = await signUp('alice@example.com');
    const res = await request(app).post('/api/subjects').set('Authorization', alice.token).send({ name: 'OS' });
    subjectId = res.body.subject.id;
  });

  it('summarises a document and saves it', async () => {
    const doc = await addDocument();
    const res = await create({ documentId: String(doc._id), length: 'detailed' }).expect(201);
    assert.equal(res.body.summary.title, 'os.pdf');
    assert.equal(res.body.summary.kind, 'document');
    assert.equal(res.body.summary.citations[0].page, 1);
    assert.deepEqual(calls[0].body, { subjectId, documentId: String(doc._id), length: 'detailed' });

    const list = await request(app).get(`/api/subjects/${subjectId}/summaries`).set('Authorization', alice.token);
    assert.equal(list.body.summaries.length, 1);
    assert.equal(list.body.summaries[0].content, undefined); // list leaves out the text

    const one = await request(app).get(`/api/summaries/${res.body.summary.id}`).set('Authorization', alice.token);
    assert.equal(one.body.summary.content, 'Your notes cover processes [1].');
  });

  it('summarises a topic', async () => {
    await addDocument();
    const res = await create({ topic: '  CPU scheduling ' }).expect(201);
    assert.equal(res.body.summary.title, 'CPU scheduling');
    assert.deepEqual(calls[0].body, { subjectId, topic: 'CPU scheduling', length: 'short' });
  });

  it('does not save "not in your notes" results', async () => {
    await addDocument();
    reply.body = { summary: "I couldn't find this in your notes.", citations: [], grounded: false, truncated: false };
    const res = await create({ topic: 'French revolution' }).expect(422);
    assert.equal(res.body.error.code, 'NOT_IN_NOTES');
    assert.match(res.body.error.message, /couldn't find/);
    const list = await request(app).get(`/api/subjects/${subjectId}/summaries`).set('Authorization', alice.token);
    assert.equal(list.body.summaries.length, 0);
  });

  it('needs exactly one of document or topic, and a valid length', async () => {
    const doc = await addDocument();
    await create({}).expect(400);
    await create({ documentId: String(doc._id), topic: 'x y' }).expect(400);
    await create({ topic: 'a' }).expect(400);
    await create({ topic: 'scheduling', length: 'huge' }).expect(400);
    assert.equal(calls.length, 0);
  });

  it('refuses documents that are not ready or not in the subject', async () => {
    const processing = await addDocument('processing');
    await create({ documentId: String(processing._id) }).expect(409);
    await create({ documentId: '0'.repeat(24) }).expect(404);
    await Document.deleteMany({});
    await create({ topic: 'scheduling' }).expect(409);
    assert.equal(calls.length, 0);
  });

  it('saves nothing when the AI service fails', async () => {
    await addDocument();
    reply = { status: 429, body: { error: { message: 'The Gemini free-tier limit was reached.' } } };
    await create({ topic: 'scheduling' }).expect(429);
    const list = await request(app).get(`/api/subjects/${subjectId}/summaries`).set('Authorization', alice.token);
    assert.equal(list.body.summaries.length, 0);
  });

  it("keeps summaries private and deletes them with their document", async () => {
    const doc = await addDocument();
    const { body } = await create({ documentId: String(doc._id) });
    const bob = await signUp('bob@example.com');
    await request(app).get(`/api/summaries/${body.summary.id}`).set('Authorization', bob.token).expect(404);
    await request(app).delete(`/api/summaries/${body.summary.id}`).set('Authorization', bob.token).expect(404);
    await create({ topic: 'scheduling' }, bob.token).expect(404);

    await request(app).delete(`/api/documents/${doc._id}`).set('Authorization', alice.token).expect(204);
    await request(app).get(`/api/summaries/${body.summary.id}`).set('Authorization', alice.token).expect(404);
  });
});
