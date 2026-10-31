import mongoose from 'mongoose';

const citationSchema = new mongoose.Schema(
  {
    n: Number, // the [n] marker used in the answer text
    documentId: String,
    fileName: String,
    page: Number,
    snippet: String,
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    citations: { type: [citationSchema], default: [] },
    // false when the answer was "I couldn't find this in your notes"
    grounded: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// One conversation with a subject's notes.
const chatSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    title: { type: String, default: 'New chat' },
    messages: { type: [messageSchema], default: [] },
  },
  { timestamps: true }
);

function messageJSON(m) {
  return { id: m._id, role: m.role, content: m.content, citations: m.citations, grounded: m.grounded, createdAt: m.createdAt };
}

chatSchema.methods.toJSON = function toJSON() {
  return {
    id: this._id,
    subjectId: this.subjectId,
    title: this.title,
    messages: this.messages.map(messageJSON),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

chatSchema.methods.summary = function summary() {
  return { id: this._id, title: this.title, messageCount: this.messages.length, updatedAt: this.updatedAt };
};

chatSchema.statics.messageJSON = messageJSON;

export default mongoose.model('Chat', chatSchema);
