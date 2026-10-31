import { after, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import Document from '../src/models/Document.js';
import { computeProgress, planTopics } from '../src/services/progress.js';
import { clearDB, startTestDB, stopTestDB } from './helpers.js';

const attempt = (score, total, topicBreakdown, createdAt) => ({
  id: String(createdAt),
  quizTopic: '',
  score,
  total,
  percent: Math.round((score / total) * 100),
  topicBreakdown,
  createdAt,
});

describe('computeProgress', () => {
  const attempts = [
    attempt(2, 4, [{ topic: 'Deadlock', correct: 0, total: 2 }, { topic: 'Paging', correct: 2, total: 2 }], 1),
    attempt(3, 4, [{ topic: 'Deadlock', correct: 1, total: 2 }, { topic: 'Paging', correct: 2, total: 2 }], 2),
    attempt(0, 1, [{ topic: 'Round Robin', correct: 0, total: 1 }], 3),
  ];

  it('adds up topics across attempts, weakest first', () => {
    const p = computeProgress(attempts);
    assert.equal(p.quizzesTaken, 3);
    assert.equal(p.averagePercent, 56); // 5 of 9
    assert.deepEqual(
      p.topics.map((t) => [t.topic, t.correct, t.total, t.percent, t.lastPercent]),
      [
        ['Round Robin', 0, 1, 0, 0],
        ['Deadlock', 1, 4, 25, 50],
        ['Paging', 4, 4, 100, 100],
      ]
    );
  });

  it('only calls a topic weak after enough answers', () => {
    // Round Robin is 0% but from a single answer, so not judged yet.
    assert.deepEqual(computeProgress(attempts).weakTopics, [{ topic: 'Deadlock', percent: 25 }]);
  });

  it('plans for imperfect topics when none are weak, else the lowest', () => {
    const someMistakes = computeProgress([
      attempt(5, 6, [{ topic: 'Paging', correct: 4, total: 4 }, { topic: 'Deadlock', correct: 1, total: 2 }], 1),
    ]);
    // Deadlock is 50% from 2 answers -> weak, so it is used.
    assert.deepEqual(planTopics(someMistakes), [{ topic: 'Deadlock', percent: 50 }]);

    const oneSlip = computeProgress([
      attempt(4, 5, [{ topic: 'Paging', correct: 4, total: 4 }, { topic: 'Round Robin', correct: 0, total: 1 }], 1),
    ]);
    // Nothing weak yet: only the topic with a mistake, not the perfect one.
    assert.deepEqual(planTopics(oneSlip), [{ topic: 'Round Robin', percent: 0 }]);

    const perfect = computeProgress([attempt(4, 4, [{ topic: 'Paging', correct: 4, total: 4 }], 1)]);
    assert.deepEqual(planTopics(perfect), [{ topic: 'Paging', percent: 100 }]);
  });

  it('handles no attempts', () => {
    const p = computeProgress([]);
    assert.equal(p.averagePercent, 0);
    assert.deepEqual(p.topics, []);
  });
});

let calls;
let replies;
function mockAiService() {
  calls = [];
  replies = {
    '/flashcards': {
      status: 200,
      body: {
        cards: [
          { front: 'What is a deadlock?', back: 'Processes waiting on each other.', topic: 'Deadlock', source: { documentId: 'd', fileName: 'os.pdf', page: 3 } },
          { front: 'What is paging?', back: 'Memory split into frames.', topic: 'Paging', source: { documentId: 'd', fileName: 'os.pdf', page: 4 } },
        ],
      },
    },
    '/study-plan': {
      status: 200,
      body: { days: [{ day: 1, focus: 'Deadlock', tasks: ['Re-read p. 3'], sources: [{ documentId: 'd', fileName: 'os.pdf', page: 3 }] }] },
    },
    '/quiz': {
      status: 200,
      body: {
        questions: [
          { question: 'Q1?', options: ['a', 'b', 'c', 'd'], answerIndex: 0, topic: 'Deadlock', explanation: 'E', source: { documentId: 'd', fileName: 'os.pdf', page: 3 } },
          { question: 'Q2?', options: ['a', 'b', 'c', 'd'], answerIndex: 0, topic: 'Deadlock', explanation: 'E', source: { documentId: 'd', fileName: 'os.pdf', page: 3 } },
          { question: 'Q3?', options: ['a', 'b', 'c', 'd'], answerIndex: 0, topic: 'Paging', explanation: 'E', source: { documentId: 'd', fileName: 'os.pdf', page: 4 } },
        ],
      },
    },
  };
  mock.method(globalThis, 'fetch', async (url, options = {}) => {
    const { pathname } = new URL(url);
    calls.push({ pathname, body: options.body && JSON.parse(options.body) });
    const reply = replies[pathname] || { status: 200, body: { deleted: true } };
    return Response.json(reply.body, { status: reply.status });
  });
}

async function signUp(email) {
  const res = await request(app).post('/api/auth/register').send({ name: 'Student', email, password: 'secret123' });
  return { token: `Bearer ${res.body.token}`, userId: res.body.user.id };
}

describe('flashcards, progress and study plan API', () => {
  let alice;
  let subjectId;
  const api = (method, path, token = alice.token) => request(app)[method](path).set('Authorization', token);

  before(startTestDB);
  after(stopTestDB);
  beforeEach(async () => {
    await clearDB();
    mock.restoreAll();
    mockAiService();
    alice = await signUp('alice@example.com');
    subjectId = (await api('post', '/api/subjects').send({ name: 'OS' })).body.subject.id;
    await Document.create({ userId: alice.userId, subjectId, originalName: 'os.pdf', storedName: 'x.pdf', size: 1, status: 'ready', topics: ['Deadlock'] });
  });

  it('creates a deck and tracks known / review cards', async () => {
    const { deck } = (await api('post', `/api/subjects/${subjectId}/decks`).send({ topic: 'Deadlock', count: 5 }).expect(201)).body;
    assert.equal(deck.cards.length, 2);
    assert.deepEqual(deck.counts, { total: 2, known: 0, review: 0, new: 2 });
    assert.deepEqual(calls[0].body, { subjectId, topic: 'Deadlock', count: 5, knownTopics: ['Deadlock'] });

    await api('patch', `/api/decks/${deck.id}/cards/0`).send({ status: 'known' }).expect(200);
    const marked = await api('patch', `/api/decks/${deck.id}/cards/1`).send({ status: 'review' }).expect(200);
    assert.deepEqual(marked.body.counts, { total: 2, known: 1, review: 1, new: 0 });

    await api('patch', `/api/decks/${deck.id}/cards/5`).send({ status: 'known' }).expect(404);
    await api('patch', `/api/decks/${deck.id}/cards/0`).send({ status: 'maybe' }).expect(400);

    const reset = await api('post', `/api/decks/${deck.id}/reset`).expect(200);
    assert.equal(reset.body.deck.counts.new, 2);

    const list = await api('get', `/api/subjects/${subjectId}/decks`).expect(200);
    assert.equal(list.body.decks[0].cards, undefined);
    assert.equal(list.body.decks[0].counts.total, 2);
  });

  it('keeps decks private', async () => {
    const { deck } = (await api('post', `/api/subjects/${subjectId}/decks`).send({})).body;
    const bob = await signUp('bob@example.com');
    await api('get', `/api/decks/${deck.id}`, bob.token).expect(404);
    await api('patch', `/api/decks/${deck.id}/cards/0`, bob.token).send({ status: 'known' }).expect(404);
  });

  it('builds progress from quiz attempts and makes a study plan for weak topics', async () => {
    await api('post', `/api/subjects/${subjectId}/study-plan`).send({}).expect(409); // no quiz yet

    const { quiz } = (await api('post', `/api/subjects/${subjectId}/quizzes`).send({})).body;
    await api('post', `/api/quizzes/${quiz.id}/submit`).send({ answers: [1, 1, 0] }).expect(201);
    await api('post', `/api/subjects/${subjectId}/decks`).send({});

    const progress = (await api('get', `/api/subjects/${subjectId}/progress`).expect(200)).body;
    assert.equal(progress.quizzesTaken, 1);
    assert.equal(progress.averagePercent, 33);
    assert.deepEqual(progress.weakTopics, [{ topic: 'Deadlock', percent: 0 }]);
    assert.deepEqual(progress.flashcards, { decks: 1, total: 2, known: 0 });
    assert.equal(progress.studyPlan, null);

    const plan = (await api('post', `/api/subjects/${subjectId}/study-plan`).send({ days: 4 }).expect(201)).body.studyPlan;
    assert.equal(plan.days[0].focus, 'Deadlock');
    assert.deepEqual(calls.at(-1).body, { subjectId, weakTopics: [{ topic: 'Deadlock', percent: 0 }], days: 4 });

    const after = (await api('get', `/api/subjects/${subjectId}/progress`)).body;
    assert.equal(after.studyPlan.id, plan.id);

    await api('post', `/api/subjects/${subjectId}/study-plan`).send({ days: 9 }).expect(400);
  });

  it('deleting the subject removes decks and plans', async () => {
    const { deck } = (await api('post', `/api/subjects/${subjectId}/decks`).send({})).body;
    await api('delete', `/api/subjects/${subjectId}`).expect(204);
    await api('get', `/api/decks/${deck.id}`).expect(404);
  });
});
