import FlashcardDeck from '../models/FlashcardDeck.js';
import Quiz from '../models/Quiz.js';
import QuizAttempt from '../models/QuizAttempt.js';
import StudyPlan from '../models/StudyPlan.js';
import { generateStudyPlan } from '../services/aiClient.js';
import { computeProgress, planTopics } from '../services/progress.js';
import HttpError from '../utils/httpError.js';

async function subjectProgress(subjectId, userId) {
  const attempts = await QuizAttempt.find({ subjectId, userId }).sort({ createdAt: 1 });
  const quizzes = await Quiz.find({ _id: { $in: attempts.map((a) => a.quizId) } }).select('topic');
  const topicOf = new Map(quizzes.map((q) => [String(q._id), q.topic]));

  return computeProgress(
    attempts.map((a) => ({
      id: String(a._id),
      quizTopic: topicOf.get(String(a.quizId)) ?? '',
      score: a.score,
      total: a.total,
      percent: a.percent,
      topicBreakdown: a.topicBreakdown,
      createdAt: a.createdAt,
    }))
  );
}

// GET /api/subjects/:id/progress -> scores over time, topic accuracy, weak
// topics, flashcard totals and the latest study plan
export async function getProgress(req, res) {
  const { subject } = req;
  const progress = await subjectProgress(subject._id, req.userId);

  const decks = await FlashcardDeck.find({ subjectId: subject._id, userId: req.userId });
  const flashcards = decks.reduce(
    (sum, d) => {
      const c = d.counts();
      return { decks: sum.decks + 1, total: sum.total + c.total, known: sum.known + c.known };
    },
    { decks: 0, total: 0, known: 0 }
  );

  const plan = await StudyPlan.findOne({ subjectId: subject._id, userId: req.userId }).sort({ createdAt: -1 });
  res.json({ ...progress, flashcards, studyPlan: plan });
}

// POST /api/subjects/:id/study-plan  { days }
export async function createStudyPlan(req, res) {
  const { subject } = req;
  const progress = await subjectProgress(subject._id, req.userId);
  if (!progress.quizzesTaken) throw new HttpError(409, 'Take at least one quiz first, so the plan knows your weak topics');

  const weakTopics = planTopics(progress);
  const result = await generateStudyPlan({ subjectId: String(subject._id), weakTopics, days: req.body.days ?? 5 });

  const plan = await StudyPlan.create({ userId: req.userId, subjectId: subject._id, weakTopics, days: result.days });
  res.status(201).json({ studyPlan: plan });
}
