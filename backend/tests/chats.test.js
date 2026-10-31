import { after, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import Document from '../src/models/Document.js';
import { clearDB, startTestDB, stopTestDB } from './helpers.js';

// Stand-in for the AI service's /ask.
let askCalls;
let askReply;
function mockAiService() {
  askCalls = [];
  askReply = {
    status: 200,
    body: {
      answer: 'Round Robin gives each process a **time quantum** [1].',
      citations: [{ n: 1, documentId: 'doc1', fileName: 'os.pdf', page: 3, snippet: 'Round Robin…' }],
      grounded: true,
    },
  };
  mock.method(globalThis, 'fetch', async (url, options = {}) => {
    askCalls.push(JSON.parse(options.body));
    return Response.json(askReply.body, { status: askReply.status });
  });
}

async function signUp(email) {
  const res = await request(app).post('/api/auth/register').send({ name: 'Student', email, password: 'secret123' });
  return { token: `Bearer ${res.body.token}`, userId: res.body.user.id };
}

describe('chats', () => {
  let alice;
  let subjectId;

  const addReadyDocument = () =>
    Document.create({
      userId: alice.userId,
      subjectId,
      originalName: 'os.pdf',
      storedName: 'x.pdf',
      size: 10,
      status: 'ready',
    });

  const newChat = async (token = alice.token) =>
    (await request(app).post(`/api/subjects/${subjectId}/chats`).set('Authorization', token).expect(201)).body.chat;

  const send = (chatId, content, token = alice.token) =>
    request(app).post(`/api/chats/${chatId}/messages`).set('Authorization', token).send({ content });

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

  it('asks a question and saves both messages with citations', async () => {
    await addReadyDocument();
    const chat = await newChat();

    const res = await send(chat.id, '  What is Round Robin?  ').expect(201);
    assert.equal(res.body.userMessage.content, 'What is Round Robin?');
    assert.equal(res.body.assistantMessage.citations[0].page, 3);
    assert.equal(res.body.chat.title, 'What is Round Robin?');
    assert.deepEqual(askCalls[0], { subjectId, question: 'What is Round Robin?', history: [] });

    const saved = await request(app).get(`/api/chats/${chat.id}`).set('Authorization', alice.token).expect(200);
    assert.equal(saved.body.chat.messages.length, 2);
  });

  it('sends earlier messages as history for follow-ups', async () => {
    await addReadyDocument();
    const chat = await newChat();
    await send(chat.id, 'What is Round Robin?').expect(201);
    await send(chat.id, 'Give me an example').expect(201);

    assert.deepEqual(
      askCalls[1].history.map((m) => m.role),
      ['user', 'assistant']
    );
    assert.equal(askCalls[1].history[0].content, 'What is Round Robin?');
  });

  it('needs a ready document first', async () => {
    const chat = await newChat();
    const res = await send(chat.id, 'What is a process?').expect(409);
    assert.match(res.body.error.message, /Upload a PDF/);
    assert.equal(askCalls.length, 0);
  });

  it('saves nothing when the AI service fails, keeping its status', async () => {
    await addReadyDocument();
    const chat = await newChat();
    askReply = { status: 429, body: { error: { message: 'The Gemini free-tier limit was reached.' } } };

    const res = await send(chat.id, 'What is a process?').expect(429);
    assert.match(res.body.error.message, /free-tier/);
    const saved = await request(app).get(`/api/chats/${chat.id}`).set('Authorization', alice.token);
    assert.equal(saved.body.chat.messages.length, 0);
  });

  it('rejects empty questions', async () => {
    const chat = await newChat();
    await send(chat.id, '   ').expect(400);
  });

  it('lists, and deletes chats; other students cannot see them', async () => {
    await addReadyDocument();
    const chat = await newChat();
    await send(chat.id, 'What is Round Robin?');

    const list = await request(app).get(`/api/subjects/${subjectId}/chats`).set('Authorization', alice.token).expect(200);
    assert.deepEqual(list.body.chats.map((c) => c.title), ['What is Round Robin?']);

    const bob = await signUp('bob@example.com');
    await request(app).get(`/api/chats/${chat.id}`).set('Authorization', bob.token).expect(404);
    await send(chat.id, 'hi', bob.token).expect(404);
    await request(app).post(`/api/subjects/${subjectId}/chats`).set('Authorization', bob.token).expect(404);

    await request(app).delete(`/api/chats/${chat.id}`).set('Authorization', alice.token).expect(204);
    await request(app).get(`/api/chats/${chat.id}`).set('Authorization', alice.token).expect(404);
  });

  it('deleting a subject deletes its chats', async () => {
    const chat = await newChat();
    await request(app).delete(`/api/subjects/${subjectId}`).set('Authorization', alice.token).expect(204);
    await request(app).get(`/api/chats/${chat.id}`).set('Authorization', alice.token).expect(404);
  });
});
