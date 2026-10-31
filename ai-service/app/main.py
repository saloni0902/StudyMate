"""StudyMate AI service: PDF ingestion, RAG search and LLM generation.

Only the Express backend calls this service; every route except /health
requires the shared X-Service-Key header.
"""
import logging
import threading
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from . import config, document_store, embeddings, quiz, rag, study, vector_store
from .chunker import chunk_pages
from .llm import LLMError
from .pdf_loader import MIN_PAGE_CHARS, PdfError, extract_pages
from .schemas import (
    AskRequest,
    AskResponse,
    FlashcardsRequest,
    FlashcardsResponse,
    IngestRequest,
    IngestResponse,
    PagesResponse,
    QuizRequest,
    QuizResponse,
    StudyPlanRequest,
    StudyPlanResponse,
    SummarizeRequest,
    SummarizeResponse,
    TopicsResponse,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load the embedding model in the background so the first upload or
    # question doesn't wait for it.
    threading.Thread(target=embeddings.warm_up, daemon=True).start()
    yield


app = FastAPI(title="StudyMate AI Service", version="1.0.0", lifespan=lifespan)
log = logging.getLogger("uvicorn.error")


def require_service_key(x_service_key: str = Header(default="")):
    if x_service_key != config.AI_SERVICE_KEY:
        raise HTTPException(status_code=401, detail="Invalid service key")


def error_response(status: int, message: str) -> JSONResponse:
    # Same error shape as the Express API: {"error": {"code", "message"}}
    return JSONResponse(status_code=status, content={"error": {"code": f"HTTP_{status}", "message": message}})


@app.exception_handler(HTTPException)
async def http_error(request: Request, exc: HTTPException):
    return error_response(exc.status_code, exc.detail)


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    first = exc.errors()[0]
    field = ".".join(str(part) for part in first["loc"] if part != "body")
    return error_response(422, f"{field}: {first['msg']}")


@app.exception_handler(LLMError)
async def llm_error(request: Request, exc: LLMError):
    return error_response(exc.status, str(exc))


@app.exception_handler(Exception)
async def unexpected_error(request: Request, exc: Exception):
    # A bug or outage: log the details for the developer, keep them from the student.
    log.exception("%s %s failed", request.method, request.url.path)
    return error_response(500, "The AI service hit an unexpected error. Please try again.")


def check_ids(*ids: str) -> None:
    if not all(document_store.valid_id(i) for i in ids):
        raise HTTPException(status_code=400, detail="Invalid id")


@app.get("/health")
def health():
    return {"status": "ok", "llmConfigured": bool(config.GEMINI_API_KEY), "model": config.GEMINI_MODEL}


@app.get("/whoami", dependencies=[Depends(require_service_key)])
def whoami():
    """Lets the backend check that its service key is accepted."""
    return {"ok": True}


@app.post("/ingest", response_model=IngestResponse, dependencies=[Depends(require_service_key)])
def ingest(req: IngestRequest):
    """PDF -> page text -> chunks -> embeddings -> the subject's FAISS index."""
    path = Path(req.filePath).resolve()
    # Only read files the backend saved in its upload folder.
    if not path.is_relative_to(config.UPLOAD_DIR) or not path.is_file():
        raise HTTPException(status_code=400, detail="File not found in the upload folder")

    try:
        pages = extract_pages(path)
    except PdfError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    chunks = chunk_pages(pages)
    vectors = embeddings.embed([c["text"] for c in chunks])
    vector_store.add_document(req.subjectId, req.documentId, req.fileName, chunks, vectors)
    document_store.save_pages(req.subjectId, req.documentId, req.fileName, pages)
    # One Gemini call; if it fails the document is still usable, just without topics.
    topics = quiz.extract_topics(req.fileName, pages)

    return IngestResponse(
        pages=len(pages),
        emptyPages=[p["page"] for p in pages if len(p["text"]) < MIN_PAGE_CHARS],
        charCount=sum(len(p["text"]) for p in pages),
        chunkCount=len(chunks),
        topics=topics,
    )


@app.post("/ask", response_model=AskResponse, dependencies=[Depends(require_service_key)])
def ask(req: AskRequest):
    """Answer a question from the subject's notes, with page citations."""
    history = [m.model_dump() for m in req.history]
    return rag.ask(req.subjectId, req.question.strip(), history)


@app.post("/summarize", response_model=SummarizeResponse, dependencies=[Depends(require_service_key)])
def summarize(req: SummarizeRequest):
    """Summary of a whole document, or of one topic across the subject's notes."""
    if req.topic is not None:
        return rag.summarize_topic(req.subjectId, req.topic.strip(), req.length)

    document = document_store.load_pages(req.subjectId, req.documentId)
    if document is None:
        raise HTTPException(status_code=404, detail="No extracted text for this document")
    return rag.summarize_document(document, req.length)


@app.post("/quiz", response_model=QuizResponse, dependencies=[Depends(require_service_key)])
def make_quiz(req: QuizRequest):
    """Multiple-choice questions from the subject's notes (all of it, or one topic)."""
    topic = req.topic.strip() if req.topic else None
    try:
        questions = quiz.generate_quiz(req.subjectId, topic, req.count, req.difficulty, req.knownTopics)
    except quiz.NotInNotes as exc:
        raise HTTPException(status_code=422, detail=f"I couldn't find {exc} in your notes.") from exc
    return {"questions": questions}


@app.post("/flashcards", response_model=FlashcardsResponse, dependencies=[Depends(require_service_key)])
def make_flashcards(req: FlashcardsRequest):
    """Question/answer cards from the subject's notes (all of it, or one topic)."""
    topic = req.topic.strip() if req.topic else None
    try:
        cards = study.generate_flashcards(req.subjectId, topic, req.count, req.knownTopics)
    except quiz.NotInNotes as exc:
        raise HTTPException(status_code=422, detail=f"I couldn't find {exc} in your notes.") from exc
    return {"cards": cards}


@app.post("/study-plan", response_model=StudyPlanResponse, dependencies=[Depends(require_service_key)])
def make_study_plan(req: StudyPlanRequest):
    """A day-by-day revision plan for the student's weak topics."""
    weak = [t.model_dump() for t in req.weakTopics]
    return {"days": study.generate_study_plan(req.subjectId, weak, req.days)}


@app.post(
    "/documents/{subject_id}/{document_id}/topics",
    response_model=TopicsResponse,
    dependencies=[Depends(require_service_key)],
)
def detect_topics(subject_id: str, document_id: str):
    """Find topics again for a document (e.g. one uploaded before topics existed)."""
    check_ids(subject_id, document_id)
    data = document_store.load_pages(subject_id, document_id)
    if data is None:
        raise HTTPException(status_code=404, detail="No extracted text for this document")
    return {"topics": quiz.extract_topics(data["fileName"], data["pages"])}


@app.get(
    "/documents/{subject_id}/{document_id}/pages",
    response_model=PagesResponse,
    dependencies=[Depends(require_service_key)],
)
def get_pages(subject_id: str, document_id: str):
    check_ids(subject_id, document_id)
    data = document_store.load_pages(subject_id, document_id)
    if data is None:
        raise HTTPException(status_code=404, detail="No extracted text for this document")
    return data


@app.delete("/documents/{subject_id}/{document_id}", dependencies=[Depends(require_service_key)])
def delete_document(subject_id: str, document_id: str):
    check_ids(subject_id, document_id)
    vector_store.remove_document(subject_id, document_id)
    document_store.delete_document(subject_id, document_id)
    return {"deleted": True}


@app.delete("/subjects/{subject_id}", dependencies=[Depends(require_service_key)])
def delete_subject(subject_id: str):
    check_ids(subject_id)
    vector_store.remove_subject(subject_id)
    document_store.delete_subject(subject_id)
    return {"deleted": True}


