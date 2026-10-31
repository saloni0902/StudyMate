import hashlib
import re

import numpy as np
import pytest

from app import config, embeddings, vector_store


def fake_embed(texts):
    """Bag-of-words vectors: fast, offline, and texts sharing words score high."""
    vectors = np.zeros((len(texts), embeddings.DIMENSION), dtype="float32")
    for row, text in enumerate(texts):
        for word in re.findall(r"[a-z]{3,}", text.lower()):
            vectors[row, int(hashlib.md5(word.encode()).hexdigest(), 16) % embeddings.DIMENSION] += 1
        norm = np.linalg.norm(vectors[row])
        if norm:
            vectors[row] /= norm
    return vectors


@pytest.fixture(autouse=True)
def isolated_storage(tmp_path, monkeypatch, request):
    """Each test gets empty data folders and, unless marked real_model, the fake embedder."""
    monkeypatch.setattr(config, "INDEX_DIR", (tmp_path / "indexes").resolve())
    monkeypatch.setattr(config, "DOCS_DIR", (tmp_path / "documents").resolve())
    # Never call the real Gemini API from tests (it would spend the free quota).
    monkeypatch.setattr(config, "GEMINI_API_KEY", "")
    vector_store._cache.clear()
    if "real_model" not in request.keywords:
        monkeypatch.setattr(embeddings, "embed", fake_embed)
    yield
    vector_store._cache.clear()


def pytest_configure(config):
    config.addinivalue_line("markers", "real_model: uses the real MiniLM embedding model (slower)")
