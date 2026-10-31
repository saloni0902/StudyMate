import mongoose from 'mongoose';
import Subject from '../models/Subject.js';
import Document from '../models/Document.js';
import Chat from '../models/Chat.js';
import Summary from '../models/Summary.js';
import Quiz from '../models/Quiz.js';
import QuizAttempt from '../models/QuizAttempt.js';
import FlashcardDeck from '../models/FlashcardDeck.js';
import StudyPlan from '../models/StudyPlan.js';
import { deleteSubjectData } from '../services/aiClient.js';
import { removeDocument } from '../services/documentService.js';
import HttpError from '../utils/httpError.js';

// Middleware for /:id routes: loads the subject into req.subject. Every
// query is filtered by userId, so a student can only reach their own subjects.
export async function loadSubject(req, res, next) {
  const { id } = req.params;
  const subject = mongoose.isValidObjectId(id) ? await Subject.findOne({ _id: id, userId: req.userId }) : null;
  if (!subject) throw new HttpError(404, 'Subject not found');
  req.subject = subject;
  next();
}

function duplicateNameError(err) {
  return err?.code === 11000 ? new HttpError(409, 'You already have a subject with this name') : err;
}

// GET /api/subjects
export async function listSubjects(req, res) {
  const subjects = await Subject.find({ userId: req.userId }).sort({ createdAt: -1 });
  res.json({ subjects });
}

// POST /api/subjects
export async function createSubject(req, res) {
  const { name, description = '' } = req.body;
  try {
    const subject = await Subject.create({ userId: req.userId, name, description });
    res.status(201).json({ subject });
  } catch (err) {
    throw duplicateNameError(err);
  }
}

// GET /api/subjects/:id
export async function getSubject(req, res) {
  res.json({ subject: req.subject });
}

// PATCH /api/subjects/:id
export async function updateSubject(req, res) {
  const { subject } = req;
  if (req.body.name !== undefined) subject.name = req.body.name;
  if (req.body.description !== undefined) subject.description = req.body.description;
  try {
    await subject.save();
  } catch (err) {
    throw duplicateNameError(err);
  }
  res.json({ subject });
}

// DELETE /api/subjects/:id -> also removes its documents and AI data
export async function deleteSubject(req, res) {
  const { subject } = req;
  const documents = await Document.find({ subjectId: subject._id });
  for (const doc of documents) await removeDocument(doc);
  await deleteSubjectData(String(subject._id)).catch((err) =>
    console.warn(`AI service cleanup failed for subject ${subject._id}: ${err.message}`)
  );
  await Chat.deleteMany({ subjectId: subject._id });
  await Summary.deleteMany({ subjectId: subject._id });
  await QuizAttempt.deleteMany({ subjectId: subject._id });
  await Quiz.deleteMany({ subjectId: subject._id });
  await FlashcardDeck.deleteMany({ subjectId: subject._id });
  await StudyPlan.deleteMany({ subjectId: subject._id });
  await subject.deleteOne();
  res.status(204).end();
}
