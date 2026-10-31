import { Router } from 'express';
import { dbStatus } from '../config/db.js';
import { aiHealth } from '../services/aiClient.js';

const router = Router();

// GET /api/health -> status of this API, MongoDB and the AI service.
router.get('/', async (req, res) => {
  res.json({
    status: 'ok',
    database: dbStatus(),
    aiService: await aiHealth(),
  });
});

export default router;
