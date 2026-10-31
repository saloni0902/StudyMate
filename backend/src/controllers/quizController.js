import mongoose from 'mongoose';
import Document from '../models/Document.js';
import Quiz from '../models/Quiz.js';
import QuizAttempt from '../models/QuizAttempt.js';
import { generateQuiz } from '../services/aiClient.js';
import { reviewQuestions, scoreQuiz } from '../services/scoring.js';
import HttpError from '../utils/httpError.js';

async function findOwn(Model, req, id, label) {
  const doc = mongoose.isValidObjectId(id) ? await Model.findOne({ _id: id, userId: req.userId }) : null;
  if (!doc) throw new HttpError(404, `${label} not found`);
  return doc;
}

// Every topic found in the subject's ready documents, for the topic picker
// and so question topics use consistent names.
async function subjectTopics(subjectId, userId) {
  const docs = await Document.find({ subjectId, userId, status: 'ready' }).select('topics');
  return [...new Set(docs.flatMap((d) => d.topics))];
}

function attemptResult(quiz, attempt) {
  return {
    attempt: { ...attempt.summary(), topicBreakdown: attempt.topicBreakdown },
    quiz: { id: quiz._id, topic: quiz.topic, difficulty: quiz.difficulty },
    questions: reviewQuestions(quiz.questions, attempt.answers),
  };
}

// GET /api/subjects/:id/topics
export async function listTopics(req, res) {
  res.json({ topics: await subjectTopics(req.subject._id, req.userId) });
}

// POST /api/subjects/:id/quizzes  { topic?, count, difficulty }
export async function createQuiz(req, res) {
  const { subject } = req;
  const { topic = '', count = 10, difficulty = 'medium' } = req.body;

  const ready = await Document.exists({ subjectId: subject._id, userId: req.userId, status: 'ready' });
  if (!ready) throw new HttpError(409, 'Upload a PDF to this subject and wait until it is ready first');

  const result = await generateQuiz({
    subjectId: String(subject._id),
    ...(topic ? { topic } : {}),
    count,
    difficulty,
    knownTopics: await subjectTopics(subject._id, req.userId),
  }).catch((err) => {
    // "couldn't find X in your notes" comes back as 422 from the AI service.
    if (err.aiStatus === 422) throw new HttpError(422, err.message, 'NOT_IN_NOTES');
    throw err;
  });

  const quiz = await Quiz.create({
    userId: req.userId,
    subjectId: subject._id,
    topic,
    difficulty,
    questions: result.questions,
  });
  res.status(201).json({ quiz: quiz.forStudent() });
}

// GET /api/subjects/:id/quizzes -> quizzes with their best and latest scores
export async function listQuizzes(req, res) {
  const quizzes = await Quiz.find({ subjectId: req.subject._id, userId: req.userId }).sort({ createdAt: -1 });
  const attempts = await QuizAttempt.find({ quizId: { $in: quizzes.map((q) => q._id) } }).sort({ createdAt: 1 });

  res.json({
    quizzes: quizzes.map((q) => {
      const mine = attempts.filter((a) => a.quizId.equals(q._id));
      return {
        id: q._id,
        topic: q.topic,
        difficulty: q.difficulty,
        questionCount: q.questions.length,
        createdAt: q.createdAt,
        attempts: mine.length,
        latest: mine.at(-1)?.summary() ?? null,
        best: mine.length ? Math.max(...mine.map((a) => a.percent)) : null,
      };
    }),
  });
}

// GET /api/quizzes/:id -> the quiz to take (no answers) and its attempts
export async function getQuiz(req, res) {
  const quiz = await findOwn(Quiz, req, req.params.id, 'Quiz');
  const attempts = await QuizAttempt.find({ quizId: quiz._id }).sort({ createdAt: -1 });
  res.json({ quiz: quiz.forStudent(), attempts: attempts.map((a) => a.summary()) });
}

// POST /api/quizzes/:id/submit  { answers: [optionIndex | -1] }
export async function submitQuiz(req, res) {
  const quiz = await findOwn(Quiz, req, req.params.id, 'Quiz');
  const { answers } = req.body;
  if (answers.length !== quiz.questions.length) {
    throw new HttpError(400, `Send one answer per question (${quiz.questions.length})`);
  }

  const scored = scoreQuiz(quiz.questions, answers);
  const attempt = await QuizAttempt.create({
    userId: req.userId,
    quizId: quiz._id,
    subjectId: quiz.subjectId,
    ...scored,
  });
  res.status(201).json(attemptResult(quiz, attempt));
}

// GET /api/quiz-attempts/:id -> review a past attempt
export async function getAttempt(req, res) {
  const attempt = await findOwn(QuizAttempt, req, req.params.id, 'Attempt');
  const quiz = await findOwn(Quiz, req, attempt.quizId, 'Quiz');
  res.json(attemptResult(quiz, attempt));
}

// DELETE /api/quizzes/:id (and its attempts)
export async function deleteQuiz(req, res) {
  const quiz = await findOwn(Quiz, req, req.params.id, 'Quiz');
  await QuizAttempt.deleteMany({ quizId: quiz._id });
  await quiz.deleteOne();
  res.status(204).end();
}
