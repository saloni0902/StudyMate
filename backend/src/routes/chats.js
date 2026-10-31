import { Router } from 'express';
import { body } from 'express-validator';
import { deleteChat, getChat, sendMessage } from '../controllers/chatController.js';
import { requireAuth } from '../middleware/auth.js';
import validate from '../middleware/validate.js';

// Routes for one chat by its id. List and create live under
// /api/subjects/:id/chats (routes/subjects.js).
const router = Router();
router.use(requireAuth);

router.get('/:id', getChat);
router.delete('/:id', deleteChat);
router.post(
  '/:id/messages',
  body('content')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Type a question first')
    .isLength({ max: 2000 })
    .withMessage('Questions must be 2000 characters or fewer'),
  validate,
  sendMessage
);

export default router;
