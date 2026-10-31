"""Saves each document's extracted pages as JSON:
data/documents/<subjectId>/<documentId>.json
"""
import json
import re
import shutil
from pathlib import Path

from . import config

# MongoDB ObjectIds: 24 hex characters. Checking this keeps ids from being
# used to reach other folders (e.g. "../../").
_ID = re.compile(r"^[a-f0-9]{24}$")


def valid_id(value: str) -> bool:
    return bool(_ID.match(value))


def _subject_dir(subject_id: str) -> Path:
    if not valid_id(subject_id):
        raise ValueError("Invalid subject id")
    return config.DOCS_DIR / subject_id


def _doc_path(subject_id: str, document_id: str) -> Path:
    if not valid_id(document_id):
        raise ValueError("Invalid document id")
    return _subject_dir(subject_id) / f"{document_id}.json"


def save_pages(subject_id: str, document_id: str, file_name: str, pages: list[dict]) -> None:
    path = _doc_path(subject_id, document_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    data = {"documentId": document_id, "fileName": file_name, "pages": pages}
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


def load_pages(subject_id: str, document_id: str) -> dict | None:
    path = _doc_path(subject_id, document_id)
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def delete_document(subject_id: str, document_id: str) -> None:
    _doc_path(subject_id, document_id).unlink(missing_ok=True)


def delete_subject(subject_id: str) -> None:
    shutil.rmtree(_subject_dir(subject_id), ignore_errors=True)
