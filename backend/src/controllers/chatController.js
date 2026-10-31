import mongoose from 'mongoose';
import Chat from '../models/Chat.js';
import Document from '../models/Document.js';
import { askQuestion } from '../services/aiClient.js';
import HttpError from '../utils/httpError.js';

// How many earlier messages are sent to the AI service for follow-ups.
const HISTORY_MESSAGES = 6;

async function findOwnChat(req) {
  const { id } = req.params;
  const chat = mongoose.isValidObjectId(id) ? await Chat.findOne({ _id: id, userId: req.userId }) : null;
  if (!chat) throw new HttpError(404, 'Chat not found');
  return chat;
}

function titleFrom(question) {
  const oneLine = question.replace(/\s+/g, ' ').trim();
  return oneLine.length > 60 ? `${oneLine.slice(0, 57)}…` : oneLine;
}

// GET /api/subjects/:id/chats
export async function listChats(req, res) {
  const chats = await Chat.find({ subjectId: req.subject._id, userId: req.userId }).sort({ updatedAt: -1 });
  res.json({ chats: chats.map((c) => c.summary()) });
}

// POST /api/subjects/:id/chats
export async function createChat(req, res) {
  const chat = await Chat.create({ userId: req.userId, subjectId: req.subject._id });
  res.status(201).json({ chat });
}

// GET /api/chats/:id
export async function getChat(req, res) {
  res.json({ chat: await findOwnChat(req) });
}

// DELETE /api/chats/:id
export async function deleteChat(req, res) {
  await (await findOwnChat(req)).deleteOne();
  res.status(204).end();
}

// POST /api/chats/:id/messages  { content } -> the question and the AI's answer
export async function sendMessage(req, res) {
  const chat = await findOwnChat(req);
  const question = req.body.content.trim();

  const ready = await Document.exists({ subjectId: chat.subjectId, userId: req.userId, status: 'ready' });
  if (!ready) throw new HttpError(409, 'Upload a PDF to this subject and wait until it is ready before asking questions');

  const history = chat.messages.slice(-HISTORY_MESSAGES).map((m) => ({ role: m.role, content: m.content }));
  // If the AI call fails nothing is saved, so the student can simply try again.
  const result = await askQuestion({ subjectId: String(chat.subjectId), question, history });

  if (chat.messages.length === 0) chat.title = titleFrom(question);
  chat.messages.push({ role: 'user', content: question });
  chat.messages.push({
    role: 'assistant',
    content: result.answer,
    citations: result.citations,
    grounded: result.grounded,
  });
  await chat.save();

  const [userMessage, assistantMessage] = chat.messages.slice(-2).map(Chat.messageJSON);
  res.status(201).json({ userMessage, assistantMessage, chat: chat.summary() });
}
