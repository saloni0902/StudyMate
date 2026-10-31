import { Router } from 'express';
import { body } from 'express-validator';
import { deleteDeck, getDeck, markCard, resetDeck } from '../controllers/flashcardController.js';
import { requireAuth } from '../middleware/auth.js';
import validate from '../middleware/validate.js';

// Routes for one flashcard deck by id. Create and list live under
// /api/subjects/:id/decks (routes/subjects.js).
const router = Router();
router.use(requireAuth);

router.get('/:id', getDeck);
router.delete('/:id', deleteDeck);
router.post('/:id/reset', resetDeck);
router.patch(
  '/:id/cards/:index',
  body('status').isIn(['known', 'review', 'new']).withMessage('Status must be known, review or new'),
  validate,
  markCard
);

export default router;
