import { Router } from 'express';
import { body } from 'express-validator';
import { deleteQuiz, getAttempt, getQuiz, submitQuiz } from '../controllers/quizController.js';
import { requireAuth } from '../middleware/auth.js';
import validate from '../middleware/validate.js';

// Routes for one quiz or attempt by id. Create and list live under
// /api/subjects/:id/quizzes (routes/subjects.js).
export const quizRoutes = Router();
quizRoutes.use(requireAuth);
quizRoutes.get('/:id', getQuiz);
quizRoutes.delete('/:id', deleteQuiz);
quizRoutes.post(
  '/:id/submit',
  body('answers').isArray({ max: 50 }).withMessage('answers must be a list'),
  body('answers.*').isInt({ min: -1, max: 3 }).withMessage('Each answer must be an option number or -1').toInt(),
  validate,
  submitQuiz
);

export const attemptRoutes = Router();
attemptRoutes.use(requireAuth);
attemptRoutes.get('/:id', getAttempt);
