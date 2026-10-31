import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// All environment settings in one place, with safe local defaults.
const env = {
  port: Number(process.env.PORT) || 5050,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  mongoUri: process.env.MONGO_URI || '',
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8008',
  aiServiceKey: process.env.AI_SERVICE_KEY || 'change-me-dev-key',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-jwt-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  uploadDir: path.resolve(backendDir, process.env.UPLOAD_DIR || 'uploads'),
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB) || 20,
};

if (!process.env.JWT_SECRET && process.env.NODE_ENV !== 'test') {
  console.warn('JWT_SECRET not set: using a development secret. Set it in backend/.env.');
}

export default env;
