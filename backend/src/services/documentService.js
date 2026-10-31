import fs from 'node:fs/promises';
import path from 'node:path';
import env from '../config/env.js';
import Document from '../models/Document.js';
import Summary from '../models/Summary.js';
import { deleteDocumentData, ingestDocument } from './aiClient.js';

export const filePathOf = (doc) => path.join(env.uploadDir, doc.storedName);

// Sends a saved PDF to the AI service and records the result. Runs in the
// background after the upload response, so it never throws.
export async function processDocument(doc) {
  try {
    const result = await ingestDocument({
      subjectId: String(doc.subjectId),
      documentId: String(doc._id),
      filePath: filePathOf(doc),
      fileName: doc.originalName,
    });
    Object.assign(doc, {
      status: 'ready',
      error: '',
      pages: result.pages,
      emptyPages: result.emptyPages,
      charCount: result.charCount,
      chunkCount: result.chunkCount,
      topics: result.topics || [],
    });
  } catch (err) {
    doc.status = 'failed';
    doc.error = err.message || 'Processing failed';
  }

  try {
    await doc.save();
  } catch (err) {
    // The document may have been deleted while it was processing.
    if (err.name !== 'DocumentNotFoundError') console.error('Could not save document status:', err.message);
  }
}

// Removes the PDF, its extracted text, its summaries and its database record.
export async function removeDocument(doc) {
  await fs.rm(filePathOf(doc), { force: true });
  await deleteDocumentData(String(doc.subjectId), String(doc._id)).catch((err) =>
    console.warn(`AI service cleanup failed for document ${doc._id}: ${err.message}`)
  );
  await Summary.deleteMany({ documentId: doc._id });
  await doc.deleteOne();
}

// Documents left "processing" by a crash or restart are processed again.
export async function resumeProcessing() {
  const stuck = await Document.find({ status: 'processing' });
  for (const doc of stuck) await processDocument(doc);
  if (stuck.length) console.log(`Re-processed ${stuck.length} interrupted document(s)`);
}
