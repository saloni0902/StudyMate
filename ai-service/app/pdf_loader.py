"""Extract text from a PDF page by page with PyMuPDF.

Page numbers are kept so later answers can cite "OS.pdf p. 12".
"""
import re
from pathlib import Path

import pymupdf

# A page with fewer characters than this is treated as empty (e.g. a
# scanned image or a blank page).
MIN_PAGE_CHARS = 20


class PdfError(Exception):
    """The PDF can't be used; the message is shown to the student."""


def clean_text(text: str) -> str:
    text = text.replace("­", "")  # soft hyphens
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)  # words split across lines
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n\s*\n+", "\n\n", text)
    return text.strip()


def extract_pages(path: Path) -> list[dict]:
    """Return [{"page": 1, "text": "..."}, ...] for every page (1-based)."""
    try:
        doc = pymupdf.open(path)
    except Exception as exc:
        raise PdfError("This file could not be opened as a PDF.") from exc

    with doc:
        if doc.needs_pass:
            raise PdfError("This PDF is password-protected. Remove the password and upload it again.")
        if doc.page_count == 0:
            raise PdfError("This PDF has no pages.")

        pages = [{"page": i + 1, "text": clean_text(page.get_text())} for i, page in enumerate(doc)]

    if all(len(p["text"]) < MIN_PAGE_CHARS for p in pages):
        raise PdfError(
            "No text could be found in this PDF. It may be a scanned document; "
            "only PDFs with selectable text are supported."
        )
    return pages
