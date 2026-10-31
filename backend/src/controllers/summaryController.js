import mongoose from 'mongoose';
import Document from '../models/Document.js';
import Summary from '../models/Summary.js';
import { summarize } from '../services/aiClient.js';
import HttpError from '../utils/httpError.js';

async function findOwnSummary(req) {
  const { id } = req.params;
  const summary = mongoose.isValidObjectId(id) ? await Summary.findOne({ _id: id, userId: req.userId }) : null;
  if (!summary) throw new HttpError(404, 'Summary not found');
  return summary;
}

// POST /api/subjects/:id/summaries  { documentId } or { topic }, plus { length }
export async function createSummary(req, res) {
  const { subject } = req;
  const { documentId, topic, length = 'short' } = req.body;
  let target;

  if (documentId) {
    const doc = mongoose.isValidObjectId(documentId)
      ? await Document.findOne({ _id: documentId, subjectId: subject._id, userId: req.userId })
      : null;
    if (!doc) throw new HttpError(404, 'Document not found in this subject');
    if (doc.status !== 'ready') throw new HttpError(409, 'This document has not finished processing yet');
    target = { kind: 'document', documentId: doc._id, title: doc.originalName };
  } else {
    const ready = await Document.exists({ subjectId: subject._id, userId: req.userId, status: 'ready' });
    if (!ready) throw new HttpError(409, 'Upload a PDF to this subject and wait until it is ready first');
    target = { kind: 'topic', title: topic };
  }

  const result = await summarize({
    subjectId: String(subject._id),
    ...(target.kind === 'document' ? { documentId: String(target.documentId) } : { topic }),
    length,
  });
  // "I couldn't find this in your notes" is shown as a message, not saved.
  if (!result.grounded) throw new HttpError(422, result.summary, 'NOT_IN_NOTES');

  const summary = await Summary.create({
    userId: req.userId,
    subjectId: subject._id,
    ...target,
    length,
    content: result.summary,
    citations: result.citations,
    grounded: result.grounded,
    truncated: result.truncated,
  });
  res.status(201).json({ summary });
}

// GET /api/subjects/:id/summaries (without the full text, for the list)
export async function listSummaries(req, res) {
  const summaries = await Summary.find({ subjectId: req.subject._id, userId: req.userId })
    .select('kind title length grounded createdAt')
    .sort({ createdAt: -1 });
  res.json({
    summaries: summaries.map((s) => ({
      id: s._id,
      kind: s.kind,
      title: s.title,
      length: s.length,
      grounded: s.grounded,
      createdAt: s.createdAt,
    })),
  });
}

// GET /api/summaries/:id
export async function getSummary(req, res) {
  res.json({ summary: await findOwnSummary(req) });
}

// DELETE /api/summaries/:id
export async function deleteSummary(req, res) {
  await (await findOwnSummary(req)).deleteOne();
  res.status(204).end();
}
