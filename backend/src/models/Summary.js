import mongoose from 'mongoose';

const citationSchema = new mongoose.Schema(
  { n: Number, documentId: String, fileName: String, page: Number, snippet: String },
  { _id: false }
);

// A saved summary of one document or one topic, so students can come back
// to it without spending another Gemini request.
const summarySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    kind: { type: String, enum: ['document', 'topic'], required: true },
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
    title: { type: String, required: true }, // file name or topic
    length: { type: String, enum: ['short', 'detailed'], default: 'short' },
    content: { type: String, required: true },
    citations: { type: [citationSchema], default: [] },
    grounded: { type: Boolean, default: true },
    truncated: { type: Boolean, default: false },
  },
  { timestamps: true }
);

summarySchema.methods.toJSON = function toJSON() {
  return {
    id: this._id,
    subjectId: this.subjectId,
    kind: this.kind,
    documentId: this.documentId,
    title: this.title,
    length: this.length,
    content: this.content,
    citations: this.citations,
    grounded: this.grounded,
    truncated: this.truncated,
    createdAt: this.createdAt,
  };
};

export default mongoose.model('Summary', summarySchema);
