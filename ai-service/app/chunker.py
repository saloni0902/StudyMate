"""Split page text into overlapping chunks for retrieval.

Chunks never cross a page, so every chunk keeps the page number it came
from and answers can cite it.
"""
import re

CHUNK_SIZE = 800  # characters
CHUNK_OVERLAP = 150
MIN_CHUNK_CHARS = 40  # drop tiny leftovers like page numbers


def _split_sentences(text: str) -> list[str]:
    # Break after ., ! or ? followed by whitespace, and at blank lines.
    parts = re.split(r"(?<=[.!?])\s+|\n\s*\n", text)
    return [p.strip() for p in parts if p.strip()]


def _split_long(sentence: str, size: int) -> list[str]:
    """Hard-split a single sentence that is longer than one chunk."""
    words, pieces, current = sentence.split(), [], ""
    for word in words:
        if current and len(current) + 1 + len(word) > size:
            pieces.append(current)
            current = word
        else:
            current = f"{current} {word}".strip()
    if current:
        pieces.append(current)
    return pieces


def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    sentences = []
    for sentence in _split_sentences(text):
        sentences.extend(_split_long(sentence, size) if len(sentence) > size else [sentence])

    chunks, current = [], []
    for sentence in sentences:
        if current and len(" ".join(current)) + 1 + len(sentence) > size:
            chunks.append(" ".join(current))
            # Start the next chunk with the last sentences of this one (overlap).
            carry = []
            for prev in reversed(current):
                if len(" ".join([prev, *carry])) > overlap:
                    break
                carry.insert(0, prev)
            current = carry
        current.append(sentence)
    if current:
        chunks.append(" ".join(current))
    return [c for c in chunks if len(c) >= MIN_CHUNK_CHARS]


def chunk_pages(pages: list[dict]) -> list[dict]:
    """[{"page", "text"}] -> [{"page", "text"}] with text cut into chunks."""
    return [{"page": p["page"], "text": chunk} for p in pages for chunk in chunk_text(p["text"])]
