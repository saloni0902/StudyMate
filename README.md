# StudyMate — AI Study Assistant

StudyMate turns a student's own course PDFs into a study assistant. Upload your notes, then chat with them, get summaries, take quizzes, review flashcards and follow a study plan, with every answer pointing to the page it came from.

**Area:** Artificial Intelligence: Generative AI and Retrieval-Augmented Generation (RAG) applied to education.

## Features

| Page | What it does | Uses AI? |
| --- | --- | --- |
| Dashboard | Every subject with documents, average score, flashcards known and weak topics; recent quiz results; the latest study plan | No |
| Documents | Upload PDFs (drag and drop, up to 20 MB); text is extracted page by page; topics are detected; view the extracted text | Embeddings + 1 Gemini call for topics |
| Chat | Ask questions; answers come only from your notes and cite file and page. Questions the notes don't cover get "I couldn't find this in your notes" | RAG + Gemini |
| Summaries | Summarise a whole document or one topic, short or detailed, with page references; saved for later | RAG + Gemini |
| Quiz | 5/10/15 multiple-choice questions (easy/medium/hard) on one topic or everything; scored in code; results explain every answer and show accuracy per topic | Gemini writes questions; scoring is plain code |
| Flashcards | Decks of 10/15/20 cards; flip, then mark "Knew it" or "Review again" (keys Space, 1, 2) | Gemini writes cards |
| Progress | Quiz scores over time, accuracy per topic, weak topics (under 60% with at least 2 answers) and a 3/5/7-day AI study plan | Weak topics in code; plan by Gemini |

Works on phones too: below tablet width the sidebar becomes a menu.

## How it works

**Full walkthrough with flow diagrams: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).** It covers login and JWT, every request, uploads, chat, summaries, quizzes, flashcards, progress, Gemini retries, deletion and errors. Open `docs/diagrams.html` in a browser to see the same document with every diagram drawn (good for printing to PDF). After editing the `.md` file, run `npm run docs` to rebuild it.

```
Browser (React) ──REST + JWT──► Backend (Express) ──service key──► AI service (FastAPI)
                                   │                                  │
                                MongoDB                     PDF → chunks → MiniLM embeddings
                       (users, subjects, chats,             → FAISS index per subject
                        quizzes, decks, plans)              → Gemini (answers, summaries,
                                                               quizzes, flashcards, plans)
```

1. **Ingest:** PyMuPDF extracts each page; pages are cut into ~800-character chunks that keep their page number; `all-MiniLM-L6-v2` (runs locally, free) turns chunks into vectors stored in one FAISS index per subject.
2. **Retrieve:** a question is embedded and FAISS returns the closest chunks. If even the best one scores below 0.3, the app says the notes don't cover it, without calling Gemini.
3. **Generate:** the chunks are numbered and sent to Gemini with instructions to use only them and cite them. Quiz, flashcard and plan replies must match a JSON schema and are checked in code.

| Folder | What it is | Port |
| --- | --- | --- |
| `frontend/` | React 19 + Vite + Tailwind CSS 4 + Recharts | 5173 |
| `backend/` | Node.js + Express 5 + Mongoose (MongoDB) | 5050 |
| `ai-service/` | Python + FastAPI + PyMuPDF + sentence-transformers + FAISS + Gemini | 8008 |

## Requirements

- Node.js 20 or newer (tested on 24)
- Python 3.12 or newer (tested on 3.14)
- About 1 GB of disk for the AI service's Python packages (PyTorch). The first start downloads the MiniLM model (~90 MB).
- A free Gemini API key from https://aistudio.google.com/apikey
- MongoDB is optional: with `MONGO_URI` empty, the backend runs a built-in MongoDB that saves to `backend/.data/mongo`.

## Setup (once)

**New Windows laptop?** Follow [docs/SETUP-WINDOWS.md](docs/SETUP-WINDOWS.md): it starts from installing Node.js and Python.

From the project folder:

```bash
npm install
```

```bash
npm run setup
```

`npm run setup` installs everything for all three apps, creates the Python virtual environment, and creates `backend/.env` and `ai-service/.env` with fresh secrets. Then open `ai-service/.env` and add your Gemini key:

```
GEMINI_API_KEY=your-key-here
```

## Run

```bash
npm run dev
```

This starts the AI service, backend and frontend together (logs are labelled `ai`, `api` and `web`). Open http://localhost:5173, sign up, create a subject and upload a PDF. `samples/operating-systems-notes.pdf` is a 3-page example; `samples/scanned-no-text.pdf` shows the error for scanned PDFs.

The AI service's interactive API docs are at http://localhost:8008/docs.

To run one app on its own: `npm run dev:ai`, `npm run dev:api` or `npm run dev:web`.

## Tests

```bash
npm test
```

Runs the AI service tests (pytest) and the backend tests (Node's test runner with Supertest and an in-memory MongoDB). The tests never call the real Gemini API, so they don't use your quota.

## Configuration

| File | Setting | Meaning |
| --- | --- | --- |
| `ai-service/.env` | `GEMINI_API_KEY` | Your Gemini key (required for AI features) |
| | `GEMINI_MODEL` / `GEMINI_FALLBACK_MODEL` | Main model and the lighter one used when the main one is busy or out of quota |
| | `MIN_SCORE` | How close (0–1) a passage must be for a question to count as covered by the notes (default 0.3) |
| `backend/.env` | `MONGO_URI` | Your MongoDB / Atlas connection; empty = built-in database |
| | `JWT_SECRET` | Secret for login tokens |
| | `MAX_UPLOAD_MB` | Largest PDF allowed (default 20) |
| both | `AI_SERVICE_KEY` | Shared secret so only the backend can call the AI service; must match |

## Troubleshooting

| You see | Why | Fix |
| --- | --- | --- |
| "Can't reach the StudyMate server" | The backend isn't running | Start it (`npm run dev`) and press Try again |
| "The Gemini API key is not set" | No key in `ai-service/.env` | Add `GEMINI_API_KEY`, restart the AI service |
| "Gemini is very busy right now" | Google is overloaded (HTTP 503), even after retries | Wait a minute and try again |
| "Today's free Gemini limit has been used up…" | Free tier: about 20 requests per day on the main model, after which the fallback model's quota is used too | Wait for the reset time shown, or enable billing on the key |
| A PDF shows "Failed: No text could be found" | It's a scanned image, not text | Use a PDF with selectable text |

## Notes

- **Theme:** "Deep forest" from [Happy Hues palette 10](https://www.happyhues.co/palettes/10). All colours live in the `@theme` block of `frontend/src/index.css`; every text/background pair meets the 4.5:1 contrast guideline.
- **Ports:** 5000 and 8000 are avoided because macOS uses 5000 for AirPlay Receiver.
- **Privacy:** on the Gemini free tier Google may use prompts to improve its models, so don't upload sensitive documents.
- **macOS + FAISS:** FAISS and PyTorch each bundle OpenMP; `ai-service/app/__init__.py` sets two environment variables so they don't crash together.
- **Design doc:** the full design, API list and build plan are in the project's design doc.
