import User from '../models/User.js';
import { signToken } from '../middleware/auth.js';
import HttpError from '../utils/httpError.js';

// POST /api/auth/register
export async function register(req, res) {
  const { name, email, password } = req.body;

  if (await User.exists({ email })) {
    throw new HttpError(409, 'An account with this email already exists');
  }

  const user = await User.create({ name, email, passwordHash: await User.hashPassword(password) });
  res.status(201).json({ token: signToken(user), user });
}

// POST /api/auth/login
export async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash');

  // Same message for unknown email and wrong password, so emails can't be guessed.
  if (!user || !(await user.checkPassword(password))) {
    throw new HttpError(401, 'Incorrect email or password');
  }

  res.json({ token: signToken(user), user });
}

// GET /api/auth/me
export async function me(req, res) {
  const user = await User.findById(req.userId);
  if (!user) throw new HttpError(401, 'Account not found, please log in again');
  res.json({ user });
}
