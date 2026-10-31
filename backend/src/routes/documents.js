import { Router } from 'express';
import {
  deleteDocument,
  getDocument,
  getDocumentText,
  refreshTopics,
  retryDocument,
} from '../controllers/documentController.js';
import { requireAuth } from '../middleware/auth.js';

// Routes for one document by its id. Upload and list live under
// /api/subjects/:id/documents (routes/subjects.js).
const router = Router();
router.use(requireAuth);

router.get('/:id', getDocument);
router.get('/:id/text', getDocumentText);
router.post('/:id/retry', retryDocument);
router.post('/:id/topics', refreshTopics);
router.delete('/:id', deleteDocument);

export default router;
