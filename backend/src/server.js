import app from './app.js';
import env from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { resumeProcessing } from './services/documentService.js';

async function start() {
  await connectDB();
  const server = app.listen(env.port, () => {
    console.log(`StudyMate API running on http://localhost:${env.port}`);
  });
  resumeProcessing().catch((err) => console.error('Could not resume document processing:', err.message));

  // Close the database cleanly so its files are ready for the next start.
  const shutdown = async () => {
    server.close();
    await disconnectDB().catch((err) => console.error('Database shutdown failed:', err.message));
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// A background task failing (e.g. document processing) shouldn't stop the server silently.
process.on('unhandledRejection', (err) => console.error('Unhandled error:', err));

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
