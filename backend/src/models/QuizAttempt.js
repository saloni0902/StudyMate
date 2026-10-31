import mongoose from 'mongoose';

// One submission of a quiz. topicBreakdown feeds the progress page and
// weak-topic detection (stage 7).
const quizAttemptSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true, index: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    answers: { type: [Number], default: [] }, // chosen option per question, -1 = skipped
    score: { type: Number, required: true },
    total: { type: Number, required: true },
    percent: { type: Number, required: true },
    topicBreakdown: {
      type: [{ topic: String, correct: Number, total: Number, _id: false }],
      default: [],
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

quizAttemptSchema.methods.summary = function summary() {
  return { id: this._id, score: this.score, total: this.total, percent: this.percent, createdAt: this.createdAt };
};

export default mongoose.model('QuizAttempt', quizAttemptSchema);
