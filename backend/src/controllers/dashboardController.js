import Document from '../models/Document.js';
import FlashcardDeck from '../models/FlashcardDeck.js';
import Quiz from '../models/Quiz.js';
import QuizAttempt from '../models/QuizAttempt.js';
import StudyPlan from '../models/StudyPlan.js';
import Subject from '../models/Subject.js';
import { computeProgress } from '../services/progress.js';

const RECENT_ATTEMPTS = 5;

// GET /api/dashboard -> one overview across all of the student's subjects:
// per-subject stats, recent quiz results and the newest study plan.
export async function getDashboard(req, res) {
  const userId = req.userId;
  const [subjects, documents, attempts, decks, latestPlan] = await Promise.all([
    Subject.find({ userId }).sort({ createdAt: -1 }),
    Document.find({ userId }).select('subjectId status'),
    QuizAttempt.find({ userId }).sort({ createdAt: 1 }),
    FlashcardDeck.find({ userId }).select('subjectId cards.status'),
    StudyPlan.findOne({ userId }).sort({ createdAt: -1 }),
  ]);
  const quizzes = await Quiz.find({ _id: { $in: attempts.map((a) => a.quizId) } }).select('topic');
  const quizTopic = new Map(quizzes.map((q) => [String(q._id), q.topic]));
  const subjectName = new Map(subjects.map((s) => [String(s._id), s.name]));

  const summaries = subjects.map((s) => {
    const id = String(s._id);
    const docs = documents.filter((d) => String(d.subjectId) === id);
    const mine = attempts.filter((a) => String(a.subjectId) === id);
    const progress = computeProgress(
      mine.map((a) => ({ ...a.toObject(), id: String(a._id), quizTopic: '' }))
    );
    const cards = decks.filter((d) => String(d.subjectId) === id).flatMap((d) => d.cards);
    return {
      id,
      name: s.name,
      description: s.description,
      documents: docs.length,
      readyDocuments: docs.filter((d) => d.status === 'ready').length,
      quizzesTaken: progress.quizzesTaken,
      averagePercent: progress.quizzesTaken ? progress.averagePercent : null,
      lastPercent: mine.at(-1)?.percent ?? null,
      weakTopics: progress.weakTopics.map((t) => t.topic),
      flashcards: { total: cards.length, known: cards.filter((c) => c.status === 'known').length },
    };
  });

  const recentAttempts = attempts
    .slice(-RECENT_ATTEMPTS)
    .reverse()
    .map((a) => ({
      id: a._id,
      quizId: a.quizId,
      subjectId: a.subjectId,
      subjectName: subjectName.get(String(a.subjectId)) ?? '',
      quizTopic: quizTopic.get(String(a.quizId)) ?? '',
      score: a.score,
      total: a.total,
      percent: a.percent,
      createdAt: a.createdAt,
    }));

  res.json({
    subjects: summaries,
    recentAttempts,
    studyPlan: latestPlan
      ? { ...latestPlan.toJSON(), subjectId: latestPlan.subjectId, subjectName: subjectName.get(String(latestPlan.subjectId)) ?? '' }
      : null,
  });
}
