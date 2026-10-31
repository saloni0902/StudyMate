"""Flashcards and personalised study plans, written by Gemini from the notes.

Like quizzes, the passages are picked and the LLM output is checked in code;
the LLM only writes the text.
"""
import logging
import re

from pydantic import BaseModel

from . import embeddings, llm, prompts, vector_store
from .quiz import _clean_topic, select_chunks

log = logging.getLogger("uvicorn.error")

PLAN_CHUNKS_PER_TOPIC = 3
PLAN_MAX_TOPICS = 5


def _source(chunk: dict) -> dict:
    return {"documentId": chunk["documentId"], "fileName": chunk["fileName"], "page": chunk["page"]}


# --- Flashcards --------------------------------------------------------------


class DraftCard(BaseModel):
    front: str
    back: str
    topic: str
    source: int


class DraftDeck(BaseModel):
    cards: list[DraftCard]


def generate_flashcards(subject_id: str, topic: str | None, count: int, known_topics: list[str]) -> list[dict]:
    """count checked cards: {front, back, topic, source}."""
    chunks = select_chunks(subject_id, topic)
    draft = llm.generate_json(
        prompts.flashcards_prompt(chunks, count, topic, known_topics), prompts.FLASHCARDS_SYSTEM, DraftDeck
    )

    cards, seen = [], set()
    for c in draft.cards:
        front, back = c.front.strip(), c.back.strip()
        key = front.lower()
        if front and back and len(front) <= 300 and len(back) <= 800 and 1 <= c.source <= len(chunks) and key not in seen:
            seen.add(key)
            cards.append(
                {"front": front, "back": back, "topic": _clean_topic(c.topic) or "General", "source": _source(chunks[c.source - 1])}
            )
    if len(draft.cards) != len(cards):
        log.info("Flashcards: kept %s of %s cards after checks", len(cards), len(draft.cards))
    if len(cards) < max(3, (count + 1) // 2):
        raise llm.LLMError("Gemini couldn't write enough good flashcards from these notes. Please try again.")
    return cards[:count]


# --- Study plan --------------------------------------------------------------


class DraftDay(BaseModel):
    day: int
    focus: str
    tasks: list[str]
    sources: list[int]


class DraftPlan(BaseModel):
    days: list[DraftDay]


def plan_chunks(subject_id: str, weak_topics: list[dict]) -> list[dict]:
    """The best few passages for each weak topic, without repeats."""
    topics = [t["topic"] for t in weak_topics[:PLAN_MAX_TOPICS]]
    chunks, seen = [], set()
    for vector in embeddings.embed(topics):
        for hit in vector_store.search(subject_id, vector, PLAN_CHUNKS_PER_TOPIC):
            key = (hit["documentId"], hit["page"], hit["text"])
            if key not in seen:
                seen.add(key)
                chunks.append(hit)
    return chunks


# Matches leftover "source 2", "sources 1 and 3", "(sources 1, 2)" in a task.
_SOURCE_REF = re.compile(r"\(?\b(?:using |from |in )?sources? (\d+(?:(?:,\s*|,?\s+and\s+)\d+)*)\)?", re.I)


def _readable_task(task: str, chunks: list[dict]) -> str:
    """Replace "source N" (meaningless to a student) with the page it refers to."""

    def to_pages(match):
        numbers = [int(n) for n in re.findall(r"\d+", match.group(1)) if 1 <= int(n) <= len(chunks)]
        pages = sorted({chunks[n - 1]["page"] for n in numbers})
        return f"(p. {', '.join(map(str, pages))})" if pages else ""

    return re.sub(r"\s+([.,])", r"\1", _SOURCE_REF.sub(to_pages, task)).strip()


def generate_study_plan(subject_id: str, weak_topics: list[dict], days: int) -> list[dict]:
    """A day-by-day plan for the weak topics: [{day, focus, tasks, sources}]."""
    chunks = plan_chunks(subject_id, weak_topics)
    if not chunks:
        raise llm.LLMError("No notes found for these topics. Upload documents first.", status=422)

    draft = llm.generate_json(prompts.study_plan_prompt(chunks, weak_topics, days), prompts.STUDY_PLAN_SYSTEM, DraftPlan)

    plan = []
    for d in draft.days[:days]:
        tasks = [_readable_task(t, chunks) for t in d.tasks if t.strip()][:5]
        if not d.focus.strip() or not tasks:
            continue
        # One chip per page, even if several passages come from it.
        sources, seen = [], set()
        for n in d.sources:
            if 1 <= n <= len(chunks):
                page = (chunks[n - 1]["documentId"], chunks[n - 1]["page"])
                if page not in seen:
                    seen.add(page)
                    sources.append(_source(chunks[n - 1]))
        plan.append({"day": len(plan) + 1, "focus": d.focus.strip(), "tasks": tasks, "sources": sources})

    if len(plan) < min(2, days):
        raise llm.LLMError("Gemini couldn't write a study plan. Please try again.")
    return plan
