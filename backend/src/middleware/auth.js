import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
import env from '../config/env.js';
import HttpError from '../utils/httpError.js';

export function signToken(user) {
  return jwt.sign({ sub: String(user._id) }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

// Requires "Authorization: Bearer <token>" for an account that still exists,
// and sets req.userId. A 401 makes the frontend log out.
export async function requireAuth(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new HttpError(401, 'Please log in to continue');
  }

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw new HttpError(401, 'Your session has expired, please log in again');
  }

  // A valid token whose account is gone (e.g. the database was reset).
  if (!mongoose.isValidObjectId(payload.sub) || !(await User.exists({ _id: payload.sub }))) {
    throw new HttpError(401, 'Your account was not found, please log in again');
  }

  req.userId = payload.sub;
  next();
}
