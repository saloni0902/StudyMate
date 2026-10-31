"""All environment settings for the AI service in one place."""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def _path(name: str, default: str) -> Path:
    """Read a folder path from the environment; relative paths start at ai-service/."""
    return (BASE_DIR / os.getenv(name, default)).resolve()


AI_SERVICE_KEY = os.getenv("AI_SERVICE_KEY", "change-me-dev-key")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
# Used when the main model stays overloaded after retries (empty = no fallback).
GEMINI_FALLBACK_MODEL = os.getenv("GEMINI_FALLBACK_MODEL", "gemini-3.5-flash-lite")

# Best chunk must score at least this (cosine similarity, 0-1) or the
# question is treated as "not in your notes" without calling the LLM.
MIN_SCORE = float(os.getenv("MIN_SCORE", "0.3"))

INDEX_DIR = _path("INDEX_DIR", "data/indexes")
# Extracted page text, one JSON file per document
DOCS_DIR = _path("DOCS_DIR", "data/documents")
# The backend's upload folder: /ingest only reads PDFs from inside it
UPLOAD_DIR = _path("UPLOAD_DIR", "../backend/uploads")
