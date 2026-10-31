import { after, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { clearDB, startTestDB, stopTestDB } from './helpers.js';

// Uploads go to a temp folder; must be set before the app is imported.
const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'studymate-uploads-'));
process.env.UPLOAD_DIR = uploadDir;
const { default: app } = await import('../src/app.js');

const PDF = Buffer.from('%PDF-1.4\n% test file\n');

// Stand-in for the Python AI service: records calls, answers like the real one.
let aiCalls;
let ingestReply;
function mockAiService() {
  aiCalls = [];
  ingestReply = { status: 200, body: { pages: 3, emptyPages: [2], charCount: 1200 } };
  mock.method(globalThis, 'fetch', async (url, options = {}) => {
    const { pathname } = new URL(url);
    aiCalls.push({ method: options.method || 'GET', pathname, body: options.body && JSON.parse(options.body) });
    if (pathname === '/ingest') return Response.json(ingestReply.body, { status: ingestReply.status });
    if (pathname.endsWith('/pages')) return Response.json({ pages: [{ page: 1, text: 'A process is a program.' }] });
    return Response.json({ deleted: true });
  });
}

async function signUp(email) {
  const res = await request(app).post('/api/auth/register').send({ name: 'Student', email, password: 'secret123' });
  return `Bearer ${res.body.token}`;
}

async function waitUntilProcessed(token, id) {
  for (let i = 0; i < 50; i++) {
    const res = await request(app).get(`/api/documents/${id}`).set('Authorization', token);
    if (res.body.document.status !== 'processing') return res.body.document;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('Document never finished processing');
}

describe('documents', () => {
  let alice;
  let subjectId;

  before(startTestDB);
  after(async () => {
    await stopTestDB();
    fs.rmSync(uploadDir, { recursive: true, force: true });
  });
  beforeEach(async () => {
    await clearDB();
    for (const file of fs.readdirSync(uploadDir)) fs.rmSync(path.join(uploadDir, file));
    mock.restoreAll();
    mockAiService();
    alice = await signUp('alice@example.com');
    const res = await request(app).post('/api/subjects').set('Authorization', alice).send({ name: 'OS' });
    subjectId = res.body.subject.id;
  });

  const upload = (token, buffer = PDF, name = 'os-notes.pdf') =>
    request(app)
      .post(`/api/subjects/${subjectId}/documents`)
      .set('Authorization', token)
      .attach('file', buffer, { filename: name, contentType: 'application/pdf' });

  it('uploads a PDF and marks it ready after ingestion', async () => {
    const res = await upload(alice).expect(201);
    assert.equal(res.body.document.status, 'processing');
    assert.equal(res.body.document.originalName, 'os-notes.pdf');

    const doc = await waitUntilProcessed(alice, res.body.document.id);
    assert.equal(doc.status, 'ready');
    assert.equal(doc.pages, 3);
    assert.deepEqual(doc.emptyPages, [2]);

    const ingest = aiCalls.find((c) => c.pathname === '/ingest');
    assert.equal(ingest.body.subjectId, subjectId);
    assert.ok(ingest.body.filePath.startsWith(uploadDir));
    assert.ok(fs.existsSync(ingest.body.filePath));

    const list = await request(app).get(`/api/subjects/${subjectId}/documents`).set('Authorization', alice).expect(200);
    assert.equal(list.body.documents.length, 1);
  });

  it('marks the document failed with the AI service message', async () => {
    ingestReply = { status: 422, body: { error: { message: 'This PDF is password-protected.' } } };
    const res = await upload(alice).expect(201);
    const doc = await waitUntilProcessed(alice, res.body.document.id);
    assert.equal(doc.status, 'failed');
    assert.equal(doc.error, 'This PDF is password-protected.');

    ingestReply = { status: 200, body: { pages: 1, emptyPages: [], charCount: 10 } };
    await request(app).post(`/api/documents/${doc.id}/retry`).set('Authorization', alice).expect(200);
    assert.equal((await waitUntilProcessed(alice, doc.id)).status, 'ready');
  });

  it('rejects files that are not PDFs', async () => {
    await upload(alice, Buffer.from('hello'), 'notes.txt').expect(400);
    const res = await upload(alice, Buffer.from('not really a pdf'), 'fake.pdf').expect(400);
    assert.equal(res.body.error.message, 'This file is not a valid PDF');
    assert.equal(fs.readdirSync(uploadDir).length, 0);
  });

  it('requires a file', async () => {
    await request(app).post(`/api/subjects/${subjectId}/documents`).set('Authorization', alice).expect(400);
  });

  it("does not let another student upload to, list or read someone's documents", async () => {
    const bob = await signUp('bob@example.com');
    await upload(bob).expect(404);
    await request(app).get(`/api/subjects/${subjectId}/documents`).set('Authorization', bob).expect(404);

    const res = await upload(alice);
    await waitUntilProcessed(alice, res.body.document.id);
    await request(app).get(`/api/documents/${res.body.document.id}/text`).set('Authorization', bob).expect(404);
    await request(app).delete(`/api/documents/${res.body.document.id}`).set('Authorization', bob).expect(404);
  });

  it('returns extracted text page by page', async () => {
    const res = await upload(alice);
    await waitUntilProcessed(alice, res.body.document.id);
    const text = await request(app)
      .get(`/api/documents/${res.body.document.id}/text`)
      .set('Authorization', alice)
      .expect(200);
    assert.equal(text.body.pages[0].page, 1);
  });

  it('deletes the file, AI data and record', async () => {
    const res = await upload(alice);
    const doc = await waitUntilProcessed(alice, res.body.document.id);
    const filePath = aiCalls.find((c) => c.pathname === '/ingest').body.filePath;

    await request(app).delete(`/api/documents/${doc.id}`).set('Authorization', alice).expect(204);
    assert.equal(fs.existsSync(filePath), false);
    assert.ok(aiCalls.some((c) => c.method === 'DELETE' && c.pathname === `/documents/${subjectId}/${doc.id}`));
    await request(app).get(`/api/documents/${doc.id}`).set('Authorization', alice).expect(404);
  });

  it('deleting a subject removes its documents', async () => {
    const res = await upload(alice);
    await waitUntilProcessed(alice, res.body.document.id);

    await request(app).delete(`/api/subjects/${subjectId}`).set('Authorization', alice).expect(204);
    await request(app).get(`/api/documents/${res.body.document.id}`).set('Authorization', alice).expect(404);
    assert.ok(aiCalls.some((c) => c.method === 'DELETE' && c.pathname === `/subjects/${subjectId}`));
    assert.equal(fs.readdirSync(uploadDir).length, 0);
  });
});
