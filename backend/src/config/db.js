import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import env from './env.js';

let memoryServer = null;

// Where the built-in development database keeps its files.
const devDbPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.data/mongo');

export function mongoStartupErrorMessage(err) {
  const message = String(err?.message || err || '');
  const code = String(err?.code || '');

  const isWindowsRuntimeIssue =
    /3221225781|UnexpectedCloseError|vc_redist|Visual C\+\+ Redistributable/i.test(message) ||
    /3221225781/.test(code);

  if (isWindowsRuntimeIssue) {
    return [
      'MongoDB could not start because the Windows C++ runtime is missing.',
      'Install the Microsoft Visual C++ Redistributable (x64): https://aka.ms/vs/17/release/vc_redist.x64.exe',
      'Then restart your computer and run npm run dev again.',
      'If you already have MongoDB running elsewhere, set MONGO_URI in backend/.env to skip the built-in database.',
    ].join(' ');
  }

  return message || 'MongoDB failed to start.';
}

// Starts a MongoDB that ships with the project (no install needed) and keeps
// its data in backend/.data/mongo, so accounts and subjects survive restarts.
async function startDevDatabase() {
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  fs.mkdirSync(devDbPath, { recursive: true });

  // After a quick restart the previous database may still be shutting down
  // and holding its files, so try a few times.
  for (let attempt = 1; ; attempt++) {
    try {
      memoryServer = await MongoMemoryServer.create({
        instance: { dbPath: devDbPath, storageEngine: 'wiredTiger' },
      });
      return memoryServer.getUri('studymate');
    } catch (err) {
      if (attempt >= 5) {
        throw new Error(mongoStartupErrorMessage(err), { cause: err });
      }
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

// Connect to MONGO_URI, or to the built-in development database when it is empty.
export async function connectDB() {
  let uri = env.mongoUri;
  if (!uri) {
    uri = await startDevDatabase();
    console.log(`MONGO_URI not set: using the built-in development database (data in ${devDbPath}).`);
  }
  await mongoose.connect(uri);
  console.log(`MongoDB connected (${mongoose.connection.name})`);
}

export async function disconnectDB() {
  await mongoose.disconnect();
  // doCleanup: false keeps the data files for next time.
  if (memoryServer) await memoryServer.stop({ doCleanup: false });
}

export function dbStatus() {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return states[mongoose.connection.readyState] || 'unknown';
}
