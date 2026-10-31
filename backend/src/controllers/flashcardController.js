import mongoose from 'mongoose';
import Document from '../models/Document.js';
import FlashcardDeck from '../models/FlashcardDeck.js';
import { generateFlashcards } from '../services/aiClient.js';
import HttpError from '../utils/httpError.js';

async function findOwnDeck(req) {
  const { id } = req.params;
  const deck = mongoose.isValidObjectId(id) ? await FlashcardDeck.findOne({ _id: id, userId: req.userId }) : null;
  if (!deck) throw new HttpError(404, 'Flashcard deck not found');
  return deck;
}

// POST /api/subjects/:id/decks  { topic?, count }
export async function createDeck(req, res) {
  const { subject } = req;
  const { topic = '', count = 10 } = req.body;

  const docs = await Document.find({ subjectId: subject._id, userId: req.userId, status: 'ready' }).select('topics');
  if (!docs.length) throw new HttpError(409, 'Upload a PDF to this subject and wait until it is ready first');

  const result = await generateFlashcards({
    subjectId: String(subject._id),
    ...(topic ? { topic } : {}),
    count,
    knownTopics: [...new Set(docs.flatMap((d) => d.topics))],
  }).catch((err) => {
    if (err.aiStatus === 422) throw new HttpError(422, err.message, 'NOT_IN_NOTES');
    throw err;
  });

  const deck = await FlashcardDeck.create({ userId: req.userId, subjectId: subject._id, topic, cards: result.cards });
  res.status(201).json({ deck });
}

// GET /api/subjects/:id/decks (without the cards)
export async function listDecks(req, res) {
  const decks = await FlashcardDeck.find({ subjectId: req.subject._id, userId: req.userId }).sort({ updatedAt: -1 });
  res.json({
    decks: decks.map((d) => ({ id: d._id, topic: d.topic, counts: d.counts(), createdAt: d.createdAt, updatedAt: d.updatedAt })),
  });
}

// GET /api/decks/:id
export async function getDeck(req, res) {
  res.json({ deck: await findOwnDeck(req) });
}

// PATCH /api/decks/:id/cards/:index  { status: 'known' | 'review' }
export async function markCard(req, res) {
  const deck = await findOwnDeck(req);
  const index = Number(req.params.index);
  if (!Number.isInteger(index) || index < 0 || index >= deck.cards.length) throw new HttpError(404, 'Card not found');
  deck.cards[index].status = req.body.status;
  await deck.save();
  res.json({ counts: deck.counts() });
}

// POST /api/decks/:id/reset -> every card back to "new"
export async function resetDeck(req, res) {
  const deck = await findOwnDeck(req);
  deck.cards.forEach((c) => {
    c.status = 'new';
  });
  await deck.save();
  res.json({ deck });
}

// DELETE /api/decks/:id
export async function deleteDeck(req, res) {
  await (await findOwnDeck(req)).deleteOne();
  res.status(204).end();
}
