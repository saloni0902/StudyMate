import { Router } from 'express';
import { deleteSummary, getSummary } from '../controllers/summaryController.js';
import { requireAuth } from '../middleware/auth.js';

// Routes for one summary by its id. Create and list live under
// /api/subjects/:id/summaries (routes/subjects.js).
const router = Router();
router.use(requireAuth);

router.get('/:id', getSummary);
router.delete('/:id', deleteSummary);

export default router;
