import mongoose from 'mongoose';

const cardSchema = new mongoose.Schema(
  {
    front: { type: String, required: true },
    back: { type: String, required: true },
    topic: { type: String, default: 'General' },
    source: { documentId: String, fileName: String, page: Number },
    // new = not reviewed yet, known = "I knew it", review = "review again"
    status: { type: String, enum: ['new', 'known', 'review'], default: 'new' },
  },
  { _id: false }
);

const flashcardDeckSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    topic: { type: String, default: '' }, // '' = the whole subject
    cards: { type: [cardSchema], required: true },
  },
  { timestamps: true }
);

flashcardDeckSchema.methods.counts = function counts() {
  const by = (status) => this.cards.filter((c) => c.status === status).length;
  return { total: this.cards.length, known: by('known'), review: by('review'), new: by('new') };
};

flashcardDeckSchema.methods.toJSON = function toJSON() {
  return {
    id: this._id,
    subjectId: this.subjectId,
    topic: this.topic,
    cards: this.cards.map((c, index) => ({
      index,
      front: c.front,
      back: c.back,
      topic: c.topic,
      source: c.source,
      status: c.status,
    })),
    counts: this.counts(),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export default mongoose.model('FlashcardDeck', flashcardDeckSchema);
