import { validationResult } from 'express-validator';
import HttpError from '../utils/httpError.js';

// Runs after express-validator checks; sends the first problem as a 400.
export default function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new HttpError(400, errors.array()[0].msg, 'VALIDATION_ERROR');
  }
  next();
}
