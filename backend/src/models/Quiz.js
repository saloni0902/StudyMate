import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    options: { type: [String], required: true },
    answerIndex: { type: Number, required: true }, // never sent before the quiz is submitted
    topic: { type: String, default: 'General' },
    explanation: { type: String, default: '' },
    source: { documentId: String, fileName: String, page: Number },
  },
  { _id: false }
);

// A generated quiz. Students can take it more than once (see QuizAttempt).
const quizSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    topic: { type: String, default: '' }, // '' = the whole subject
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    questions: { type: [questionSchema], required: true },
  },
  { timestamps: true }
);

// What the student sees while taking the quiz: no answers or explanations.
quizSchema.methods.forStudent = function forStudent() {
  return {
    id: this._id,
    subjectId: this.subjectId,
    topic: this.topic,
    difficulty: this.difficulty,
    questions: this.questions.map((q) => ({ question: q.question, options: q.options, topic: q.topic })),
    createdAt: this.createdAt,
  };
};

quizSchema.methods.toJSON = quizSchema.methods.forStudent;

export default mongoose.model('Quiz', quizSchema);
