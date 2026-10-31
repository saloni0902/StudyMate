"""Retrieval-Augmented Generation: find the right chunks, then ask the LLM."""
import re

from . import config, embeddings, llm, prompts, vector_store

TOP_K = 5
HISTORY_MESSAGES = 4  # how many earlier messages the LLM sees


def retrieve(subject_id: str, question: str, history: list[dict]) -> list[dict]:
    """Top chunks for the question.

    Follow-ups like "give me an example" say little on their own, so we also
    search with the previous question added and keep the best of both.
    """
    queries = [question]
    previous = next((m["content"] for m in reversed(history) if m["role"] == "user"), None)
    if previous:
        queries.append(f"{previous} {question}")

    best: dict[tuple, dict] = {}
    for vector in embeddings.embed(queries):
        for hit in vector_store.search(subject_id, vector, TOP_K):
            key = (hit["documentId"], hit["page"], hit["text"])
            if key not in best or hit["score"] > best[key]["score"]:
                best[key] = hit
    return sorted(best.values(), key=lambda h: h["score"], reverse=True)[:TOP_K]


def _citations(answer: str, chunks: list[dict]) -> list[dict]:
    """Sources the answer cites, as {n, documentId, fileName, page, snippet}."""
    cited = sorted({int(n) for n in re.findall(r"\[(\d+)\]", answer) if 1 <= int(n) <= len(chunks)})
    return [
        {
            "n": n,
            "documentId": chunks[n - 1]["documentId"],
            "fileName": chunks[n - 1]["fileName"],
            "page": chunks[n - 1]["page"],
            "snippet": chunks[n - 1]["text"][:300],
        }
        for n in cited
    ]


def ask(subject_id: str, question: str, history: list[dict]) -> dict:
    history = history[-HISTORY_MESSAGES:]
    chunks = retrieve(subject_id, question, history)

    # Scope guard: nothing close enough in the notes, so don't ask the LLM at all.
    if not chunks or chunks[0]["score"] < config.MIN_SCORE:
        return {"answer": prompts.NOT_FOUND_ANSWER, "citations": [], "grounded": False}

    answer = llm.generate(prompts.ask_prompt(question, chunks, history), system=prompts.ASK_SYSTEM)
    if prompts.NOT_FOUND_MARKER in answer:
        return {"answer": prompts.NOT_FOUND_ANSWER, "citations": [], "grounded": False}

    return {"answer": answer, "citations": _citations(answer, chunks), "grounded": True}


TOPIC_K = 8  # a summary needs a little more material than one answer
MAX_DOCUMENT_CHARS = 300_000  # ~75k tokens; Gemini Flash handles far more, but this keeps calls quick


def _summary_result(text: str, chunks: list[dict], **extra) -> dict:
    if prompts.NOT_FOUND_MARKER in text:
        return {"summary": prompts.NOT_FOUND_ANSWER, "citations": [], "grounded": False, **extra}
    return {"summary": text, "citations": _citations(text, chunks), "grounded": True, **extra}


def summarize_document(document: dict, length: str) -> dict:
    """One LLM call over the whole document's text, citing page numbers."""
    pages, used, truncated = [], 0, False
    for page in document["pages"]:
        if used + len(page["text"]) > MAX_DOCUMENT_CHARS:
            truncated = True
            break
        pages.append(page)
        used += len(page["text"])

    text = llm.generate(
        prompts.document_summary_prompt(document["fileName"], pages, length), system=prompts.SUMMARY_SYSTEM
    )
    # Source n is page n, so build one "chunk" per page for the citation lookup.
    by_page = [
        {"documentId": document["documentId"], "fileName": document["fileName"], "page": p["page"], "text": p["text"]}
        for p in pages
    ]
    return _summary_result(text, by_page, truncated=truncated)


def summarize_topic(subject_id: str, topic: str, length: str) -> dict:
    """Summarise what the subject's notes say about one topic."""
    [vector] = embeddings.embed([topic])
    chunks = vector_store.search(subject_id, vector, TOPIC_K)
    if not chunks or chunks[0]["score"] < config.MIN_SCORE:
        return {"summary": prompts.NOT_FOUND_ANSWER, "citations": [], "grounded": False, "truncated": False}

    text = llm.generate(prompts.topic_summary_prompt(topic, chunks, length), system=prompts.SUMMARY_SYSTEM)
    return _summary_result(text, chunks, truncated=False)
