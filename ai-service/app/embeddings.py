"""Sentence embeddings with all-MiniLM-L6-v2, run locally on the CPU.

The model (~90 MB) downloads from Hugging Face on first use and is then
cached; it is loaded once and shared by all requests.
"""
import threading

import numpy as np

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
DIMENSION = 384

_model = None
_lock = threading.Lock()


def _get_model():
    global _model
    with _lock:
        if _model is None:
            from sentence_transformers import SentenceTransformer  # slow import, so done lazily

            _model = SentenceTransformer(MODEL_NAME, device="cpu")
        return _model


def warm_up() -> None:
    """Load the model ahead of the first request."""
    _get_model()


def embed(texts: list[str]) -> np.ndarray:
    """Return unit-length float32 vectors, shape (len(texts), 384).

    Unit length means FAISS inner product = cosine similarity.
    """
    if not texts:
        return np.zeros((0, DIMENSION), dtype="float32")
    model = _get_model()
    with _lock:
        vectors = model.encode(texts, batch_size=32, normalize_embeddings=True, show_progress_bar=False)
    return np.asarray(vectors, dtype="float32")
