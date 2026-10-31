"""Topic detection and multiple-choice quiz generation from a subject's notes.

The LLM only writes the questions; picking the source passages, checking the
questions and (in the backend) scoring the answers is plain code.
"""
import logging
import random

from pydantic import BaseModel, Field

from . import config, embeddings, llm, prompts, vector_store

log = logging.getLogger("uvicorn.error")

TOPIC_SAMPLE_CHARS = 12_000  # enough text to see a document's main topics
QUIZ_TOPIC_K = 10  # passages used for a quiz on one topic
QUIZ_SPREAD_K = 12  # passages used for a quiz on the whole subject


# --- What we ask Gemini to return (its JSON must match these) -------------


class TopicList(BaseModel):
    topics: list[str]


class DraftQuestion(BaseModel):
    question: str
    options: list[str]
    answer: int
    topic: str
    explanation: str
    source: int


class DraftQuiz(BaseModel):
    questions: list[DraftQuestion] = Field(description="The quiz questions")


# --- Topics ----------------------------------------------------------------


def _sample_text(pages: list[dict], limit: int) -> str:
    """Text from across the whole document (not just the start), up to limit chars."""
    texts = [p["text"] for p in pages if p["text"]]
    if not texts:
        return ""
    share = max(200, limit // len(texts))
    return "\n\n".join(t[:share] for t in texts)[:limit]


def _clean_topic(name: str) -> str:
    name = " ".join(name.strip(" .-•*\"'").split())
    return name[:1].upper() + name[1:] if name else ""


def extract_topics(file_name: str, pages: list[dict]) -> list[str]:
    """3-12 topic names for a document. Never fails: returns [] if Gemini can't help."""
    text = _sample_text(pages, TOPIC_SAMPLE_CHARS)
    if not text:
        return []
    try:
        result = llm.generate_json(prompts.topics_prompt(file_name, text), prompts.TOPICS_SYSTEM, TopicList, 0.2)
    except llm.LLMError as exc:
        log.warning("Topic detection skipped for %s: %s", file_name, exc)
        return []

    topics, seen = [], set()
    for name in map(_clean_topic, result.topics):
        if name and len(name) <= 60 and name.lower() not in seen:
            seen.add(name.lower())
            topics.append(name)
    return topics[:12]


# --- Quiz ------------------------------------------------------------------


class NotInNotes(Exception):
    """The notes don't cover the requested topic."""


def _spread(chunks: list[dict], k: int) -> list[dict]:
    """k chunks evenly spaced through the subject, so every part gets questions."""
    if len(chunks) <= k:
        return chunks
    step = len(chunks) / k
    return [chunks[int(i * step)] for i in range(k)]


def select_chunks(subject_id: str, topic: str | None) -> list[dict]:
    if topic:
        [vector] = embeddings.embed([topic])
        chunks = vector_store.search(subject_id, vector, QUIZ_TOPIC_K)
        if not chunks or chunks[0]["score"] < config.MIN_SCORE:
            raise NotInNotes(topic)
        return chunks
    chunks = _spread(vector_store.all_chunks(subject_id), QUIZ_SPREAD_K)
    if not chunks:
        raise NotInNotes("this subject")
    return chunks


def _valid(q: DraftQuestion, source_count: int) -> bool:
    options = [o.strip() for o in q.options]
    return (
        bool(q.question.strip())
        and len(options) == 4
        and all(options)
        and len({o.lower() for o in options}) == 4
        and 0 <= q.answer <= 3
        and 1 <= q.source <= source_count
        and bool(q.explanation.strip())
    )


def _finish(q: DraftQuestion, chunks: list[dict], rng: random.Random) -> dict:
    """Shuffle the options (models favour putting the answer first) and attach the source."""
    options = [o.strip() for o in q.options]
    correct = options[q.answer]
    rng.shuffle(options)
    source = chunks[q.source - 1]
    return {
        "question": q.question.strip(),
        "options": options,
        "answerIndex": options.index(correct),
        "topic": _clean_topic(q.topic) or "General",
        "explanation": q.explanation.strip(),
        "source": {"documentId": source["documentId"], "fileName": source["fileName"], "page": source["page"]},
    }


def generate_quiz(
    subject_id: str, topic: str | None, count: int, difficulty: str, known_topics: list[str], seed: int | None = None
) -> list[dict]:
    """count checked questions with options, answerIndex, topic, explanation and source."""
    chunks = select_chunks(subject_id, topic)
    draft = llm.generate_json(
        prompts.quiz_prompt(chunks, count, difficulty, topic, known_topics), prompts.QUIZ_SYSTEM, DraftQuiz
    )

    rng = random.Random(seed)
    questions, seen = [], set()
    for q in draft.questions:
        key = q.question.strip().lower()
        if _valid(q, len(chunks)) and key not in seen:
            seen.add(key)
            questions.append(_finish(q, chunks, rng))
    if len(draft.questions) != len(questions):
        log.info("Quiz: kept %s of %s questions after checks", len(questions), len(draft.questions))

    # Accept a slightly short quiz rather than fail, but not a nearly empty one.
    if len(questions) < max(3, (count + 1) // 2):
        raise llm.LLMError("Gemini couldn't write enough good questions from these notes. Please try again.")
    return questions[:count]
