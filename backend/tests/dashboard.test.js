import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import Document from '../src/models/Document.js';
import Quiz from '../src/models/Quiz.js';
import QuizAttempt from '../src/models/QuizAttempt.js';
import StudyPlan from '../src/models/StudyPlan.js';
import { clearDB, startTestDB, stopTestDB } from './helpers.js';

async function signUp(email) {
  const res = await request(app).post('/api/auth/register').send({ name: 'Student', email, password: 'secret123' });
  return { token: `Bearer ${res.body.token}`, userId: res.body.user.id };
}

describe('dashboard', () => {
  let alice;

  before(startTestDB);
  after(stopTestDB);
  beforeEach(async () => {
    await clearDB();
    alice = await signUp('alice@example.com');
  });

  it('summarises every subject, recent quizzes and the latest plan', async () => {
    const make = (name) => request(app).post('/api/subjects').set('Authorization', alice.token).send({ name });
    const os = (await make('OS')).body.subject.id;
    const db = (await make('DBMS')).body.subject.id;

    await Document.create({ userId: alice.userId, subjectId: os, originalName: 'a.pdf', storedName: 'a', size: 1, status: 'ready' });
    await Document.create({ userId: alice.userId, subjectId: os, originalName: 'b.pdf', storedName: 'b', size: 1, status: 'failed' });

    const quiz = await Quiz.create({
      userId: alice.userId,
      subjectId: os,
      topic: 'Deadlock',
      questions: [{ question: 'Q?', options: ['a', 'b', 'c', 'd'], answerIndex: 0 }],
    });
    const base = { userId: alice.userId, quizId: quiz._id, subjectId: os };
    await QuizAttempt.create({ ...base, score: 0, total: 2, percent: 0, topicBreakdown: [{ topic: 'Deadlock', correct: 0, total: 2 }] });
    await QuizAttempt.create({ ...base, score: 2, total: 2, percent: 100, topicBreakdown: [{ topic: 'Deadlock', correct: 2, total: 2 }] });
    await StudyPlan.create({ userId: alice.userId, subjectId: os, weakTopics: [], days: [{ day: 1, focus: 'Deadlock', tasks: ['Read'] }] });

    const res = await request(app).get('/api/dashboard').set('Authorization', alice.token).expect(200);
    const osSummary = res.body.subjects.find((s) => s.id === os);
    assert.deepEqual(
      { docs: osSummary.documents, ready: osSummary.readyDocuments, taken: osSummary.quizzesTaken, avg: osSummary.averagePercent, last: osSummary.lastPercent },
      { docs: 2, ready: 1, taken: 2, avg: 50, last: 100 }
    );
    assert.deepEqual(osSummary.weakTopics, ['Deadlock']); // 2 of 4 = 50%
    assert.equal(res.body.subjects.find((s) => s.id === db).averagePercent, null);

    assert.deepEqual(res.body.recentAttempts.map((a) => a.percent), [100, 0]); // newest first
    assert.equal(res.body.recentAttempts[0].subjectName, 'OS');
    assert.equal(res.body.recentAttempts[0].quizTopic, 'Deadlock');
    assert.equal(res.body.studyPlan.subjectName, 'OS');
  });

  it("shows only the student's own data", async () => {
    const bob = await signUp('bob@example.com');
    await request(app).post('/api/subjects').set('Authorization', alice.token).send({ name: 'OS' });
    const res = await request(app).get('/api/dashboard').set('Authorization', bob.token).expect(200);
    assert.deepEqual(res.body, { subjects: [], recentAttempts: [], studyPlan: null });
  });
});
