import { after, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import Document from '../src/models/Document.js';
import { scoreQuiz } from '../src/services/scoring.js';
import { clearDB, startTestDB, stopTestDB } from './helpers.js';

const QUESTIONS = [
  { question: 'Q1?', options: ['a', 'b', 'c', 'd'], answerIndex: 0, topic: 'Deadlock', explanation: 'E1', source: { documentId: 'd', fileName: 'os.pdf', page: 3 } },
  { question: 'Q2?', options: ['a', 'b', 'c', 'd'], answerIndex: 1, topic: 'Deadlock', explanation: 'E2', source: { documentId: 'd', fileName: 'os.pdf', page: 3 } },
  { question: 'Q3?', options: ['a', 'b', 'c', 'd'], answerIndex: 2, topic: 'CPU scheduling', explanation: 'E3', source: { documentId: 'd', fileName: 'os.pdf', page: 2 } },
];

describe('scoreQuiz', () => {
  it('counts correct answers, skips and per-topic results (weakest first)', () => {
    const result = scoreQuiz(QUESTIONS, [0, 3, 2]);
    assert.equal(result.score, 2);
    assert.equal(result.percent, 67);
    assert.deepEqual(result.topicBreakdown, [
      { topic: 'Deadlock', correct: 1, total: 2 },
      { topic: 'CPU scheduling', correct: 1, total: 1 },
    ]);
  });

  it('treats missing answers as skipped', () => {
    const result = scoreQuiz(QUESTIONS, [0]);
    assert.deepEqual(result.answers, [0, -1, -1]);
    assert.equal(result.score, 1);
  });
});

let calls;
let reply;
function mockAiService() {
  calls = [];
  reply = { status: 200, body: { questions: QUESTIONS } };
  mock.method(globalThis, 'fetch', async (url, options = {}) => {
    const { pathname } = new URL(url);
    calls.push({ pathname, body: options.body && JSON.parse(options.body) });
    if (pathname === '/quiz') return Response.json(reply.body, { status: reply.status });
    if (pathname.endsWith('/topics')) return Response.json({ topics: ['Paging'] });
    return Response.json({ deleted: true });
  });
}

async function signUp(email) {
  const res = await request(app).post('/api/auth/register').send({ name: 'Student', email, password: 'secret123' });
  return { token: `Bearer ${res.body.token}`, userId: res.body.user.id };
}

describe('quizzes API', () => {
  let alice;
  let subjectId;
  let doc;

  const create = (body = {}, token = alice.token) =>
    request(app).post(`/api/subjects/${subjectId}/quizzes`).set('Authorization', token).send(body);
  const submit = (quizId, answers, token = alice.token) =>
    request(app).post(`/api/quizzes/${quizId}/submit`).set('Authorization', token).send({ answers });

  before(startTestDB);
  after(stopTestDB);
  beforeEach(async () => {
    await clearDB();
    mock.restoreAll();
    mockAiService();
    alice = await signUp('alice@example.com');
    const res = await request(app).post('/api/subjects').set('Authorization', alice.token).send({ name: 'OS' });
    subjectId = res.body.subject.id;
    doc = await Document.create({
      userId: alice.userId,
      subjectId,
      originalName: 'os.pdf',
      storedName: 'x.pdf',
      size: 10,
      status: 'ready',
      topics: ['Deadlock', 'CPU scheduling'],
    });
  });

  it('creates a quiz without revealing the answers', async () => {
    const res = await create({ topic: 'Deadlock', count: 5, difficulty: 'hard' }).expect(201);
    const { quiz } = res.body;
    assert.equal(quiz.questions.length, 3);
    assert.equal(quiz.questions[0].answerIndex, undefined);
    assert.equal(quiz.questions[0].explanation, undefined);
    assert.deepEqual(calls[0].body, {
      subjectId,
      topic: 'Deadlock',
      count: 5,
      difficulty: 'hard',
      knownTopics: ['Deadlock', 'CPU scheduling'],
    });

    const again = await request(app).get(`/api/quizzes/${quiz.id}`).set('Authorization', alice.token).expect(200);
    assert.equal(again.body.quiz.questions[1].answerIndex, undefined);
  });

  it('scores a submission and returns the full review', async () => {
    const { body } = await create();
    const res = await submit(body.quiz.id, [0, 3, -1]).expect(201);
    assert.equal(res.body.attempt.score, 1);
    assert.equal(res.body.attempt.percent, 33);
    assert.equal(res.body.questions[1].correct, false);
    assert.equal(res.body.questions[1].answerIndex, 1);
    assert.equal(res.body.questions[1].explanation, 'E2');
    assert.equal(res.body.questions[2].chosenIndex, -1);

    const review = await request(app)
      .get(`/api/quiz-attempts/${res.body.attempt.id}`)
      .set('Authorization', alice.token)
      .expect(200);
    assert.equal(review.body.attempt.score, 1);

    const list = await request(app).get(`/api/subjects/${subjectId}/quizzes`).set('Authorization', alice.token);
    assert.equal(list.body.quizzes[0].attempts, 1);
    assert.equal(list.body.quizzes[0].best, 33);
  });

  it('validates answers and quiz settings', async () => {
    const { body } = await create();
    await submit(body.quiz.id, [0, 1]).expect(400); // wrong number of answers
    await submit(body.quiz.id, [0, 1, 7]).expect(400); // not an option
    await create({ count: 30 }).expect(400);
    await create({ difficulty: 'extreme' }).expect(400);
    await create({ topic: 'x' }).expect(400);
  });

  it('passes on "not in your notes" and needs a ready document', async () => {
    reply = { status: 422, body: { error: { message: "I couldn't find French revolution in your notes." } } };
    const res = await create({ topic: 'French revolution' }).expect(422);
    assert.equal(res.body.error.code, 'NOT_IN_NOTES');

    await Document.deleteMany({});
    await create().expect(409);
  });

  it('keeps quizzes private and deletes them with the subject', async () => {
    const { body } = await create();
    const bob = await signUp('bob@example.com');
    await request(app).get(`/api/quizzes/${body.quiz.id}`).set('Authorization', bob.token).expect(404);
    await submit(body.quiz.id, [0, 0, 0], bob.token).expect(404);

    const attempt = await submit(body.quiz.id, [0, 0, 0]);
    await request(app).get(`/api/quiz-attempts/${attempt.body.attempt.id}`).set('Authorization', bob.token).expect(404);

    await request(app).delete(`/api/subjects/${subjectId}`).set('Authorization', alice.token).expect(204);
    await request(app).get(`/api/quizzes/${body.quiz.id}`).set('Authorization', alice.token).expect(404);
  });

  it('lists topics and can re-detect them for a document', async () => {
    const topics = await request(app).get(`/api/subjects/${subjectId}/topics`).set('Authorization', alice.token);
    assert.deepEqual(topics.body.topics, ['Deadlock', 'CPU scheduling']);

    const res = await request(app).post(`/api/documents/${doc._id}/topics`).set('Authorization', alice.token).expect(200);
    assert.deepEqual(res.body.document.topics, ['Paging']);
  });
});
