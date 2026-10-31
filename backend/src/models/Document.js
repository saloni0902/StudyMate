import mongoose from 'mongoose';

// One uploaded PDF. The file lives in uploads/, its extracted text lives in
// the AI service; this record tracks where it is and whether it's usable.
const documentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    originalName: { type: String, required: true },
    storedName: { type: String, required: true },
    size: { type: Number, required: true },
    status: { type: String, enum: ['processing', 'ready', 'failed'], default: 'processing' },
    error: { type: String, default: '' },
    pages: { type: Number, default: 0 },
    emptyPages: { type: [Number], default: [] },
    charCount: { type: Number, default: 0 },
    // Filled from stage 4: number of RAG chunks and topics the LLM finds.
    chunkCount: { type: Number, default: 0 },
    topics: { type: [String], default: [] },
  },
  { timestamps: true }
);

documentSchema.methods.toJSON = function toJSON() {
  return {
    id: this._id,
    subjectId: this.subjectId,
    originalName: this.originalName,
    size: this.size,
    status: this.status,
    error: this.error,
    pages: this.pages,
    emptyPages: this.emptyPages,
    charCount: this.charCount,
    chunkCount: this.chunkCount,
    topics: this.topics,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export default mongoose.model('Document', documentSchema);
