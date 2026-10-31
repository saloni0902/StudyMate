import mongoose from 'mongoose';
import Document from '../models/Document.js';
import { detectTopics, getDocumentPages } from '../services/aiClient.js';
import { processDocument, removeDocument } from '../services/documentService.js';
import HttpError from '../utils/httpError.js';

async function findOwnDocument(req) {
  const { id } = req.params;
  const doc = mongoose.isValidObjectId(id) ? await Document.findOne({ _id: id, userId: req.userId }) : null;
  if (!doc) throw new HttpError(404, 'Document not found');
  return doc;
}

// POST /api/subjects/:id/documents (req.subject set by loadSubject, req.file by uploadPdf)
export async function uploadDocument(req, res) {
  const doc = await Document.create({
    userId: req.userId,
    subjectId: req.subject._id,
    originalName: req.file.originalname,
    storedName: req.file.filename,
    size: req.file.size,
  });

  // Reply straight away; the page polls until status is ready or failed.
  res.status(201).json({ document: doc });
  processDocument(doc);
}

// GET /api/subjects/:id/documents
export async function listDocuments(req, res) {
  const documents = await Document.find({ subjectId: req.subject._id, userId: req.userId }).sort({ createdAt: -1 });
  res.json({ documents });
}

// GET /api/documents/:id
export async function getDocument(req, res) {
  res.json({ document: await findOwnDocument(req) });
}

// GET /api/documents/:id/text -> extracted text, page by page
export async function getDocumentText(req, res) {
  const doc = await findOwnDocument(req);
  if (doc.status !== 'ready') throw new HttpError(409, 'This document has not been processed yet');
  const { pages } = await getDocumentPages(String(doc.subjectId), String(doc._id));
  res.json({ document: doc, pages });
}

// POST /api/documents/:id/retry -> process a failed document again
export async function retryDocument(req, res) {
  const doc = await findOwnDocument(req);
  if (doc.status !== 'failed') throw new HttpError(409, 'Only failed documents can be retried');
  doc.status = 'processing';
  doc.error = '';
  await doc.save();
  res.json({ document: doc });
  processDocument(doc);
}

// POST /api/documents/:id/topics -> find the document's topics again
export async function refreshTopics(req, res) {
  const doc = await findOwnDocument(req);
  if (doc.status !== 'ready') throw new HttpError(409, 'This document has not been processed yet');
  const { topics } = await detectTopics(String(doc.subjectId), String(doc._id));
  doc.topics = topics;
  await doc.save();
  res.json({ document: doc });
}

// DELETE /api/documents/:id
export async function deleteDocument(req, res) {
  await removeDocument(await findOwnDocument(req));
  res.status(204).end();
}
