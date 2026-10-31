"""One FAISS index per subject, saved to disk.

data/indexes/<subjectId>.faiss  vectors (IndexFlatIP: exact cosine search)
data/indexes/<subjectId>.json   chunk metadata in the same order as the vectors:
                                {documentId, fileName, page, text}
"""
import json
import threading

import faiss
import numpy as np

from . import config, document_store
from .embeddings import DIMENSION

_lock = threading.Lock()
_cache: dict[str, tuple[faiss.Index, list[dict]]] = {}


def _paths(subject_id: str):
    if not document_store.valid_id(subject_id):
        raise ValueError("Invalid subject id")
    return config.INDEX_DIR / f"{subject_id}.faiss", config.INDEX_DIR / f"{subject_id}.json"


def _load(subject_id: str) -> tuple[faiss.Index, list[dict]]:
    if subject_id in _cache:
        return _cache[subject_id]
    index_path, meta_path = _paths(subject_id)
    if index_path.exists() and meta_path.exists():
        index = faiss.read_index(str(index_path))
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
    else:
        index, meta = faiss.IndexFlatIP(DIMENSION), []
    _cache[subject_id] = (index, meta)
    return index, meta


def _save(subject_id: str, index: faiss.Index, meta: list[dict]) -> None:
    index_path, meta_path = _paths(subject_id)
    config.INDEX_DIR.mkdir(parents=True, exist_ok=True)
    faiss.write_index(index, str(index_path))
    meta_path.write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
    _cache[subject_id] = (index, meta)


def _without_document(index: faiss.Index, meta: list[dict], document_id: str):
    """Rebuild the index keeping every chunk except this document's."""
    keep = [i for i, m in enumerate(meta) if m["documentId"] != document_id]
    if len(keep) == len(meta):
        return index, meta
    new_index = faiss.IndexFlatIP(DIMENSION)
    if keep:
        vectors = index.reconstruct_n(0, index.ntotal)
        new_index.add(vectors[keep])
    return new_index, [meta[i] for i in keep]


def add_document(subject_id: str, document_id: str, file_name: str, chunks: list[dict], vectors: np.ndarray) -> None:
    """Add (or replace) a document's chunks in its subject's index."""
    with _lock:
        index, meta = _without_document(*_load(subject_id), document_id)
        if len(chunks):
            index.add(vectors)
            meta = meta + [
                {"documentId": document_id, "fileName": file_name, "page": c["page"], "text": c["text"]} for c in chunks
            ]
        _save(subject_id, index, meta)


def remove_document(subject_id: str, document_id: str) -> None:
    with _lock:
        index, meta = _load(subject_id)
        new_index, new_meta = _without_document(index, meta, document_id)
        if new_index is not index:
            _save(subject_id, new_index, new_meta)


def remove_subject(subject_id: str) -> None:
    with _lock:
        _cache.pop(subject_id, None)
        for path in _paths(subject_id):
            path.unlink(missing_ok=True)


def search(subject_id: str, query_vector: np.ndarray, k: int = 5) -> list[dict]:
    """Top-k chunks for one query vector, best first, each with its score."""
    with _lock:
        index, meta = _load(subject_id)
        if index.ntotal == 0:
            return []
        scores, ids = index.search(query_vector.reshape(1, -1), min(k, index.ntotal))
    return [{**meta[i], "score": float(s)} for s, i in zip(scores[0], ids[0]) if i != -1]


def all_chunks(subject_id: str) -> list[dict]:
    """Every chunk's metadata in the subject, in upload/page order."""
    with _lock:
        return list(_load(subject_id)[1])


def chunk_count(subject_id: str) -> int:
    with _lock:
        return _load(subject_id)[0].ntotal
