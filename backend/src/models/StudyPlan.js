import mongoose from 'mongoose';

const sourceSchema = new mongoose.Schema({ documentId: String, fileName: String, page: Number }, { _id: false });

// A generated revision plan for a subject. The newest one is shown on the
// progress page.
const studyPlanSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    weakTopics: { type: [{ topic: String, percent: Number, _id: false }], default: [] },
    days: {
      type: [{ day: Number, focus: String, tasks: [String], sources: [sourceSchema], _id: false }],
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

studyPlanSchema.methods.toJSON = function toJSON() {
  return { id: this._id, weakTopics: this.weakTopics, days: this.days, createdAt: this.createdAt };
};

export default mongoose.model('StudyPlan', studyPlanSchema);
