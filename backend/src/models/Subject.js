import mongoose from 'mongoose';

// A subject (e.g. "Operating Systems") groups a student's documents.
// The AI service keeps one FAISS index per subject.
const subjectSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 300, default: '' },
  },
  { timestamps: true }
);

// A student can't have two subjects with the same name.
subjectSchema.index({ userId: 1, name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

subjectSchema.methods.toJSON = function toJSON() {
  return {
    id: this._id,
    name: this.name,
    description: this.description,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export default mongoose.model('Subject', subjectSchema);
