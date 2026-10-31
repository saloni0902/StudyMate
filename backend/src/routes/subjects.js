import { Router } from 'express';
import { body } from 'express-validator';
import {
  loadSubject,
  listSubjects,
  createSubject,
  getSubject,
  updateSubject,
  deleteSubject,
} from '../controllers/subjectController.js';
import { listDocuments, uploadDocument } from '../controllers/documentController.js';
import { createChat, listChats } from '../controllers/chatController.js';
import { createSummary, listSummaries } from '../controllers/summaryController.js';
import { createQuiz, listQuizzes, listTopics } from '../controllers/quizController.js';
import { createDeck, listDecks } from '../controllers/flashcardController.js';
import { createStudyPlan, getProgress } from '../controllers/progressController.js';
import { requireAuth } from '../middleware/auth.js';
import uploadPdf from '../middleware/upload.js';
import validate from '../middleware/validate.js';

const router = Router();
router.use(requireAuth);

const description = body('description')
  .optional()
  .isString()
  .trim()
  .isLength({ max: 300 })
  .withMessage('Description must be 300 characters or fewer');

router.get('/', listSubjects);

router.post(
  '/',
  body('name').isString().trim().notEmpty().withMessage('Subject name is required').isLength({ max: 80 }).withMessage('Subject name is too long'),
  description,
  validate,
  createSubject
);

router.get('/:id', loadSubject, getSubject);

router.patch(
  '/:id',
  loadSubject,
  body('name').optional().isString().trim().notEmpty().withMessage('Subject name cannot be empty').isLength({ max: 80 }).withMessage('Subject name is too long'),
  description,
  validate,
  updateSubject
);

router.delete('/:id', loadSubject, deleteSubject);

// Documents in a subject. loadSubject runs before the upload so files are
// only saved for the student's own subjects.
router.get('/:id/documents', loadSubject, listDocuments);
router.post('/:id/documents', loadSubject, uploadPdf, uploadDocument);

// Chats with a subject's notes
router.get('/:id/chats', loadSubject, listChats);
router.post('/:id/chats', loadSubject, createChat);

// Summaries of a document or a topic
router.get('/:id/summaries', loadSubject, listSummaries);
router.post(
  '/:id/summaries',
  loadSubject,
  body('documentId').optional().isString(),
  body('topic').optional().isString().trim().isLength({ min: 2, max: 200 }).withMessage('Topic must be 2 to 200 characters'),
  body().custom((b) => Boolean(b.documentId) !== Boolean(b.topic)).withMessage('Choose a document or type a topic'),
  body('length').optional().isIn(['short', 'detailed']).withMessage('Length must be short or detailed'),
  validate,
  createSummary
);

// Topics and quizzes
router.get('/:id/topics', loadSubject, listTopics);
router.get('/:id/quizzes', loadSubject, listQuizzes);
router.post(
  '/:id/quizzes',
  loadSubject,
  body('topic').optional().isString().trim().isLength({ max: 200 }).withMessage('Topic must be 200 characters or fewer'),
  body('topic').optional({ values: 'falsy' }).isLength({ min: 2 }).withMessage('Topic must be at least 2 characters'),
  body('count').optional().isInt({ min: 3, max: 15 }).withMessage('Choose between 3 and 15 questions').toInt(),
  body('difficulty').optional().isIn(['easy', 'medium', 'hard']).withMessage('Difficulty must be easy, medium or hard'),
  validate,
  createQuiz
);

// Flashcard decks
router.get('/:id/decks', loadSubject, listDecks);
router.post(
  '/:id/decks',
  loadSubject,
  body('topic').optional().isString().trim().isLength({ max: 200 }).withMessage('Topic must be 200 characters or fewer'),
  body('topic').optional({ values: 'falsy' }).isLength({ min: 2 }).withMessage('Topic must be at least 2 characters'),
  body('count').optional().isInt({ min: 3, max: 20 }).withMessage('Choose between 3 and 20 cards').toInt(),
  validate,
  createDeck
);

// Progress, weak topics and study plans
router.get('/:id/progress', loadSubject, getProgress);
router.post(
  '/:id/study-plan',
  loadSubject,
  body('days').optional().isInt({ min: 3, max: 7 }).withMessage('Choose between 3 and 7 days').toInt(),
  validate,
  createStudyPlan
);

export default router;
