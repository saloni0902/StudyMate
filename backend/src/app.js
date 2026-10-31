import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import env from './config/env.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import subjectRoutes from './routes/subjects.js';
import documentRoutes from './routes/documents.js';
import chatRoutes from './routes/chats.js';
import summaryRoutes from './routes/summaries.js';
import { attemptRoutes, quizRoutes } from './routes/quizzes.js';
import deckRoutes from './routes/decks.js';
import dashboardRoutes from './routes/dashboard.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

// The Express app, kept separate from server.js so tests can import it
// without opening a port.
const app = express();

app.use(cors({ origin: env.clientOrigin }));
app.use(express.json({ limit: '1mb' }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/summaries', summaryRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/quiz-attempts', attemptRoutes);
app.use('/api/decks', deckRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use('/api', notFound);
app.use(errorHandler);

export default app;
